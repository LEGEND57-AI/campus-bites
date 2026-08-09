import express from "express";
import crypto from "crypto";
import { supabase } from "../db.js";
import { razorpay } from "../utils/razorpay.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";
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

async function handlePaymentCaptured(event, log) {
  const payment = event.payload?.payment?.entity;

  if (!payment?.id || !payment?.order_id) {
    log.error({ event }, "payment.captured webhook missing payment id/order id");
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
  // after Razorpay captured the payment.
  //
  // We deliberately do NOT create an order from here. The current schema
  // has no reliable, persisted record of which cart/items this Razorpay
  // order was for — /create-order never stores the cart server-side, and
  // Razorpay's payment entity does not carry it back to us. The Razorpay
  // order's `notes.user_id` (added in /create-order) tells us *who* was
  // affected, but not *what* to order for them. Fabricating order contents
  // from payment data alone risks creating a wrong order against a real
  // charge, which is worse than surfacing the gap for manual reconciliation.
  // Closing this gap fully requires the schema change described in this
  // task's migration recommendation (see PHASE1_3_MIGRATION.md).
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
    "payment.captured webhook: payment captured but no matching order exists — needs manual reconciliation"
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
