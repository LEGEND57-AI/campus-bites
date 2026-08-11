import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { generateDailyToken } from "../utils/tokenGenerator.js";
import { orderLimiter } from "../middleware/rateLimiter.js";
import { createNotification } from "../utils/notificationService.js";
import {
  emitOrderUpdate,
  emitAdminOrderUpdate,
  emitNotification,
} from "../socket/emitters.js";

const router = express.Router();
router.use(orderLimiter);

router.use(authenticate);

router.post('/', async (req, res) => {
  try {

    const requestStart = performance.now();

    const { items, paymentMethod } = req.body;

    const validationStart = performance.now();

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        error: 'Cart is empty'
      });
    }

    if (items.length > 10) {
      return res.status(400).json({
        error: "Maximum 10 items allowed in one order."
      });
    }


    // Temporary block online payment
    if (paymentMethod === "RAZORPAY") {
      return res.status(400).json({
        error: "Online payment is coming soon"
      });
    }

    // Validate each item
    for (const item of items) {
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10
      ) {
        return res.status(400).json({
          error: "Invalid quantity. Quantity must be between 1 and 10."
        });
      }

      if (!Number.isInteger(item.foodItemId)) {
        return res.status(400).json({
          error: "Invalid food item."
        });
      }
    }

    const uniqueItems = new Set();

    for (const item of items) {
      if (uniqueItems.has(item.foodItemId)) {
        return res.status(400).json({
          error: "Duplicate food items are not allowed."
        });
      }

      uniqueItems.add(item.foodItemId);
    }

    console.log(
      "Validation:",
      (performance.now() - validationStart).toFixed(2),
      "ms"
    );

    // Get latest food prices
    const itemIds = items.map(item => item.foodItemId);

    const foodQueryStart = performance.now();

    const { data: foodItems, error: fetchError } =
      await supabase
        .from('food_items')
        .select('id, price, name, available')
        .in('id', itemIds);


    if (fetchError) throw fetchError;

    console.log(
      "Food Query:",
      (performance.now() - foodQueryStart).toFixed(2),
      "ms"
    );

    const foodMap = new Map(
      foodItems.map(food => [
        food.id,
        food
      ])
    );


    let totalAmount = 0;


    const orderItemsWithPrices = items.map(item => {

      const foodItem =
        foodMap.get(item.foodItemId);


      if (!foodItem) {
        throw new Error("Food item not found");
      }

      if (!foodItem.available) {
        throw new Error(`${foodItem.name} is currently unavailable`);
      }

      totalAmount += foodItem.price * item.quantity;


      return {
        food_item_id: item.foodItemId,
        quantity: item.quantity,
        price_at_time: foodItem.price
      };

    });

    if (totalAmount > 3000) {
      return res.status(400).json({
        error: "Maximum order value is ₹3000."
      });
    }

    const tokenStart = performance.now();

    // Generate daily token
    const {
      token_number,
      token_date
    } = await generateDailyToken();

    console.log(
      "Token:",
      (performance.now() - tokenStart).toFixed(2),
      "ms"
    );

    const orderInsertStart = performance.now();

    // Create the CASH order and its order_items atomically in one
    // transaction via the create_cash_order_with_items RPC — either
    // both are committed together or neither is.
    const { data: order, error: orderError } = await supabase.rpc(
      "create_cash_order_with_items",
      {
        p_user_id: req.user.id,
        p_total_amount: totalAmount,
        p_token_number: token_number,
        p_token_date: token_date,
        // Payment expires after 15 minutes
        p_payment_due_at: new Date(
          Date.now() + 15 * 60 * 1000
        ).toISOString(),
        p_items: orderItemsWithPrices
      }
    );

    console.log(
      "Order Insert:",
      (performance.now() - orderInsertStart).toFixed(2),
      "ms"
    );

    if (orderError) {

      // Unique token conflict
      if (orderError.code === "23505") {
        return res.status(409).json({
          error: "Token conflict. Please place your order again.",
        });
      }

      throw orderError;
    }

    const notificationStart = performance.now();

    const notification = await createNotification({
      userId: req.user.id,
      title: "Order Placed",
      message: "Your order has been placed successfully.",
      type: "order_placed",
      priority: "medium",
      orderId: order.id,
      tokenNumber: order.token_number,
      actionUrl: `/track-order/${order.id}`,
    });

    console.log(
      "Notification:",
      (performance.now() - notificationStart).toFixed(2),
      "ms"
    );

    
    emitOrderUpdate(req.user.id, order);
    emitAdminOrderUpdate(order);
    
    console.log(
      "TOTAL:",
      (performance.now() - requestStart).toFixed(2),
      "ms"
    );

    res.status(201).json({
      success: true,
      message: "Cash order placed successfully",
      order
    });


  } catch (error) {

    console.error("Order Error:", error);

    const clientErrors = [
      "Food item not found",
      "Duplicate food items are not allowed.",
      "Order amount exceeds maximum allowed limit."
    ];

    if (
      clientErrors.includes(error.message) ||
      error.message.includes("currently unavailable")
    ) {
      return res.status(400).json({
        error: error.message
      });
    }

    return res.status(500).json({
      error: "Failed to place order"
    });

  }
});

router.patch("/:id/cancel", async (req, res) => {
  try {

    const { id } = req.params;

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (error || !order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    if (order.status !== "Pending") {
      return res.status(400).json({
        error: "Only pending orders can be cancelled.",
      });
    }

    if (
      order.payment_method !== "CASH" ||
      order.payment_status !== "PENDING"
    ) {
      return res.status(400).json({
        error: "This order cannot be cancelled.",
      });
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "Cancelled",
        payment_status: "CANCELLED",
        cancel_reason: "Cancelled by Customer",
        cancelled_by: "CUSTOMER",
      })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .eq("status", "Pending")
      .eq("payment_status", "PENDING")
      .eq("payment_method", "CASH")
      .select()
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updatedOrder) {
      return res.status(409).json({
        error: "Order was modified concurrently. Please refresh and try again.",
      });
    }

    res.json({
      success: true,
      message: "Order cancelled successfully.",
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to cancel order.",
    });

  }
});

router.get("/:id", async (req, res) => {
  try {

    const { id } = req.params;

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          id,
          quantity,
          price_at_time,
          food_items (
            id,
            name,
            image_url
          )
        )
      `)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (error || !order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    res.json(order);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to fetch order",
    });

  }
});

router.get("/", async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: orders,
      error,
      count,
    } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          id,
          quantity,
          price_at_time,
          food_items (
            id,
            name,
            image_url
          )
        )
            `,
        {
          count: "exact",
        }
      )
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.json({
      page,
      limit,

      total: count,

      hasMore: to + 1 < count,

      orders,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Failed to fetch orders",
    });

  }
});

export default router;