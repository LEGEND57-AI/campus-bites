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

    // Pagination
    const page = Math.max(
      parseInt(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit) || 12,
        1
      ),
      24
    );

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('food_items')
      .select(
        `
                *,
                categories (id, name)
                `,
        {
          count: 'exact',
        }
      )
      .eq('available', true);

    // Category filter
    if (categoryId && categoryId !== 'all') {
      query = query.eq(
        'category_id',
        parseInt(categoryId)
      );
    }

    // Search filter
    if (search) {
      query = query.ilike(
        'name',
        `%${search}%`
      );
    }

    // Pagination + stable ordering
    query = query
      .order('id', { ascending: true })
      .range(from, to);

    const {
      data,
      error,
      count,
    } = await query;

    if (error) throw error;

    const total = count || 0;

    const hasMore =
      from + data.length < total;

    res.json({
      items: data || [],
      page,
      limit,
      total,
      hasMore,
    });

  } catch (error) {

    console.error(
      'Food items error:',
      error
    );

    res.status(500).json({
      error: 'Failed to fetch food items',
    });
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
      .filter(item => item.available === true)
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