// Refund status of an order: orders.refund_status.
//
// ---------------------------------------------------------------------------
// Refund states
// ---------------------------------------------------------------------------
// A recorded refund has exactly one of two states:
//
//   "processed"   Razorpay accepted the refund request (refund created) or
//                 later reported it processed. Counts as refunded money.
//   "failed"      Razorpay reported the refund as failed. No money was
//                 returned; not counted.
//
// There is no intermediate refund state. A refund is recorded only after
// Razorpay has answered the refund request (or the refund has been found at
// Razorpay when the answer was lost); it is never recorded before that.
//
// Refund rows written before this model may still hold another value (for
// example "pending"). They are left as they are, treated as unconfirmed (never
// as processed), and are updated when Razorpay's refund.processed /
// refund.failed webhook for that refund arrives.
//
// ---------------------------------------------------------------------------
// In-flight claim lock (not a refund state)
// ---------------------------------------------------------------------------
// While a refund request is being sent to Razorpay the refund route holds
// refund_status = "PROCESSING" (UPPER CASE) with refund_id still NULL. It is a
// concurrency lock that stops two refund requests for the same order racing,
// and it stays in place if the outcome is unknown and Razorpay cannot be
// queried (manual verification). It is never a recorded refund: every check
// matches the exact upper-case value together with refund_id IS NULL, and it is
// never shown or counted as a refund.
//
// ---------------------------------------------------------------------------
// Transition rules (refundStatusTransition)
// ---------------------------------------------------------------------------
// Every state written comes from authoritative Razorpay data for this exact
// refund: the refund-creation response, a refund entity returned by the
// Razorpay API, or a signed refund.processed / refund.failed webhook. Order
// status "Refunded" or payment status REFUNDED is never treated as proof of a
// refund.
//
//   - "processed" is only set from Razorpay reporting that refund processed.
//   - "failed" is only set from Razorpay reporting that refund failed.
//   - a report that changes nothing produces no update (idempotent).

export const REFUND_STATUS = Object.freeze({
  PROCESSED: "processed",
  FAILED: "failed",
});

// The in-flight claim lock used by routes/admin.js (never a refund state).
export const REFUND_CLAIM_LOCK = "PROCESSING";

// A refund status value -> "processed" | "failed", or null for anything else.
export function normalizeRefundStatus(value) {
  if (typeof value !== "string") return null;

  const status = value.trim().toLowerCase();

  return status === REFUND_STATUS.PROCESSED || status === REFUND_STATUS.FAILED
    ? status
    : null;
}

// The state to record for a refund entity Razorpay returned for a refund
// request (the create response, or the entity found by receipt when that
// response was lost). The entity has already been validated by the caller
// (refund id, payment id, amount), so Razorpay has accepted the refund: it is
// "processed" unless Razorpay explicitly reports it failed.
export function refundStatusForCreatedRefund(refundEntity) {
  return normalizeRefundStatus(refundEntity?.status) === REFUND_STATUS.FAILED
    ? REFUND_STATUS.FAILED
    : REFUND_STATUS.PROCESSED;
}

// ---------------------------------------------------------------------------
// Failed refund: order state
// ---------------------------------------------------------------------------
// A failed refund returned no money, so the order must not keep claiming it
// was refunded (status Refunded, payment REFUNDED / PARTIALLY_REFUNDED). That
// claim is what analytics, Order History and the customer's order page read.
//
// The refund record itself (refund_id, refund_amount, refund_type,
// refund_reason) is kept and refund_status is set to "failed", so:
//   - it stays visible that a refund was attempted and failed;
//   - the one-refund-per-order guard (refund_id / refund_status not null)
//     still blocks a second refund through the app, which is what keeps a
//     refund from ever being issued twice. A failed refund has to be retried
//     from the Razorpay dashboard.
//
// The refund lock also blocks every workflow transition, so an order must not
// be left in a kitchen state it can no longer leave. The payment is still
// captured, so payment_status returns to PAID, and the order becomes:
//   - Completed, if it had completed;
//   - Rejected (with a reason), if it was still Pending / Accepted /
//     Preparing / Ready or had been marked Refunded without completing. This
//     is the existing "cancelled, payment still held" state an admin rejection
//     of a paid online order already produces;
//   - unchanged, if it was already Rejected / Cancelled.
//
// Used for both a failure reported when the refund is created
// (routes/admin.js) and a later refund.failed webhook (routes/paymentWebhook.js).

