import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/admin.js';
import { adminLimiter } from "../middleware/rateLimiter.js";
import { autoCancelExpiredCashOrders } from "../utils/autoCancelOrders.js";
import { createNotification } from "../utils/notificationService.js";
import { razorpay } from "../utils/razorpay.js";
import { isAllowedImageUrl } from "../utils/imageUrl.js";
import { parseRupeesToPaise, numericToPaise, formatPaise } from "../utils/money.js";
import { istDayWindow, istCalendarParts } from "../utils/istDate.js";
import {
  ORDER_SCOPE,
  SCOPE_STATUSES,
  OrderSearchInputError,
  parseOrderSearchQuery,
  searchOrders,
  orderMatchesSearch,
  paginate,
} from "../utils/orderSearch.js";
import {
  REFUND_CLAIM_LOCK,
  REFUND_STATUS,
  refundStatusForCreatedRefund,
  refundFailedUpdates,
} from "../utils/refundState.js";
import {
  emitOrderUpdate,
  emitAdminOrderUpdate,
  emitNotification,
  emitAnalyticsUpdate,
  emitMenuUpdate,
} from "../socket/emitters.js";

const router = express.Router();

router.use(adminLimiter);
router.use(authenticate, isAdmin);

// Same pagination bounds as routes/history.js, orders.js and notifications.js.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;


// ---------- Orders: the live queue (Admin Orders screen) ----------
//
// GET /orders?view=active&search=&status=&payment_method=&page=&limit=&include_summary=
//
// Today's (IST) Pending / Accepted / Preparing / Ready orders, searched,
// filtered, sorted and paginated in PostgreSQL (utils/orderSearch.js). Only
// the requested page is returned, with the stat-card counts in `summary`
// (today + payment filter, independent of status and search). The date window
// is fixed by the server; the client cannot widen it.
const ADMIN_QUEUE_PAGE_SIZE = 50;

