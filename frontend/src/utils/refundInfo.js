// Refund state of a single order, for display.
//
// The state comes ONLY from the order's refund_status, which the backend sets
// from Razorpay's answer to the refund request and Razorpay's refund.processed
// / refund.failed webhooks. A refund has one of two states:
//
//   refund_status   shown as                         colour
//   "processed"     Refunded / Partial Refund        green   money returned
//   "failed"        Refund Failed                    red     no money returned
//
// Full vs partial comes from the stored amounts: refund amount equal to the
// order total is "Refunded", less than the total is "Partial Refund".
//
// Refund rows recorded before this model may still hold another value. Such a
// refund is "unconfirmed": it is never shown as processed or counted, and it is
// shown only by its type with neutral styling.
//
// The frontend never contacts Razorpay; aggregate figures (gross / refunds /
// net revenue) always come from the backend. This only describes one order's
// own refund.

const toPaise = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const rupees = (paise) => paise / 100;

// One place for the colours of each refund state.
//   text   coloured status text on a light background
//   badge  pill (background + text)
export const REFUND_STATE_STYLES = Object.freeze({
  processed: {
    text: "text-green-600",
    badge: "bg-green-100 text-green-700",
  },
  failed: {
    text: "text-red-600",
    badge: "bg-red-100 text-red-700",
  },
  unconfirmed: {
    text: "text-slate-600",
    badge: "bg-slate-100 text-slate-700",
  },
});

// refund_status -> display state. Only an explicit "processed" is processed.
export function normalizeRefundState(refundStatus) {
  const status = String(refundStatus || "").trim().toLowerCase();

  if (status === "processed" || status === "failed") {
    return status;
  }

  return "unconfirmed";
}

/**
 * @returns {null | {
 *   state: "processed" | "failed" | "unconfirmed",
 *   type: "full" | "partial",
 *   amount: number,        // refund amount recorded (rupees)
 *   netAmount: number,     // what the order keeps: total - processed refund
 *   typeLabel: string,     // "Refunded" | "Partial Refund"
 *   typeText: string,      // "Full Refund" | "Partial Refund"
 *   label: string,         // typeLabel, or "Refund Failed"
 *   styles: { text, badge },
 * }}
 */
export function getRefundInfo(order) {
  if (!order || (!order.refund_id && order.refund_amount == null)) return null;

  const totalPaise = toPaise(order.total_amount);
  const state = normalizeRefundState(order.refund_status);

  let type;

  if (order.refund_amount != null && totalPaise > 0) {
    type = toPaise(order.refund_amount) >= totalPaise ? "full" : "partial";
  } else {
    type = order.refund_type === "partial" ? "partial" : "full";
  }

  const refundPaise =
    order.refund_amount != null
      ? Math.min(Math.max(toPaise(order.refund_amount), 0), totalPaise)
      : type === "full" ? totalPaise : 0;

  const typeLabel = type === "partial" ? "Partial Refund" : "Refunded";

  return {
    state,
    type,
    amount: rupees(refundPaise),
    netAmount: rupees(totalPaise - (state === "processed" ? refundPaise : 0)),
    typeLabel,
    typeText: type === "partial" ? "Partial Refund" : "Full Refund",
    label: state === "failed" ? "Refund Failed" : typeLabel,
    styles: REFUND_STATE_STYLES[state],
  };
}
