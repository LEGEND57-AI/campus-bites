import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/admin.js';

const router = express.Router();
router.use(authenticate, isAdmin);

// ---------- Orders ----------
router.get('/orders', async (req, res) => {
  try {
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
  const { status } = req.body;

  const allowed = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Rejected'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id);

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


// ---------- Advanced Analytics ----------
router.get('/analytics', async (req, res) => {
  try {
    const range = req.query.range || 'today';
    let startDate = new Date();

    if (range === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === '7days') {
      startDate.setDate(startDate.getDate() - 6);
    } else if (range === '30days') {
      startDate.setDate(startDate.getDate() - 29);
    }

    const startISO = startDate.toISOString();

    // ---------- Orders Today ----------
    const { count: ordersToday } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startISO);

    // ---------- Revenue ----------
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'Ready')
      .gte('created_at', startISO);

    const totalRevenue =
      revenueData?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

    // ---------- Active Orders ----------
    const { count: activeOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Pending', 'Accepted', 'Preparing'])
      .gte('created_at', startISO);

    // ---------- Order Items ----------
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        quantity,
        food_items(name, category_id)
      `)
      .not('food_items', 'is', null);

    // ---------- Popular / Low Items ----------
    const itemMap = new Map();

    orderItems?.forEach(item => {
      const name = item.food_items?.name;
      if (name) {
        itemMap.set(
          name,
          (itemMap.get(name) || 0) + item.quantity
        );
      }
    });

    const popularItems = Array.from(itemMap.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const lowItems = Array.from(itemMap.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 5);

    // ---------- Top Categories ----------
    const categoryMap = new Map();

    orderItems?.forEach(item => {
      const categoryId = item.food_items?.category_id;
      if (categoryId) {
        categoryMap.set(
          categoryId,
          (categoryMap.get(categoryId) || 0) + item.quantity
        );
      }
    });

    const { data: categories } = await supabase
      .from('categories')
      .select('*');

    const topCategories =
      categories?.map(category => ({
        name: category.name,
        qty: categoryMap.get(category.id) || 0
      })) || [];

    // ---------- Status Breakdown ----------
    const { data: statusData } = await supabase
      .from('orders')
      .select('status')
      .gte('created_at', startISO);

    const statusBreakdown = {
      Ready: 0,
      Preparing: 0,
      Rejected: 0,
      Pending: 0,
      Accepted: 0
    };

    statusData?.forEach(order => {
      if (statusBreakdown[order.status] !== undefined) {
        statusBreakdown[order.status]++;
      }
    });

    // ---------- Revenue By Day ----------
    const days =
      range === '30days'
        ? 30
        : range === '7days'
          ? 7
          : 1;

    const dateMap = new Map();

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const key = d.toISOString().split('T')[0];

      dateMap.set(key, 0);
    }

    const { data: allOrders } = await supabase
      .from('orders')
      .select('created_at, total_amount')
      .eq('status', 'Ready')
      .gte('created_at', startISO);

    allOrders?.forEach(order => {
      const date = order.created_at.split('T')[0];

      if (dateMap.has(date)) {
        dateMap.set(
          date,
          dateMap.get(date) + Number(order.total_amount)
        );
      }
    });

    const revenueByDay = Array.from(dateMap.entries())
      .map(([date, revenue]) => ({
        date,
        revenue: Number(revenue.toFixed(2))
      }))
      .sort(
        (a, b) =>
          new Date(a.date) - new Date(b.date)
      );

    // ---------- Final Response ----------
    res.json({
      ordersToday: ordersToday || 0,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      activeOrders: activeOrders || 0,
      popularItems,
      lowItems,
      topCategories,
      statusBreakdown,
      revenueByDay
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;