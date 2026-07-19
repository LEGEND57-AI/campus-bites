import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/admin.js';
import { adminLimiter } from "../middleware/rateLimiter.js";
import { autoCancelExpiredCashOrders } from "../utils/autoCancelOrders.js";

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

    const { error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    res.json({
      success: true,
      status
    });
  } catch (err) {
    console.error('Order status update error:', err);
    res.status(500).json({ error: err.message });
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