export const REFUND_FAILED_REASON = "Refund failed: payment not returned";

const OPEN_OR_REFUNDED_STATUSES = ["Pending", "Accepted", "Preparing", "Ready", "Refunded"];

export function refundFailedUpdates(order) {
  const updates = { refund_status: REFUND_STATUS.FAILED };

  if (["REFUNDED", "PARTIALLY_REFUNDED"].includes(order.payment_status)) {
    updates.payment_status = "PAID";
  }

  const hadCompleted = Boolean(order.completed_at) || order.status === "Completed";

  if (hadCompleted) {
    if (order.status !== "Completed") {
      updates.status = "Completed";
    }
  } else if (OPEN_OR_REFUNDED_STATUSES.includes(order.status)) {
    updates.status = "Rejected";
    updates.cancel_reason = order.cancel_reason || REFUND_FAILED_REASON;
    updates.cancelled_by = order.cancelled_by || "ADMIN";
  }

  return updates;
}

// ---------------------------------------------------------------------------
// Processed refund: order state
// ---------------------------------------------------------------------------
// The order is Refunded, and its payment status says how much was refunded.
// If an earlier failure report had moved the order out of Refunded, the
// confirmed outcome restores it.
export function refundProcessedUpdates(order) {
  const updates = { refund_status: REFUND_STATUS.PROCESSED };

  if (!order.refund_id) return updates;

  const refundedPaymentStatus =
    order.refund_type === "partial" ? "PARTIALLY_REFUNDED" : "REFUNDED";

  if (order.status !== "Refunded") {
    updates.status = "Refunded";
  }

  if (order.payment_status !== refundedPaymentStatus) {
    updates.payment_status = refundedPaymentStatus;
  }

  return updates;
}

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------
// Updates to apply when Razorpay reports `razorpayStatus` ("processed" or
// "failed") for the refund this order records.
//
// Returns { updates, reason }:
//   updates  the columns to write, or null when nothing needs to change
//   reason   "applied" | "unchanged" | "unknown_status"
export function refundStatusTransition(order, razorpayStatus) {
  const next = normalizeRefundStatus(razorpayStatus);

  if (!next) {
    return { updates: null, reason: "unknown_status" };
  }

  const updates =
    next === REFUND_STATUS.PROCESSED
      ? refundProcessedUpdates(order)
      : refundFailedUpdates(order);

  // Idempotent: drop columns that already hold the target value.
  const changed = Object.fromEntries(
    Object.entries(updates).filter(([column, value]) => order[column] !== value)
  );

  if (Object.keys(changed).length === 0) {
    return { updates: null, reason: "unchanged" };
  }

  return { updates: changed, reason: "applied" };
}

// ---------------------------------------------------------------------------
// Webhook event -> refund state
// ---------------------------------------------------------------------------
// Only refund.processed and refund.failed change refund state. If the event's
// refund entity carries a status that contradicts the event name, the event is
// not trusted (conflict: true).
export const REFUND_WEBHOOK_EVENTS = Object.freeze([
  "refund.processed",
  "refund.failed",
]);

export function refundStatusFromWebhookEvent(event) {
  const rawEntityStatus = event?.payload?.refund?.entity?.status;
  const entityStatusGiven = typeof rawEntityStatus === "string" && rawEntityStatus.trim() !== "";
  const entityStatus = typeof rawEntityStatus === "string" ? rawEntityStatus.trim().toLowerCase() : "";

  switch (event?.event) {
    case "refund.processed":
      return {
        status: REFUND_STATUS.PROCESSED,
        conflict: entityStatusGiven && entityStatus !== REFUND_STATUS.PROCESSED,
      };

    case "refund.failed":
      return {
        status: REFUND_STATUS.FAILED,
        conflict: entityStatusGiven && entityStatus !== REFUND_STATUS.FAILED,
      };

    default:
      return { status: null, conflict: false };
  }
}
