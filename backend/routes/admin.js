import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/admin.js';
import { adminLimiter } from "../middleware/rateLimiter.js";
import { autoCancelExpiredCashOrders } from "../utils/autoCancelOrders.js";
import { createNotification } from "../utils/notificationService.js";
import { razorpay } from "../utils/razorpay.js";
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


// ---------- Orders ----------
router.get('/orders', async (req, res) => {
  try {

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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
      `);

    if (req.query.all !== 'true') {
      query = query
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());
    }

    const { data, error } = await query
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
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

    if (fetchError) throw fetchError;

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

    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAID',
        status: 'Accepted'
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
      title: "Order Accepted",
      message: `Your Token #${data.token_number} has been accepted.`,
      type: "order_confirmed",
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
const ALLOWED_STATUS_TRANSITIONS = {
  Pending: ["Accepted", "Rejected"],
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

    if (fetchError) throw fetchError;

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

    const { data: order, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .eq("status", existingOrder.status)
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
      case "Accepted":
        title = "Order Accepted";
        message = `Your order has been accepted.`;
        notificationType = "order_confirmed";
        break;

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
router.post("/orders/:id/refund", async (req, res) => {
  const { id } = req.params;

  const {
    refundType,
    refundReason,
    refundedItems = [],
  } = req.body;

  if (!["full", "partial"].includes(refundType)) {
    return res.status(400).json({
      error: "Invalid refund type",
    });
  }

  if (!refundReason) {
    return res.status(400).json({
      error: "Refund reason is required",
    });
  }

  // Set once this request has atomically claimed the order for refund
  // processing (refund_status NULL -> PROCESSING). Used to know whether
  // the claim needs reverting if something fails before Razorpay is called.
  let claimed = false;

  // Set once the Razorpay refund call has actually succeeded. Once true,
  // the claim must never be reverted — the money has already moved.
  let razorpaySucceeded = false;

  async function revertClaim() {
    if (!claimed) return;

    try {
      const { error: revertError } = await supabase
        .from("orders")
        .update({ refund_status: null })
        .eq("id", id)
        .eq("refund_status", "PROCESSING")
        .is("refund_id", null);

      if (revertError) {
        console.error(
          "Failed to revert refund claim after failure.",
          { orderId: id, revertError }
        );
      }
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
      .single();

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

    if (order.payment_status !== "PAID") {
      return res.status(400).json({
        error: "Payment not completed.",
      });
    }

    // Atomically claim the order for refund processing so concurrent
    // refund requests for the same order cannot both reach Razorpay.
    const { data: claimedOrder, error: claimError } = await supabase
      .from("orders")
      .update({ refund_status: "PROCESSING" })
      .eq("id", id)
      .eq("payment_method", "RAZORPAY")
      .eq("payment_status", "PAID")
      .is("refund_id", null)
      .is("refund_status", null)
      .select()
      .maybeSingle();

    if (claimError) throw claimError;

    if (!claimedOrder) {
      return res.status(400).json({
        error: "Order already refunded or a refund is already in progress.",
      });
    }

    claimed = true;

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("food_item_id, quantity, price_at_time")
      .eq("order_id", id);

    if (itemsError) throw itemsError;

    const orderItemMap = new Map(
      orderItems.map(item => [
        item.food_item_id,
        item,
      ])
    );

    let finalRefundAmount = 0;

    if (refundType === "full") {
      finalRefundAmount = Number(order.total_amount);
    } else {

      for (const item of refundedItems) {

        const dbItem = orderItemMap.get(
          item.food_item_id
        );

        if (!dbItem) {
          await revertClaim();
          return res.status(400).json({
            error: "Invalid refund item."
          });
        }

        finalRefundAmount +=
          dbItem.price_at_time * dbItem.quantity;
      }

    }

    const refund = await razorpay.payments.refund(
      order.payment_id,
      {
        amount: Math.round(finalRefundAmount * 100),
        notes: {
          refund_type: refundType,
          reason: refundReason,
        },
      }
    );

    // Money has moved on Razorpay's side. From this point the claim must
    // never be reverted, even if finalizing the DB record below fails.
    razorpaySucceeded = true;

    const refundUpdatePayload = {
      status: "Refunded",
      payment_status: "REFUNDED",
      refund_status: refund.status,
      refund_type: refundType,
      refund_reason: refundReason,
      refund_amount: finalRefundAmount,
      refund_id: refund.id,
      refunded_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("orders")
      .update(refundUpdatePayload)
      .eq("id", id)
      .eq("refund_status", "PROCESSING")
      .is("refund_id", null);

    if (updateError) {
      // Razorpay has already processed the refund — never retry the
      // Razorpay call itself. Retry only the DB finalization, once,
      // using the same guarded conditional update.
      console.error(
        "Failed to finalize refund record after Razorpay refund succeeded — attempting reconciliation.",
        { orderId: id, refundId: refund.id, updateError }
      );

      const { error: retryUpdateError } = await supabase
        .from("orders")
        .update(refundUpdatePayload)
        .eq("id", id)
        .eq("refund_status", "PROCESSING")
        .is("refund_id", null);

      if (retryUpdateError) {
        console.error(
          "Refund reconciliation retry also failed — Razorpay refund " +
          "succeeded but the order row is not finalized. Needs urgent " +
          "manual reconciliation.",
          {
            orderId: id,
            refundId: refund.id,
            refundAmount: finalRefundAmount,
            retryUpdateError,
          }
        );

        // Do not claim failure — the refund genuinely succeeded at
        // Razorpay. Skip notifications/socket emits since the order row
        // is still inconsistent; a retry via this endpoint is already
        // blocked by the claim guard, so this is not a double-refund risk.
        return res.status(200).json({
          success: true,
          message:
            "Refund was processed by Razorpay, but could not be fully recorded. Please verify this order manually.",
          refund,
        });
      }
    }

    const { data: updatedOrder } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    const notification = await createNotification({
      userId: order.user_id,
      title: "Refund Initiated",
      message: `₹${finalRefundAmount} refund has been initiated. It will be credited within 3–7 business days.`,
      type: "refund_processed",
      priority: "high",
      orderId: order.id,
      tokenNumber: order.token_number,
      actionUrl: `/track-order/${order.id}`,
    });


    emitOrderUpdate(order.user_id, updatedOrder);
    emitAdminOrderUpdate(updatedOrder);
    emitAnalyticsUpdate();

    res.json({
      success: true,
      message: "Refund processed successfully.",
      refund,
    });

  } catch (err) {
    console.error(err);

    if (!razorpaySucceeded) {
      await revertClaim();
    }

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

    if (error) throw error;

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

    if (error) throw error;

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