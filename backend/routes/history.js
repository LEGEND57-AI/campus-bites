import express from "express";
import { supabase } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";
import { adminLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.use(adminLimiter);
router.use(authenticate, isAdmin);

// ---------- Order History ----------
router.get("/", async (req, res) => {
    try {

        const { range, from, to } = req.query;

        let query = supabase
            .from("orders")
            .select(`
        *,
        user:users(id, name, email, phone),
        order_items(
            quantity,
            price_at_time,
            food_items(id, name, image_url, category_id)
        )
    `)
            .in("status", [
                "Completed",
                "Rejected",
                "Cancelled",
                "Refunded",
            ]);

        // Custom Range / Specific Date
        if (from && to) {

            query = query
                .gte("created_at", `${from}T00:00:00`)
                .lte("created_at", `${to}T23:59:59`);

        }

        const { data, error } = await query
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (err) {
        console.error("History fetch error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;