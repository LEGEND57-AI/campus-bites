import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { generateDailyToken } from "../utils/tokenGenerator.js";
import { orderLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
router.use(orderLimiter);

router.use(authenticate);

router.post('/', async (req, res) => {
  try {

    const { items, paymentMethod } = req.body;

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
        item.quantity > 20
      ) {
        return res.status(400).json({
          error: "Invalid quantity. Quantity must be between 1 and 20."
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


    let totalAmount = 0;


    const orderItemsWithPrices = items.map(item => {

      const foodItem = foodItems.find(
        fi => fi.id === item.foodItemId
      );


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

    if (totalAmount > 5000) {
      return res.status(400).json({
        error: "Order amount exceeds maximum allowed limit."
      });
    }

    // Generate daily token
    const {
      token_number,
      token_date
    } = await generateDailyToken();

    // Create CASH order
    const { data: order, error: orderError } =
      await supabase
        .from('orders')
        .insert([
          {
            user_id: req.user.id,
            total_amount: totalAmount,
            status: "Pending",
            payment_method: "CASH",
            payment_status: "PENDING",
            token_number,
            token_date,
          }
        ])
        .select()
        .single();


    if (orderError) throw orderError;


    // Add order items
    const orderItemsWithOrderId =
      orderItemsWithPrices.map(item => ({
        ...item,
        order_id: order.id
      }));


    const { error: itemsError } =
      await supabase
        .from('order_items')
        .insert(orderItemsWithOrderId);


    if (itemsError) throw itemsError;


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

router.get('/', async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
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
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

export default router;