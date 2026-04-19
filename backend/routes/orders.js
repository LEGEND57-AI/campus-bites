import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Fetch current prices for all items
    const itemIds = items.map(item => item.foodItemId);
    const { data: foodItems, error: fetchError } = await supabase
      .from('food_items')
      .select('id, price, name')
      .in('id', itemIds);

    if (fetchError) throw fetchError;

    let totalAmount = 0;
    const orderItemsWithPrices = items.map(item => {
      const foodItem = foodItems.find(fi => fi.id === item.foodItemId);
      const priceAtTime = foodItem.price;
      totalAmount += priceAtTime * item.quantity;
      return {
        food_item_id: item.foodItemId,
        quantity: item.quantity,
        price_at_time: priceAtTime
      };
    });

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: req.user.id,
        total_amount: totalAmount,
        status: 'Pending'
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItemsWithOrderId = orderItemsWithPrices.map(item => ({
      ...item,
      order_id: order.id
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) throw itemsError;

    res.status(201).json({ order, totalAmount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          price_at_time,
          food_items (id, name, image_url)
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