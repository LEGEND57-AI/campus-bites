import express from "express";
import crypto from "crypto";
import { supabase } from "../db.js";
import { razorpay } from "../utils/razorpay.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";
import { generateDailyToken } from "../utils/tokenGenerator.js";
import { createNotification } from "../utils/notificationService.js";
import { emitOrderUpdate, emitAdminOrderUpdate, emitAnalyticsUpdate } from "../socket/emitters.js";
import {
  REFUND_CLAIM_LOCK,
  refundStatusFromWebhookEvent,
  refundStatusTransition,
} from "../utils/refundState.js";
import { numericToPaise } from "../utils/money.js";
import logger from "../utils/logger.js";

// Razorpay webhook receiver.
//
// This router is intentionally separate from routes/payment.js and is
// mounted in server.js BEFORE the global express.json() parser, using
// express.raw() so req.body is the exact raw byte buffer Razorpay signed.
// It must never go through the `authenticate` middleware — Razorpay calls
// this endpoint server-to-server with no JWT, only its own HMAC signature.
const router = express.Router();

router.use(paymentLimiter);

router.post("/", async (req, res) => {
  const log = req.log || logger;

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      log.error("RAZORPAY_WEBHOOK_SECRET is not configured");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    if (!Buffer.isBuffer(req.body)) {
      // Wrong Content-Type, or body-parsing was bypassed some other way.
      return res.status(400).json({ error: "Invalid webhook request" });
    }

    const signature = req.headers["x-razorpay-signature"];

    if (!signature || typeof signature !== "string") {
      return res.status(400).json({ error: "Missing webhook signature" });
    }

    // Signature is computed over the RAW request body, exactly as Razorpay
    // sent it. Re-serializing a parsed JSON object (JSON.stringify(req.body))
    // is not guaranteed to reproduce the original bytes (key order, spacing,
    // number formatting) and would make verification unreliable.
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    const signatureValid =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!signatureValid) {
      log.warn("Razorpay webhook signature verification failed");
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Only parse JSON *after* the raw-body signature has been verified.
    let event;

    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch (parseError) {
      log.error({ err: parseError }, "Failed to parse Razorpay webhook payload");
      return res.status(400).json({ error: "Invalid payload" });
    }

    switch (event.event) {
      case "payment.captured":
        await handlePaymentCaptured(event, log);
        break;

      case "payment.failed":
        await handlePaymentFailed(event, log);
        break;

      case "refund.processed":
      case "refund.failed":
        await handleRefundStatus(event, log);
        break;

      default:
        log.info(
          { event: event.event },
          "Unhandled Razorpay webhook event type, acknowledging without action"
        );
    }

    // Signature was valid and processing did not throw: acknowledge so
    // Razorpay does not retry.
    return res.status(200).json({ received: true });

  } catch (error) {
    log.error({ err: error }, "Razorpay webhook processing failed");

    // Genuine unexpected failure (e.g. DB unreachable) — 500 tells Razorpay
    // this delivery is worth retrying, unlike a bad signature/payload above.
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

// refund.processed / refund.failed: set orders.refund_status to "processed" or
// "failed" for that exact refund (see utils/refundState.js). Other refund
// events (refund.created, ...) are acknowledged without action.
//
// Safety:
//   - the order is found by the exact Razorpay refund id, and must also carry
//     the event's payment id -- a refund can never update an unrelated order;
//   - the event's refund amount must equal the recorded refund amount;
//   - an event whose name contradicts its own entity status is not applied;
//   - the target state comes only from the signed event;
//   - a duplicate delivery changes nothing and is not re-announced.
//
// Accounting counts only processed refunds, so every applied change is
// announced to the admin screens.
async function handleRefundStatus(event, log) {
  const refund = event.payload?.refund?.entity;

  if (!refund?.id || !refund?.payment_id) {
    log.error(
      { eventId: event?.id, eventType: event?.event },
      "refund webhook missing refund id/payment id"
    );
    return;
  }

  const { status: razorpayStatus, conflict } = refundStatusFromWebhookEvent(event);
  const logContext = {
    eventType: event.event,
    refundId: refund.id,
    paymentId: refund.payment_id,
    razorpayStatus,
  };

  if (conflict) {
    log.error(
      { ...logContext, entityStatus: typeof refund.status === "string" ? refund.status : null },
      "refund webhook: event name contradicts the refund entity status; not applied, needs manual review"
    );
    return;
  }

  const { data: order, error: findError } = await supabase
    .from("orders")
    .select("id, user_id, status, payment_status, payment_id, refund_id, refund_type, refund_amount, refund_status, completed_at, cancel_reason, cancelled_by")
    .eq("refund_id", refund.id)
    .maybeSingle();

  if (findError) throw findError;

  if (order) {
    if (order.payment_id !== refund.payment_id) {
      log.error(
        { ...logContext, orderId: order.id },
        "refund webhook: refund id matches an order recorded against a different payment; not applied"
      );
      return;
    }

    if (!Number.isInteger(refund.amount) || numericToPaise(order.refund_amount) !== refund.amount) {
      log.error(
        { ...logContext, orderId: order.id },
        "refund webhook: refund amount missing or different from the recorded refund amount; not applied, needs manual review"
      );
      return;
    }

    const { updates, reason } = refundStatusTransition(order, razorpayStatus);

    if (!updates) {
      const logFn = reason === "unknown_status" ? log.warn.bind(log) : log.info.bind(log);

      logFn(
        { ...logContext, orderId: order.id, currentRefundStatus: order.refund_status, reason },
        "refund webhook: no change applied"
      );
      return;
    }

    // Conditional on the refund status read above, so two deliveries racing
    // each other cannot both apply a transition computed from the same state.
    let update = supabase
      .from("orders")
      .update(updates)
      .eq("id", order.id)
      .eq("refund_id", refund.id);

    update =
      order.refund_status === null
        ? update.is("refund_status", null)
        : update.eq("refund_status", order.refund_status);

    const { data: updated, error } = await update.select().maybeSingle();

    if (error) throw error;

    if (!updated) {
      // The row changed between the read and the update; let Razorpay
      // redeliver so the transition is recomputed from the current state.
      throw new Error("refund webhook: order refund state changed concurrently; asking Razorpay to retry");
    }

    emitOrderUpdate(updated.user_id, updated);
    emitAdminOrderUpdate(updated);
    emitAnalyticsUpdate();

    const logFn = updated.refund_status === "failed" ? log.error.bind(log) : log.info.bind(log);

    logFn(
      { ...logContext, orderId: updated.id, refundStatus: updated.refund_status },
      updated.refund_status === "failed"
        ? "refund webhook: Razorpay reports the refund FAILED — customer was not refunded, needs manual follow-up"
        : "refund webhook: refund status is now processed"
    );
    return;
  }

  // No order carries this refund id yet. If the payment's order is still
  // mid-refund (claim lock held, refund not yet recorded), the admin route has
  // not recorded the refund; fail so Razorpay redelivers this event once it
  // has. Otherwise the refund was made outside this system -- acknowledge.
  const { data: claimedOrder, error: claimedOrderError } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_id", refund.payment_id)
    .eq("refund_status", REFUND_CLAIM_LOCK)
    .is("refund_id", null)
    .maybeSingle();

  if (claimedOrderError) throw claimedOrderError;

  if (claimedOrder) {
    throw new Error("refund webhook arrived before the refund was recorded; asking Razorpay to retry");
  }

  log.warn(
    logContext,
    "refund webhook: no order records this refund (refund made outside the admin flow?), acknowledging"
  );
}

async function handlePaymentCaptured(event, log) {
  const payment = event.payload?.payment?.entity;

  if (!payment?.id || !payment?.order_id) {
    // Only the event's own identifiers are logged, never the event object.
    // A Razorpay payment entity carries the customer's email, contact number,
    // card last4/network/issuer and vpa (UPI id) -- none of which is needed to
    // reconcile a malformed delivery, and all of which would otherwise be
    // retained in the log stream indefinitely.
    log.error(
      { eventId: event?.id, eventType: event?.event },
      "payment.captured webhook missing payment id/order id"
    );
    return;
  }

  const paymentId = payment.id;
  const razorpayOrderId = payment.order_id;

  // Idempotency: if an order already exists for this payment_id, either the
  // client's /verify call already created it, or we already processed this
  // exact webhook event on a prior delivery. Acknowledge without repeating
  // any side effect.
  const { data: existingOrder, error: lookupError } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existingOrder) {
    log.info(
      { paymentId, orderId: existingOrder.id },
      "payment.captured webhook: order already exists, skipping (idempotent)"
    );
    return;
  }

  // No matching order exists yet. This is the case the webhook exists to
  // catch: the customer's browser closed (or /verify otherwise never ran)
  // after Razorpay captured the payment. Recover it from the
  // payment_intents row persisted at /create-order time — the sole durable,
  // server-side record of what cart this Razorpay order was for.
  const { data: intent, error: intentFetchError } = await supabase
    .from("payment_intents")
    .select("*")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  if (intentFetchError) throw intentFetchError;

  if (!intent) {
    // No persisted intent to recover from. Fabricating order contents from
    // payment data alone risks creating a wrong order against a real
    // charge, which is worse than surfacing the gap for manual
    // reconciliation — same behavior as before recovery existed.
    let affectedUserId = null;

    try {
      const razorpayOrder = await razorpay.orders.fetch(razorpayOrderId);
      affectedUserId = razorpayOrder?.notes?.user_id || null;
    } catch (fetchErr) {
      log.warn(
        { err: fetchErr, razorpayOrderId },
        "Could not fetch Razorpay order to resolve affected user_id for orphaned payment"
      );
    }

    log.error(
      {
        paymentId,
        razorpayOrderId,
        amount: payment.amount,
        userId: affectedUserId,
      },
      "payment.captured webhook: payment captured but no matching payment_intent exists — needs manual reconciliation"
    );
    return;
  }

  // Only ever recover from the pinned cart persisted on the intent — never
  // from the webhook payload, which carries no item/cart data at all.
  if (!Array.isArray(intent.items) || intent.items.length === 0) {
    log.error(
      { paymentId, razorpayOrderId, intentId: intent.id },
      "payment.captured webhook: matching payment_intent has no pinned items — needs manual reconciliation"
    );
    return;
  }

  // Verify the captured amount matches what the intent was created with,
  // before touching anything else — same check /verify performs.
  const expectedAmount = Math.round(Number(intent.total_amount) * 100);

  if (payment.amount !== expectedAmount) {
    log.error(
      {
        paymentId,
        razorpayOrderId,
        intentId: intent.id,
        capturedAmount: payment.amount,
        expectedAmount,
      },
      "payment.captured webhook: captured amount does not match payment_intent total_amount — needs manual reconciliation"
    );
    return;
  }

  // Atomically claim the intent so a concurrent /verify call (or a
  // concurrent/duplicate webhook delivery) cannot also recover this order.
  const { data: claimedIntent, error: claimError } = await supabase
    .from("payment_intents")
    .update({ status: "PAID" })
    .eq("id", intent.id)
    .eq("status", "CREATED")
    .select()
    .maybeSingle();

  if (claimError) throw claimError;

  if (!claimedIntent) {
    // Someone else already claimed this intent — a concurrent /verify
    // call, or a previous webhook delivery (including one that got stuck
    // after claiming, e.g. on a permanent data problem below). Either way
    // it is not this delivery's job to act further.
    log.info(
      { paymentId, razorpayOrderId, intentId: intent.id },
      "payment.captured webhook: payment_intent already claimed by /verify or a prior delivery, skipping (idempotent)"
    );
    return;
  }

  // Map the pinned intent items into the RPC's expected shape. The payment
  // is already captured, so a customer's food choice cannot be
  // second-guessed at recovery time by re-checking live availability —
  // only structural validity of our own pinned data is checked before
  // handing off to the RPC.
  let orderItemsWithPrices;

  try {
    orderItemsWithPrices = claimedIntent.items.map((item) => {
      if (
        !Number.isInteger(item.foodItemId) ||
        !Number.isInteger(item.quantity) ||
        typeof item.price !== "number"
      ) {
        throw new Error("Payment intent item is missing required pinned fields");
      }

      return {
        food_item_id: item.foodItemId,
        quantity: item.quantity,
        price_at_time: item.price,
      };
    });
  } catch (shapeErr) {
    // Our own pinned data is malformed. Do not fabricate a different cart
    // and do not retry Razorpay — this needs a human to look at the
    // payment_intents row. Leave the claim at PAID (not reverted) as a
    // breadcrumb: a later redelivery will see status is no longer CREATED
    // and safely no-op via the claim-miss path above, instead of retrying
    // the same broken data forever.
    log.error(
      { err: shapeErr, paymentId, razorpayOrderId, intentId: claimedIntent.id },
      "payment.captured webhook: payment_intent items failed shape validation — needs manual reconciliation"
    );
    return;
  }

  const { token_number, token_date } = await generateDailyToken();

  const { data: order, error: orderError } = await supabase.rpc(
    "create_order_with_items",
    {
      p_user_id: claimedIntent.user_id,
      p_total_amount: claimedIntent.total_amount,
      p_token_number: token_number,
      p_token_date: token_date,
      // Store Razorpay payment details
      p_payment_id: paymentId,
      p_payment_time: new Date().toISOString(),
      p_items: orderItemsWithPrices,
    }
  );

  if (orderError) {
    if (orderError.code === "23505") {
      // orders.payment_id is unique — a row for this payment already
      // exists despite our claim succeeding. Converge onto it instead of
      // erroring, so this is not treated as a failure.
      const { data: raceOrder, error: raceLookupError } = await supabase
        .from("orders")
        .select("id")
        .eq("payment_id", paymentId)
        .maybeSingle();

      if (!raceLookupError && raceOrder) {
        await supabase
          .from("payment_intents")
          .update({
            order_id: raceOrder.id,
            status: "ORDER_CREATED",
            razorpay_payment_id: paymentId,
          })
          .eq("id", claimedIntent.id);

        log.info(
          { paymentId, razorpayOrderId, intentId: claimedIntent.id, orderId: raceOrder.id },
          "payment.captured webhook: order already existed under a unique-constraint race, converged intent onto it (idempotent)"
        );
        return;
      }

      log.error(
        { paymentId, razorpayOrderId, intentId: claimedIntent.id, orderError },
        "payment.captured webhook: unique_violation creating order but could not locate the existing row — needs manual reconciliation"
      );
      return;
    }

    if (orderError.code) {
      // The RPC reached the DB and the DB rejected the data (bad item
      // shape, FK violation, etc). Retrying the same pinned items against
      // Razorpay or the RPC will not help — this needs a human. Leave the
      // claim at PAID as a breadcrumb (see note above); do not throw, so
      // Razorpay does not retry a permanent condition.
      log.error(
        { paymentId, razorpayOrderId, intentId: claimedIntent.id, orderError },
        "payment.captured webhook: create_order_with_items rejected the pinned items — needs manual reconciliation"
      );
      return;
    }

    // No Postgres error code: a genuinely transient failure (e.g. a
    // network/connection issue reaching the DB). Revert the claim so a
    // retried delivery (or a later /verify call) can cleanly re-attempt,
    // then propagate so Razorpay retries this webhook.
    const { error: revertError } = await supabase
      .from("payment_intents")
      .update({ status: "CREATED" })
      .eq("id", claimedIntent.id)
      .eq("status", "PAID");

    if (revertError) {
      log.error(
        { intentId: claimedIntent.id, revertError },
        "payment.captured webhook: failed to revert payment_intent claim after a transient order-creation failure"
      );
    }

    throw orderError;
  }

  // Order (with its items) now exists and is uniquely tied to this
  // payment_id. Finalize the intent; retry the finalize once on failure,
  // same as /verify, then fall through to notifying the customer regardless
  // — the order itself is valid either way.
  const finalizeIntent = () =>
    supabase
      .from("payment_intents")
      .update({
        order_id: order.id,
        status: "ORDER_CREATED",
        razorpay_payment_id: paymentId,
      })
      .eq("id", claimedIntent.id);

  const { error: finalizeError } = await finalizeIntent();

  if (finalizeError) {
    log.error(
      { paymentId, razorpayOrderId, intentId: claimedIntent.id, orderId: order.id, finalizeError },
      "payment.captured webhook: payment_intents finalize failed after order was created — attempting reconciliation"
    );

    const { error: retryFinalizeError } = await finalizeIntent();

    if (retryFinalizeError) {
      log.error(
        { paymentId, razorpayOrderId, intentId: claimedIntent.id, orderId: order.id, retryFinalizeError },
        "payment.captured webhook: payment_intents finalize retry also failed — needs manual reconciliation"
      );
    }
  }

  // Announce the recovered order in realtime like /verify and the cash route.
  // Never throw from here: a 5xx would make Razorpay redeliver an event whose
  // order already exists.
  try {
    emitOrderUpdate(claimedIntent.user_id, order);
    emitAdminOrderUpdate(order);
  } catch (emitErr) {
    log.warn(
      { orderId: order.id, message: emitErr?.message },
      "payment.captured webhook: order created but realtime emit failed"
    );
  }

  try {
    await createNotification({
      userId: claimedIntent.user_id,
      title: "Order Placed",
      message: "Your order has been placed successfully.",
      type: "order_placed",
      orderId: order.id,
      tokenNumber: token_number,
      actionUrl: `/track-order/${order.id}`,
    });
  } catch (notifyErr) {
    log.warn(
      { err: notifyErr, orderId: order.id },
      "payment.captured webhook: order recovered successfully but notification failed"
    );
  }

  log.info(
    { paymentId, razorpayOrderId, intentId: claimedIntent.id, orderId: order.id },
    "payment.captured webhook: recovered orphaned order from payment_intents"
  );
}

async function handlePaymentFailed(event, log) {
  const payment = event.payload?.payment?.entity;

  log.warn(
    {
      paymentId: payment?.id,
      razorpayOrderId: payment?.order_id,
      errorCode: payment?.error_code,
      errorDescription: payment?.error_description,
    },
    "Razorpay payment.failed webhook received"
  );

  // No order is ever created for a payment that fails before capture — our
  // /verify flow only creates an order after confirming
  // payment.status === "captured". There is nothing to reconcile here;
  // this handler exists purely for observability.
}

export default router;