async function sendActiveQueue(req, res) {
  let params;

  try {
    params = parseOrderSearchQuery(
      { ...req.query, limit: req.query.limit ?? String(ADMIN_QUEUE_PAGE_SIZE), from: undefined, to: undefined },
      ORDER_SCOPE.ACTIVE
    );
  } catch (err) {
    if (err instanceof OrderSearchInputError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }

  const { year, month, day } = istCalendarParts();
  const todayIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  params.from = todayIso;
  params.to = todayIso;

  const result = await searchOrders(ORDER_SCOPE.ACTIVE, params);

  if (result) {
    return res.json(result);
  }

  // Pre-migration fallback: today's active orders only (a small, bounded
  // set), same matching rules, still paginated before it leaves the server.
  const { start, end } = istDayWindow();
  const statuses = params.statuses || SCOPE_STATUSES[ORDER_SCOPE.ACTIVE];

  let query = supabase
    .from('orders')
    .select(`
      id, token_number, status, created_at, completed_at, total_amount,
      payment_method, payment_status, payment_due_at, cancel_reason, cancelled_by,
      refund_status, refund_type, refund_amount, refund_reason, refund_id, refunded_at,
      user:users(name, phone),
      order_items (id, quantity, price_at_time, food_items (id, name))
    `)
    .in('status', SCOPE_STATUSES[ORDER_SCOPE.ACTIVE])
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (params.paymentMethod) {
    query = query.eq('payment_method', params.paymentMethod);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = data || [];
  const matching = rows.filter(
    (order) => statuses.includes(order.status) && orderMatchesSearch(order, params.search)
  );

  const summary = params.includeSummary
    ? {
      total: rows.length,
      pending: rows.filter((o) => o.status === 'Pending' || o.status === 'Accepted').length,
      preparing: rows.filter((o) => o.status === 'Preparing').length,
      ready: rows.filter((o) => o.status === 'Ready').length,
    }
    : null;

  return res.json({ ...paginate(matching, params.page, params.limit), summary });
}

// ---------- Orders ----------
router.get('/orders', async (req, res) => {
  try {

    if (req.query.view === 'active') {
      return await sendActiveQueue(req, res);
    }

    // "Today" is the current IST calendar day as a half-open window
    // [IST midnight, next IST midnight). setHours() used the Node process
    // timezone, so on a UTC host orders placed between 00:00 and 05:30 IST
    // were filed under the previous day.
    const { start: todayStart, end: tomorrowStart } = istDayWindow();

    const { all, page: rawPage, limit: rawLimit } = req.query;

    // `?all=true` dropped the day filter and returned every order ever placed
    // in a single unbounded response. It has no caller, so it is now only
    // honoured as a paginated request -- the wide window survives, the
    // unbounded read does not.
    const wantsAll = all === 'true';

    // Pagination stays opt-in. With no page/limit (and no all=true) the
    // response is the same bare array of today's orders it has always been,
    // which AdminDashboard.jsx still reads for its recent-orders list. The
    // Admin Orders screen no longer uses this path: it calls ?view=active
    // (server-side search and pagination, above).
    const wantsPagination =
      wantsAll || rawPage !== undefined || rawLimit !== undefined;

    const page = Math.max(parseInt(rawPage, 10) || 1, 1);

    const limit = Math.min(
      Math.max(parseInt(rawLimit, 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );

    let query = supabase
      .from('orders')
      .select(`
        *,
        user:users(id, name, email, phone),
        order_items (
          quantity,
          price_at_time,
          food_items (id, name, image_url, category_id)
        )
      `, wantsPagination ? { count: 'exact' } : {});

    if (!wantsAll) {
      query = query
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString());
    }

    // created_at DESC is the existing order. The id DESC tiebreaker only
    // decides ties, which Postgres previously resolved arbitrarily -- without
    // it two orders sharing a timestamp could swap between pages.
    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (wantsPagination) {
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    if (!wantsPagination) {
      return res.json(data);
    }

    const total = count || 0;
    const rows = data || [];

    res.json({
      orders: rows,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      hasMore: (page - 1) * limit + rows.length < total,
    });
  } catch (err) {
    console.error('Orders fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ---------- Receive Cash Payment ----------
router.patch('/orders/:id/payment', async (req, res) => {
  const { id } = req.params;

  try {

    const { data: existingOrder, error: fetchError } = await supabase
      .from("orders")
      .select("payment_method, status, payment_status, refund_status")
      .eq("id", id)
      .single();

    // PGRST116 is PostgREST's "no rows returned" for .single(). Here that can
    // only mean no order carries this id, which is a missing resource, not a
    // server fault -- it was previously rethrown and answered 500. Every other
    // error code still propagates to the 500 below.
    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json({ error: "Order not found" });
      }

      throw fetchError;
    }

    if (existingOrder.payment_method !== "CASH") {
      return res.status(400).json({
        error: "Only cash orders can be marked as paid through this action."
      });
    }

    if (
      existingOrder.status !== "Pending" ||
      existingOrder.payment_status !== "PENDING"
    ) {
      return res.status(400).json({
        error: "Order is not awaiting cash payment."
      });
    }

    if (existingOrder.refund_status !== null) {
      return res.status(400).json({
        error: "Order has an active or completed refund and cannot be marked as paid."
      });
    }

    // Receiving cash both settles the payment and starts preparation, in this
    // one guarded statement: the order cannot end up PAID but still Pending,
    // and it can never race the auto-cancel job, which only matches
    // Pending + PENDING rows.
    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAID',
        status: 'Preparing'
      })
      .eq('id', id)
      .eq('status', 'Pending')
      .eq('payment_status', 'PENDING')
      .eq('payment_method', 'CASH')
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(409).json({
        error: "Order was modified concurrently. Please refresh and try again."
      });
    }


    const notification = await createNotification({
      userId: data.user_id,
      title: "Preparing Your Order",
      message: `Payment received. Our kitchen has started preparing your order.`,
      type: "order_preparing",
      priority: "medium",
      orderId: data.id,
      tokenNumber: data.token_number,
      actionUrl: `/track-order/${data.id}`,
    });

  
    emitOrderUpdate(data.user_id, data);
    emitAdminOrderUpdate(data);
    emitAnalyticsUpdate();

    res.json({
      success: true,
      message: "Payment received successfully",
      order: data
    });


  } catch (err) {

    console.error('Payment update error:', err);

    res.status(500).json({
      error: 'Failed to update payment'
    });

  }

});

// Only these forward transitions are allowed by this endpoint. Any
// current status not listed here (Completed, Rejected, Cancelled,
// Refunded) is terminal — no target status is reachable from it.
//
// "Accepted" is no longer a separate admin step: a paid Pending order goes
// straight to Preparing ("Accept & Prepare"), and receiving cash above moves
// the order to Preparing directly. Accepted may still exist on older rows,
// so it keeps its own path to Preparing.
const ALLOWED_STATUS_TRANSITIONS = {
  Pending: ["Preparing", "Rejected"],
  Accepted: ["Preparing", "Rejected"],
  Preparing: ["Ready", "Rejected"],
  Ready: ["Completed", "Rejected"],
};

// ---------- Update Order Status ----------
router.patch('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, cancel_reason } = req.body;

  const allowed = [
    "Pending",
    "Accepted",
    "Preparing",
    "Ready",
    "Completed",
    "Rejected",
  ];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { data: existingOrder, error: fetchError } = await supabase
      .from("orders")
      .select("status, payment_method, payment_status, refund_status")
      .eq("id", id)
      .single();

    // See the note in /orders/:id/payment: PGRST116 means no order has this
    // id, so it is a 404 rather than a 500.
    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json({ error: "Order not found" });
      }

      throw fetchError;
    }

    if (existingOrder.refund_status !== null) {
      return res.status(400).json({
        error: "Order has an active or completed refund and cannot change status."
      });
    }

    if (!ALLOWED_STATUS_TRANSITIONS[existingOrder.status]?.includes(status)) {
      return res.status(400).json({
        error: `Cannot change order status from ${existingOrder.status} to ${status}.`
      });
    }

    // Kitchen progress (anything other than Rejected) requires a settled
    // payment. Without this, an unpaid cash order could be moved out of
    // Pending and escape the 15-minute payment-timeout auto-cancel, which
    // only matches status = 'Pending'.
    const isForwardTransition = status !== "Rejected";

    if (isForwardTransition && existingOrder.payment_status !== "PAID") {
      return res.status(400).json({
        error: "Order payment has not been received."
      });
    }

    const updates = {
      status,
    };

    if (status === "Completed") {
      updates.completed_at = new Date().toISOString();
    }

    if (status === "Rejected") {
      updates.cancel_reason = cancel_reason || "Cancelled by Admin";
      updates.cancelled_by = "ADMIN";

      // Agar payment receive nahi hua tha to payment bhi cancel — but a
      // captured Razorpay payment must go through the Refund action
      // instead, so its payment_status must stay "PAID" here.
      const isCapturedRazorpayPayment =
        existingOrder.payment_method === "RAZORPAY" &&
        existingOrder.payment_status === "PAID";

      if (!isCapturedRazorpayPayment) {
        updates.payment_status = "CANCELLED";
      }
    }

    let updateQuery = supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .eq("status", existingOrder.status);

    if (isForwardTransition) {
      updateQuery = updateQuery.eq("payment_status", "PAID");
    }

    const { data: order, error } = await updateQuery
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      return res.status(409).json({
        error: "Order was modified concurrently. Please refresh and try again."
      });
    }

    let title = "";
    let message = "";
    let priority = "medium";
    let notificationType = "";

    switch (status) {
      case "Preparing":
        title = "Preparing Your Order";
        message = `Our kitchen has started preparing your order.`;
        notificationType = "order_preparing";
        break;

      case "Ready":
        title = "Order Ready";
        message = `Your order is ready for pickup.`;
        priority = "high";
        notificationType = "order_ready";
        break;

      case "Completed":
        title = "Order Completed";
        message = `Thanks for ordering!`;
        notificationType = "order_completed";
        break;

      case "Rejected":
        title = "Order Cancelled";
        message =
          cancel_reason || `Your Token #${order.token_number} has been cancelled.`;
        priority = "high";
        notificationType = "order_cancelled";
        break;
    }

    if (title) {

      const notification = await createNotification({
        userId: order.user_id,
        title,
        message,
        type: notificationType,
        priority,
        orderId: order.id,
        tokenNumber: order.token_number,
        actionUrl: `/track-order/${order.id}`,
      });

    }

    emitOrderUpdate(order.user_id, order);
    emitAdminOrderUpdate(order);
    emitAnalyticsUpdate();

    res.json({
      success: true,
      status
    });
  } catch (err) {
    console.error('Order status update error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ---------- Refund Order ----------
//
// An order can be refunded ONCE, either in full or partially: the orders row
// holds a single refund_id / refund_amount, and the claim below only matches a
// row with no refund recorded. All amounts are handled in integer paise.
//
// Request body:
//   refundType   "full" | "partial"
//   refundReason non-empty string
//   amount       rupees (number or string, at most 2 decimals) -- required for
//                a partial refund; for a full refund it may be omitted, and if
//                sent must equal the order total
const REFUND_REASON_MAX_LENGTH = 200;
// Razorpay's minimum refund ("The amount must be at least INR 1.00").
const MIN_REFUND_PAISE = 100;
const RAZORPAY_CALL_TIMEOUT_MS = 20000;

// Razorpay rejects a second refund on a payment that reuses a receipt
// ("Duplicate receipt found for this refund request"). With one refund per
// order, a receipt derived from the order id makes re-sending the refund after
// a lost response safe: the duplicate is rejected and reconciled below instead
// of refunding the customer twice.
const refundReceiptFor = (orderId) => `rf_${orderId}`;

const REFUND_TIMEOUT_CODE = "RAZORPAY_TIMEOUT";

function withTimeout(promise, ms) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error("Razorpay request timed out"), { code: REFUND_TIMEOUT_CODE })),
      ms
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// The Razorpay SDK rethrows HTTP errors as { statusCode, error: { description } }.
// Anything else (timeouts, dropped connections -- which the SDK surfaces as a
// TypeError because there is no response) means the outcome is unknown.
const isRazorpayHttpError = (err) =>
  Boolean(err) && typeof err === "object" && Number.isInteger(err.statusCode);

