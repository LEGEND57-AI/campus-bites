import express from 'express';
import { supabase } from '../db.js';

const router = express.Router();

router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('id');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/items', async (req, res) => {
  try {
    const { categoryId, search } = req.query;

    let query = supabase
      .from('food_items')
      .select(`
        *,
        categories (id, name)
      `)
      .eq('available', true);

    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', parseInt(categoryId));
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch food items' });
  }
});

router.get('/popular', async (req, res) => {
  try {

    const { data, error } = await supabase
      .from('order_items')
      .select(`
        quantity,
        food_items (
          id,
          name,
          price,
          image_url,
          available,
          category_id,
          categories (
            id,
            name
          )
        )
      `);

    if (error) throw error;

    const itemMap = {};

    data.forEach((order) => {

      const item = order.food_items;

      if (!item) return;

      if (!itemMap[item.id]) {
        itemMap[item.id] = {
          ...item,
          totalOrders: 0,
        };
      }

      itemMap[item.id].totalOrders += order.quantity;

    });

    const popularItems = Object.values(itemMap)
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 8);

    res.json(popularItems);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch popular items",
    });
  }
});

export default router;