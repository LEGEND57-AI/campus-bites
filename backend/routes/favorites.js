import express from "express";
import { supabase } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { favoriteLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
router.use(favoriteLimiter);

router.use(authenticate);

// Get user's favorite items
router.get("/", async (req, res) => {
    try {

        const { data, error } = await supabase
            .from("favorites")
            .select(`
        id,
        food_items (
          id,
          name,
          description,
          price,
          image_url,
          available,
          category_id,
          categories (
            id,
            name
          )
        )
      `)
            .eq("user_id", req.user.id);

        if (error) throw error;

        const favorites = data.map((item) => item.food_items);

        res.json(favorites);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to fetch favorites",
        });

    }
});

// Add to favorites
router.post("/", async (req, res) => {
    try {
        const { food_item_id } = req.body;

        if (!food_item_id) {
            return res.status(400).json({
                error: "Food item id required",
            });
        }

        const { data, error } = await supabase
            .from("favorites")
            .insert({
                user_id: req.user.id,
                food_item_id,
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to add favorite",
        });

    }
});

// Remove favorite
router.delete("/:foodId", async (req, res) => {

    try {

        const { foodId } = req.params;

        const { error } = await supabase
            .from("favorites")
            .delete()
            .eq("user_id", req.user.id)
            .eq("food_item_id", foodId);

        if (error) throw error;

        res.json({
            message: "Favorite removed",
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to remove favorite",
        });

    }

});

export default router;