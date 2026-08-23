import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { generateDailyToken } from "../utils/tokenGenerator.js";
import { orderLimiter } from "../middleware/rateLimiter.js";
import { createNotification } from "../utils/notificationService.js";
import {
  MAX_ITEM_QUANTITY,
  MAX_DISTINCT_ITEMS,
} from "../utils/orderLimits.js";
import {
  emitOrderUpdate,
  emitAdminOrderUpdate,
  emitNotification,
} from "../socket/emitters.js";

const router = express.Router();
router.use(orderLimiter);

router.use(authenticate);

// Upper bound on a client-supplied idempotency key. A UUID is 36 characters;
// this leaves room for other reasonable formats while refusing arbitrarily
// large input that would only bloat the index.
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

// Same pagination bounds as routes/history.js. The default matches what
// services/api.js already sends; the ceiling exists so a client cannot ask
// for its entire order history in one response.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Canonical representation of the logical cart, used to decide whether a
// replayed idempotency key describes the same order or a different one.
//
// Only food item ids and quantities participate: sorting by id removes any
// dependence on the order items happen to arrive in, and prices are
// deliberately excluded because a menu price change between two attempts does
// not make it a different order.
function cartFingerprint(pairs) {
  return JSON.stringify(
    pairs
      .map(([foodItemId, quantity]) => [Number(foodItemId), Number(quantity)])
      .sort((a, b) => a[0] - b[0])
  );
}

router.post('/', async (req, res) => {
  try {

    const { items, paymentMethod, idempotencyKey: rawIdempotencyKey } = req.body;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        error: 'Cart is empty'
      });
    }

    if (items.length > MAX_DISTINCT_ITEMS) {
      return res.status(400).json({
        error: `Maximum ${MAX_DISTINCT_ITEMS} items allowed in one order.`
      });
    }


    // Temporary block online payment
    if (paymentMethod === "RAZORPAY") {
      return res.status(400).json({
        error: "Online payment is coming soon"
      });
    }

    // Idempotency key. Checked before any pricing or token work so a
    // malformed request is rejected cheaply. The key is only ever paired with
    // req.user.id below — a client-supplied user id is never trusted, so one
    // user's key can never collide with or claim another's.
    if (
      typeof rawIdempotencyKey !== "string" ||
      rawIdempotencyKey.trim().length === 0 ||
      rawIdempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
    ) {
      return res.status(400).json({
        error: "A valid idempotency key is required."
      });
    }

    const idempotencyKey = rawIdempotencyKey.trim();

    // Validate each item
    for (const item of items) {
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_ITEM_QUANTITY
      ) {
        return res.status(400).json({
          error: `Invalid quantity. Quantity must be between 1 and ${MAX_ITEM_QUANTITY}.`
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

    // Get latest food prices
    const itemIds = items.map(item => item.foodItemId);

    const { data: foodItems, error: fetchError } =
      await supabase
        .from('food_items')
        .select('id, price, name, available')
        .in('id', itemIds);


    if (fetchError) throw fetchError;

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

    // Generate daily token
    const {
      token_number,
      token_date
    } = await generateDailyToken();

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
        p_items: orderItemsWithPrices,
        // Uniqueness is enforced by orders_user_idempotency_key_unique
        // inside the RPC's transaction, so a replay is resolved by the
        // database rather than by a read-then-write check here.
        p_idempotency_key: idempotencyKey
      }
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

    // The RPC returns either the row it just inserted, or — when this user
    // has already used this key — the order created by the first attempt.
    // generate_daily_token() reserves a unique (token_date, token_number)
    // pair for every call, so a returned row carrying a different pair can
    // only be a pre-existing order. Comparing the pair rather than the number
    // alone matters because the daily counter restarts each day.
    const isIdempotentReplay =
      order.token_number !== token_number ||
      String(order.token_date) !== String(token_date);

    if (isIdempotentReplay) {

      const { data: existingItems, error: existingItemsError } =
        await supabase
          .from("order_items")
          .select("food_item_id, quantity")
          .eq("order_id", order.id);

      if (existingItemsError) throw existingItemsError;

      const submittedCart = cartFingerprint(
        items.map(item => [item.foodItemId, item.quantity])
      );

      const storedCart = cartFingerprint(
        (existingItems || []).map(row => [row.food_item_id, row.quantity])
      );

      if (submittedCart !== storedCart) {
        // Same key, materially different cart. Neither order is mutated and
        // nothing new is created; the caller must start a fresh attempt.
        return res.status(409).json({
          error:
            "This request was already used to place a different order. Please start a new order.",
        });
      }

      // Same key, same cart: a retry of an attempt that already succeeded.
      // Return the original order and deliberately fall short of the
      // notification and socket emits below — those already fired for the
      // first attempt and must not be repeated.
      return res.status(200).json({
        success: true,
        message: "Order already placed",
        order
      });
    }

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

    emitOrderUpdate(req.user.id, order);
    emitAdminOrderUpdate(order);

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

    // Clamped rather than trusted: an unbounded `limit` returned the caller's
    // entire order history in one response, and a negative `page` produced a
    // negative .range() offset.
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );

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