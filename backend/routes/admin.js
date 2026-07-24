import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/admin.js';
import { adminLimiter } from "../middleware/rateLimiter.js";
import { autoCancelExpiredCashOrders } from "../utils/autoCancelOrders.js";
import { createNotification } from "../utils/notificationService.js";
import { razorpay } from "../utils/razorpay.js";

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

    const { data, error } = await supabase

      .from('orders')
      .select(`
        *,
        user:users(id, name, email, phone),
        order_items (
          quantity,
          price_at_time,
          food_items (id, name, image_url, category_id)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Orders fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Receive Cash Payment ----------
router.patch('/orders/:id/payment', async (req, res) => {
  const { id } = req.params;

  try {

    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAID',
        status: 'Accepted'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;


    await createNotification({
      userId: data.user_id,
      title: "Order Accepted",
      message: `Your Token #${data.token_number} has been accepted.`,
      type: "order_confirmed",
      priority: "medium",
      orderId: data.id,
      tokenNumber: data.token_number,
      actionUrl: `/track-order/${data.id}`,
    });

    res.json({
      success: true,
      message: 'Payment received successfully',
      order: data
    });


  } catch (err) {

    console.error('Payment update error:', err);

    res.status(500).json({
      error: err.message
    });

  }

});

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
    const updates = {
      status,
    };

    if (status === "Completed") {
      updates.completed_at = new Date().toISOString();
    }

    if (status === "Rejected") {
      updates.cancel_reason = cancel_reason || "Cancelled by Admin";
      updates.cancelled_by = "ADMIN";

      // Agar payment receive nahi hua tha to payment bhi cancel
      updates.payment_status = "CANCELLED";
    }

    const { data: order, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

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
      await createNotification({
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

    res.json({
      success: true,
      status
    });
  } catch (err) {
    console.error('Order status update error:', err);
    res.status(500).json({ error: err.message });
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

    if (order.refund_id) {
      return res.status(400).json({
        error: "Order already refunded.",
      });
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("food_item_id, quantity, price_at_time")
      .eq("order_id", id);

    if (itemsError) throw itemsError;

    let finalRefundAmount = 0;

    if (refundType === "full") {
      finalRefundAmount = Number(order.total_amount);
    } else {

      for (const item of refundedItems) {

        const dbItem = orderItems.find(
          i => i.food_item_id === item.food_item_id
        );

        if (!dbItem) {
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

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "Refunded",
        refund_status: refund.status,
        refund_type: refundType,
        refund_reason: refundReason,
        refund_amount: finalRefundAmount,
        refund_id: refund.id,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) throw updateError;

    await createNotification({
      userId: order.user_id,
      title: "Refund Initiated",
      message: `₹${finalRefundAmount} refund has been initiated. It will be credited within 3–7 business days.`,
      type: "refund_processed",
      priority: "high",
      orderId: order.id,
      tokenNumber: order.token_number,
      actionUrl: `/track-order/${order.id}`,
    });

    res.json({
      success: true,
      message: "Refund processed successfully.",
      refund,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
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
    res.status(500).json({ error: err.message });
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

    res.json({
      success: true,
      item: data
    });

  } catch (err) {
    console.error('Availability update error:', err);

    res.status(500).json({
      error: err.message
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

    res.status(201).json(data);
  } catch (err) {
    console.error('Add menu item error:', err);
    res.status(500).json({ error: err.message });
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

    res.json(data);
  } catch (err) {
    console.error('Update menu item error:', err);
    res.status(500).json({ error: err.message });
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

    res.json({
      success: true,
      message: 'Item permanently deleted'
    });


  } catch (err) {
    console.error('Delete menu item error:', err);

    res.status(500).json({
      error: err.message
    });

  }
});

export default router;