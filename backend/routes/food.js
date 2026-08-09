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
      .rpc('get_popular_food_items', { item_limit: 8 });

    if (error) throw error;

    const popularItems = (data || []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image_url: item.image_url,
      available: item.available,
      category_id: item.category_id,
      categories: item.category_id
        ? { id: item.category_id, name: item.category_name }
        : null,
      totalOrders: Number(item.total_orders),
    }));

    res.json(popularItems);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch popular items",
    });
  }
});

export default router;