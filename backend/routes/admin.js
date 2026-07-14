import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/admin.js';
import { adminLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
router.use(adminLimiter);
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
    const { range, from, to } = req.query;

    let startDate = new Date();
    let endDate = new Date();

    const isCustom = Boolean(from && to);

    if (isCustom) {

      startDate = new Date(from);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);

      // cap custom range at ~3 months, same limit enforced on frontend
      const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays > 92) {
        return res.status(400).json({ error: 'Date range cannot exceed 3 months' });
      }

      if (startDate > endDate) {
        return res.status(400).json({ error: 'Start date must be before end date' });
      }

    } else {

      const activeRange = range || 'today';

      if (activeRange === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (activeRange === '7days') {
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
      } else if (activeRange === '30days') {
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
      }

      endDate.setHours(23, 59, 59, 999);

    }

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // ---------- Orders Today (within selected range) ----------
    const { count: ordersToday } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    // ---------- Revenue ----------
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'Ready')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    const totalRevenue =
      revenueData?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

    // ---------- Active Orders ----------
    const { count: activeOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Pending', 'Accepted', 'Preparing'])
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    // ---------- Order Items (within selected range) ----------
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        quantity,
        created_at,
        food_items(name, category_id)
      `)
      .not('food_items', 'is', null)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

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
      .gte('created_at', startISO)
      .lte('created_at', endISO);

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
    // Build a map for every day between startDate and endDate (inclusive)
    const dateMap = new Map();

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const key = d.toISOString().split('T')[0];
      dateMap.set(key, 0);
    }

    const { data: allOrders } = await supabase
      .from('orders')
      .select('created_at, total_amount')
      .eq('status', 'Ready')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

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