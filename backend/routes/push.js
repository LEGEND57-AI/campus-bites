import express from "express";
import { authenticate } from "../middleware/auth.js";
import { supabase } from "../db.js";

const router = express.Router();

router.get("/public-key", (req, res) => {

    res.json({

        publicKey:
            process.env.VAPID_PUBLIC_KEY,

    });

});

// 🔒 Authentication starts here
router.use(authenticate);


router.post("/subscribe", async (req, res) => {
    try {
        console.log("📲 Push subscription request received");

        const { endpoint, keys } = req.body;

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({
                error: "Invalid subscription",
            });
        }

        const { error } = await supabase
            .from("push_subscriptions")
            .upsert({
                user_id: req.user.id,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
            });

        if (error) throw error;

        res.json({
            success: true,
        });

    }  catch (err) {

        console.error("❌ PUSH SUBSCRIBE ERROR:", {
            message: err.message,
            code: err.code,
            details: err.details,
            hint: err.hint,
        });

        res.status(500).json({
            error: "Failed to save subscription",
        });
    }
});

export default router;