const razorpayErrorDescription = (err) =>
  typeof err?.error?.description === "string" ? err.error.description : "";

const isValidRefundEntity = (refund, paymentId) =>
  Boolean(refund) &&
  typeof refund.id === "string" &&
  refund.id.length > 0 &&
  Number.isInteger(refund.amount) &&
  refund.amount > 0 &&
  (refund.payment_id === undefined || refund.payment_id === paymentId);

async function findRefundByReceipt(paymentId, receipt) {
  const result = await withTimeout(
    razorpay.payments.fetchMultipleRefund(paymentId, { count: 100 }),
    RAZORPAY_CALL_TIMEOUT_MS
  );

  const items = Array.isArray(result?.items) ? result.items : [];

  return items.find((item) => item?.receipt === receipt && isValidRefundEntity(item, paymentId)) || null;
}

router.post("/orders/:id/refund", async (req, res) => {
  const { id } = req.params;

  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : null;

  if (!body) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { refundType, refundReason, amount } = body;

  if (!["full", "partial"].includes(refundType)) {
    return res.status(400).json({
      error: "Invalid refund type",
    });
  }

  if (typeof refundReason !== "string" || !refundReason.trim()) {
    return res.status(400).json({
      error: "Refund reason is required",
    });
  }

  const reason = refundReason.trim();

  if (reason.length > REFUND_REASON_MAX_LENGTH) {
    return res.status(400).json({
      error: `Refund reason must be at most ${REFUND_REASON_MAX_LENGTH} characters`,
    });
  }

  const amountProvided = amount !== undefined && amount !== null && amount !== "";
  const requestedPaise = amountProvided ? parseRupeesToPaise(amount) : null;

  if (amountProvided && requestedPaise === null) {
    return res.status(400).json({
      error: "Refund amount must be a valid rupee amount with at most 2 decimal places",
    });
  }

  if (refundType === "partial" && !amountProvided) {
    return res.status(400).json({
      error: "Refund amount is required for a partial refund",
    });
  }

  // Set once this request has atomically claimed the order for refund
  // processing (refund_status NULL -> PROCESSING).
  let claimed = false;

  // Set once a refund request may have reached Razorpay. From then on the
  // claim is only released when Razorpay has been checked and shows no refund
  // for this order's receipt.
  let refundMayExist = false;

  async function revertClaim() {
    if (!claimed) return;

    try {
      const { error: revertError } = await supabase
        .from("orders")
        .update({ refund_status: null })
        .eq("id", id)
        .eq("refund_status", REFUND_CLAIM_LOCK)
        .is("refund_id", null);

      if (revertError) {
        console.error(
          "Failed to revert refund claim after failure.",
          { orderId: id, revertError }
        );
      }

      claimed = false;
    } catch (revertCatchError) {
      console.error(
        "Unexpected error while reverting refund claim.",
        { orderId: id, revertCatchError }
      );
    }
  }

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    if (order.payment_method !== "RAZORPAY") {
      return res.status(400).json({
        error: "Only online payments can be refunded.",
      });
    }

    const alreadyRefunded =
      order.refund_id !== null ||
      order.refund_status !== null ||
      ["REFUNDED", "PARTIALLY_REFUNDED"].includes(order.payment_status);

    if (alreadyRefunded) {
      return res.status(409).json({
        error: "This order has already been refunded or a refund is in progress.",
      });
    }

    if (order.payment_status !== "PAID" || !order.payment_id) {
      return res.status(400).json({
        error: "Payment not completed.",
      });
    }

    const totalPaise = numericToPaise(order.total_amount);

    if (totalPaise === null || totalPaise < MIN_REFUND_PAISE) {
      console.error("Refund blocked: order total is not a valid amount.", { orderId: id });

      return res.status(409).json({
        error: "Order total is invalid; this refund needs manual review.",
      });
    }

    let refundPaise = totalPaise;

    if (refundType === "partial") {
      refundPaise = requestedPaise;

      if (refundPaise < MIN_REFUND_PAISE) {
        return res.status(400).json({
          error: "Refund amount must be at least ₹1.00",
        });
      }

      if (refundPaise > totalPaise) {
        return res.status(400).json({
          error: `Refund amount cannot exceed the amount paid (₹${formatPaise(totalPaise)})`,
        });
      }
    } else if (amountProvided && requestedPaise !== totalPaise) {
      return res.status(400).json({
        error: `A full refund must be for the amount paid (₹${formatPaise(totalPaise)})`,
      });
    }

    // Atomically claim the order for refund processing so concurrent
    // refund requests for the same order cannot both reach Razorpay.
    const { data: claimedOrder, error: claimError } = await supabase
      .from("orders")
      .update({ refund_status: REFUND_CLAIM_LOCK })
      .eq("id", id)
      .eq("payment_method", "RAZORPAY")
      .eq("payment_status", "PAID")
      .is("refund_id", null)
      .is("refund_status", null)
      .select()
      .maybeSingle();

    if (claimError) throw claimError;

    if (!claimedOrder) {
      return res.status(409).json({
        error: "This order has already been refunded or a refund is in progress.",
      });
    }

    claimed = true;

    const paymentId = order.payment_id;
    const receipt = refundReceiptFor(order.id);

    // Records a refund that exists at Razorpay. The amount and type come from
    // the Razorpay refund entity, never from the request, so the order always
    // reflects the money that actually moved.
    async function finalizeRefund(refund, { reconciled }) {
      const actualPaise = refund.amount;
      const isFull = actualPaise >= totalPaise;

      // Never record more than the order total (the entity came from Razorpay
      // for this payment, but a refund above the total cannot belong to this
      // order's single refund). Keep the claim so it is checked manually.
      if (!Number.isInteger(actualPaise) || actualPaise < 1 || actualPaise > totalPaise) {
        console.error("Razorpay refund amount does not fit this order -- order left in PROCESSING. Needs manual verification.", {
          orderId: id,
          refundId: refund.id,
          refundAmount: actualPaise,
          orderTotal: formatPaise(totalPaise),
        });

        return res.status(502).json({
          error: "The Razorpay refund does not match this order's amount. Verify it in the Razorpay dashboard.",
        });
      }

      // This runs only after Razorpay has answered the refund request with a
      // valid refund entity for this payment (exact refund id, payment id and
      // amount checked by the caller), or that refund was found at Razorpay by
      // this order's receipt. Razorpay has accepted the refund, so it is
      // recorded as "processed" -- unless Razorpay explicitly reports it
      // "failed". There is no intermediate state; see utils/refundState.js.
      const refundStatus = refundStatusForCreatedRefund(refund);

      // A failed refund returned no money. Record the attempt (it still holds
      // this order's one refund), but do not mark the order or payment as
      // refunded. The order gets the same failed-refund state as a later
      // refund.failed webhook, so it is never left in a workflow state the
      // refund lock would freeze.
      const refundFailed = refundStatus === REFUND_STATUS.FAILED;

      const refundRecord = {
        refund_type: isFull ? "full" : "partial",
        refund_reason: reason,
        refund_amount: formatPaise(actualPaise),
        refund_id: refund.id,
        refunded_at: new Date().toISOString(),
      };

      const refundUpdatePayload = refundFailed
        ? { ...refundRecord, ...refundFailedUpdates(order) }
        : {
          ...refundRecord,
          status: "Refunded",
          payment_status: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
          refund_status: REFUND_STATUS.PROCESSED,
        };

      const finalize = () =>
        supabase
          .from("orders")
          .update(refundUpdatePayload)
          .eq("id", id)
          .eq("refund_status", REFUND_CLAIM_LOCK)
          .is("refund_id", null);

      const { error: updateError } = await finalize();

      if (updateError) {
        // Razorpay has already processed the refund — never retry the
        // Razorpay call itself. Retry only the DB finalization, once,
        // using the same guarded conditional update.
        console.error(
          "Failed to finalize refund record after Razorpay refund succeeded — attempting reconciliation.",
          { orderId: id, refundId: refund.id, updateError }
        );

        const { error: retryUpdateError } = await finalize();

        if (retryUpdateError) {
          console.error(
            "Refund reconciliation retry also failed — Razorpay refund " +
            "succeeded but the order row is not finalized. Needs urgent " +
            "manual reconciliation.",
            {
              orderId: id,
              refundId: refund.id,
              refundAmount: formatPaise(actualPaise),
              retryUpdateError,
            }
          );

          if (refundFailed) {
            return res.status(502).json({
              error:
                "Razorpay reports this refund as failed, and the order could not be updated. " +
                "Verify this order manually.",
              refundStatus: "failed",
            });
          }

          // Do not claim failure — the refund genuinely succeeded at
          // Razorpay. Skip notifications/socket emits since the order row
          // is still inconsistent; a retry via this endpoint is already
          // blocked by the claim guard, so this is not a double-refund risk.
          return res.status(200).json({
            success: true,
            message:
              "Razorpay processed the refund, but it could not be recorded on the order. Please verify this order manually.",
            refundStatus,
            refund,
          });
        }
      }

      const { data: updatedOrder } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      const rupees = formatPaise(actualPaise);

      if (refundFailed) {
        console.error("Razorpay reports the refund as failed at creation.", {
          orderId: id,
          refundId: refund.id,
        });

        emitOrderUpdate(order.user_id, updatedOrder);
        emitAdminOrderUpdate(updatedOrder);
        emitAnalyticsUpdate();

        return res.status(502).json({
          error:
            "Razorpay reports this refund as failed. No money was returned to the customer. " +
            "Retry it from the Razorpay dashboard.",
          refundStatus: "failed",
        });
      }

      await createNotification({
        userId: order.user_id,
        title: "Refund Processed",
        message: isFull
          ? `Your ₹${rupees} refund has been processed to your original payment method.`
          : `Your partial refund of ₹${rupees} has been processed to your original payment method.`,
        type: "refund_processed",
        priority: "high",
        orderId: order.id,
        tokenNumber: order.token_number,
        actionUrl: `/track-order/${order.id}`,
      });

      emitOrderUpdate(order.user_id, updatedOrder);
      emitAdminOrderUpdate(updatedOrder);
      emitAnalyticsUpdate();

      return res.json({
        success: true,
        message: isFull
          ? `Full refund of ₹${rupees} processed.`
          : `Partial refund of ₹${rupees} processed.`,
        refundType: isFull ? "full" : "partial",
        refundAmount: rupees,
        refundStatus,
        reconciled,
        refund,
      });
    }

    // The refund request may or may not have been applied by Razorpay (lost
    // response, timeout, malformed response, or a duplicate receipt from an
    // earlier attempt). Razorpay is the source of truth: look the refund up by
    // this order's receipt.
    async function reconcileUnknownOutcome(cause) {
      let existing;

      try {
        existing = await findRefundByReceipt(paymentId, receipt);
      } catch (lookupError) {
        // Cannot tell whether money moved. Keep the claim so no second refund
        // can be started until someone checks the Razorpay dashboard.
        console.error(
          "Refund outcome unknown and Razorpay could not be queried — order left in PROCESSING. Needs manual verification.",
          { orderId: id, paymentId, cause: cause?.code || cause?.message || cause, lookupError: lookupError?.code || lookupError?.message }
        );

        return res.status(502).json({
          error: "Refund status is unknown. Verify this payment in the Razorpay dashboard before trying again.",
        });
      }

      if (existing) {
        return finalizeRefund(existing, { reconciled: true });
      }

      // Razorpay has no refund for this receipt. Releasing the claim is safe:
      // if the original request lands later, a retry reuses the same receipt
      // and is rejected as a duplicate, then reconciled here.
      refundMayExist = false;
      await revertClaim();

      return res.status(502).json({
        error: "Razorpay did not confirm the refund. No refund was recorded; it is safe to try again.",
      });
    }

    // Verify the payment against Razorpay before refunding: it must be
    // captured for exactly the order total, with nothing refunded yet.
    let payment;

    try {
      payment = await withTimeout(
        razorpay.payments.fetch(paymentId),
        RAZORPAY_CALL_TIMEOUT_MS
      );
    } catch (fetchError) {
      console.error("Could not fetch payment from Razorpay before refund.", {
        orderId: id,
        statusCode: fetchError?.statusCode,
        description: razorpayErrorDescription(fetchError),
        code: fetchError?.code,
      });

      await revertClaim();

      return res.status(502).json({
        error: "Could not verify the payment with Razorpay. No refund was issued; please try again.",
      });
    }

    const capturedPaise = Number.isInteger(payment?.amount) ? payment.amount : null;
    const alreadyRefundedPaise = Number.isInteger(payment?.amount_refunded) ? payment.amount_refunded : 0;

    if (alreadyRefundedPaise > 0) {
      // A refund exists at Razorpay but not in this order. If it carries this
      // order's receipt it came from an earlier attempt whose response was
      // lost -- record it. Otherwise it was made outside this system.
      refundMayExist = true;

      let existing = null;

      try {
        existing = await findRefundByReceipt(paymentId, receipt);
      } catch (lookupError) {
        console.error("Could not look up existing Razorpay refunds.", { orderId: id, lookupError: lookupError?.code || lookupError?.message });
      }

      if (existing) {
        return finalizeRefund(existing, { reconciled: true });
      }

      refundMayExist = false;
      await revertClaim();

      console.error("Razorpay payment already has refunds not recorded on this order.", {
        orderId: id,
        paymentId,
        alreadyRefunded: formatPaise(alreadyRefundedPaise),
      });

      return res.status(409).json({
        error: "Razorpay already shows a refund for this payment that is not recorded on this order. Reconcile it manually.",
      });
    }

    if (payment?.status !== "captured" || capturedPaise !== totalPaise) {
      await revertClaim();

      console.error("Razorpay payment does not match the order for refund.", {
        orderId: id,
        paymentId,
        paymentStatus: payment?.status,
        captured: capturedPaise === null ? null : formatPaise(capturedPaise),
        orderTotal: formatPaise(totalPaise),
      });

      return res.status(409).json({
        error: "The Razorpay payment does not match this order (not captured or amount differs). Reconcile it manually.",
      });
    }

    let refund;

    refundMayExist = true;

    try {
      refund = await withTimeout(
        razorpay.payments.refund(paymentId, {
          amount: refundPaise,
          receipt,
          notes: {
            order_id: String(order.id),
            refund_type: refundPaise === totalPaise ? "full" : "partial",
            reason,
          },
        }),
        RAZORPAY_CALL_TIMEOUT_MS
      );
    } catch (refundError) {
      if (
        isRazorpayHttpError(refundError) &&
        !/duplicate receipt/i.test(razorpayErrorDescription(refundError))
      ) {
        // Razorpay answered and refused: no refund was created.
        refundMayExist = false;
        await revertClaim();

        const description = razorpayErrorDescription(refundError);

        console.error("Razorpay rejected the refund.", {
          orderId: id,
          statusCode: refundError.statusCode,
          description,
        });

        return res.status(502).json({
          error: description
            ? `Razorpay rejected the refund: ${description}`
            : "Razorpay rejected the refund.",
        });
      }

      console.error("Refund outcome unknown after Razorpay call — reconciling.", {
        orderId: id,
        statusCode: refundError?.statusCode,
        description: razorpayErrorDescription(refundError),
        code: refundError?.code,
        message: refundError?.message,
      });

      return reconcileUnknownOutcome(refundError);
    }

    if (!isValidRefundEntity(refund, paymentId) || refund.amount !== refundPaise) {
      console.error("Unexpected Razorpay refund response — reconciling.", {
        orderId: id,
        refundId: refund?.id,
        refundAmount: refund?.amount,
        expected: refundPaise,
      });

      return reconcileUnknownOutcome(new Error("Malformed Razorpay refund response"));
    }

    return finalizeRefund(refund, { reconciled: false });

  } catch (err) {
    console.error(err);

    if (!refundMayExist) {
      await revertClaim();
    }

    if (res.headersSent) return;

    res.status(500).json({
      error: 'Failed to process refund',
    });
  }
});

// ---------- Menu (ONLY AVAILABLE ITEMS) ----------
router.get('/menu', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('food_items')
      .select('*')
      .order('id');
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Menu fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// ---------- Toggle Availability ----------
router.patch('/menu/:id/availability', async (req, res) => {
  const { id } = req.params;
  const { available } = req.body;
  if (typeof available !== "boolean") {
    return res.status(400).json({
      error: "Invalid availability value"
    });
  }

  try {
    const { data, error } = await supabase
      .from('food_items')
      .update({ available })
      .eq('id', id)
      .select()
      .single();

    // An update matching no row returns zero rows, which .single() reports as
    // PGRST116. That means no menu item carries this id -- a 404, not the 500
    // this previously produced.
    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Menu item not found" });
      }

      throw error;
    }

    emitMenuUpdate();

    res.json({
      success: true,
      item: data
    });

  } catch (err) {
    console.error('Availability update error:', err);

    res.status(500).json({
      error: 'Failed to update availability'
    });
  }
});

// ---------- Add Menu ----------
router.post('/menu', async (req, res) => {
  const {
    name,
    description,
    price,
    image_url,
    category_id,
    available = true
  } = req.body;

  if (!name || !price || !category_id) {
    return res.status(400).json({
      error: 'Missing required fields'
    });
  }

  if (typeof price !== "number" || price <= 0) {
    return res.status(400).json({
      error: "Invalid price"
    });
  }

  if (!isAllowedImageUrl(image_url)) {
    return res.status(400).json({
      error: "Image URL must be uploaded via /api/upload"
    });
  }

  try {
    const { data, error } = await supabase
      .from('food_items')
      .insert([
        {
          name,
          description,
          price,
          image_url,
          category_id,
          available
        }
      ])
      .select()
      .single();

    if (error) throw error;

    emitMenuUpdate();

    res.status(201).json(data);
  } catch (err) {
    console.error('Add menu item error:', err);
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

// ---------- Update Menu ----------
router.put('/menu/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    price,
    image_url,
    category_id,
    available
  } = req.body;

  if (price !== undefined) {
    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({
        error: "Invalid price"
      });
    }
  }

  if (image_url !== undefined && !isAllowedImageUrl(image_url)) {
    return res.status(400).json({
      error: "Image URL must be uploaded via /api/upload"
    });
  }

  const updates = {};

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = price;
  if (image_url !== undefined) updates.image_url = image_url;
  if (category_id !== undefined) updates.category_id = category_id;
  if (available !== undefined) updates.available = available;

  try {
    const { data, error } = await supabase
      .from('food_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    // See the note in /menu/:id/availability: PGRST116 here means no menu item
    // has this id.
    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Menu item not found" });
      }

      throw error;
    }

    emitMenuUpdate();

    res.json(data);
  } catch (err) {
    console.error('Update menu item error:', err);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// ---------- Permanent Delete Menu ----------
router.delete('/menu/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('food_items')
      .delete()
      .eq('id', id);


    if (error) throw error;

    emitMenuUpdate();

    res.json({
      success: true,
      message: 'Item permanently deleted'
    });


  } catch (err) {
    console.error('Delete menu item error:', err);

    res.status(500).json({
      error: 'Failed to delete menu item'
    });

  }
});

export default router;