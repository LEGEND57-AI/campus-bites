import express from "express";
import { supabase } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";
import { adminLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.use(adminLimiter);
router.use(authenticate, isAdmin);

// Matches the orders list in routes/orders.js, the closest analogue.
const DEFAULT_PAGE_SIZE = 20;

// Upper bound so a client cannot ask for the entire history in one page.
// The RPC clamps to the same value independently; this is not the only guard.
const MAX_PAGE_SIZE = 100;

// The only statuses this endpoint may expose. The RPC intersects whatever it
// is given with the same list, so a bad value here cannot widen the result.
const TERMINAL_STATUSES = [
    "Completed",
    "Rejected",
    "Cancelled",
    "Refunded",
];

const PAYMENT_METHODS = ["CASH", "RAZORPAY"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Order History ----------
//
// Searching, filtering, sorting, pagination and the summary aggregates all
// happen inside the search_order_history RPC. They cannot be split: paginating
// a result set that is then searched in the browser silently hides matches
// that live on pages nobody has scrolled to, and summary cards computed from
// loaded pages alone would climb as the admin scrolls.
//
// The search is a single OR spanning orders and users, which PostgREST cannot
// express against an embedded resource -- that is why this is an RPC call
// rather than a query builder chain.
router.get("/", async (req, res) => {
    try {

        const {
            search,
            from,
            to,
            status,
            payment_method: paymentMethod,
            page: rawPage,
            limit: rawLimit,
        } = req.query;

        // Dates arrive as plain YYYY-MM-DD and are interpreted in IST by the
        // RPC. Anything else is rejected rather than guessed at.
        for (const [name, value] of [["from", from], ["to", to]]) {
            if (value !== undefined && value !== "" && !ISO_DATE.test(value)) {
                return res.status(400).json({
                    error: `Invalid ${name} date. Expected YYYY-MM-DD.`,
                });
            }
        }

        let statuses = null;

        if (status !== undefined && status !== "") {
            statuses = String(status)
                .split(",")
                .map((entry) => entry.trim())
                .filter((entry) => TERMINAL_STATUSES.includes(entry));

            // The caller asked to narrow by status but named nothing this
            // endpoint serves. Falling through would silently return every
            // status instead, so reject it.
            if (statuses.length === 0) {
                return res.status(400).json({
                    error: "Invalid status filter",
                });
            }
        }

        if (
            paymentMethod !== undefined &&
            paymentMethod !== "" &&
            !PAYMENT_METHODS.includes(paymentMethod)
        ) {
            return res.status(400).json({
                error: "Invalid payment_method filter",
            });
        }

        const page = Math.max(parseInt(rawPage, 10) || 1, 1);

        const limit = Math.min(
            Math.max(parseInt(rawLimit, 10) || DEFAULT_PAGE_SIZE, 1),
            MAX_PAGE_SIZE
        );

        const { data, error } = await supabase.rpc("search_order_history", {
            p_search: search ? String(search) : null,
            p_from: from || null,
            p_to: to || null,
            p_statuses: statuses,
            p_payment_method: paymentMethod || null,
            p_page: page,
            p_limit: limit,
        });

        if (error) throw error;

        // The RPC always returns the full envelope; a null here would mean the
        // function silently changed shape, which the caller cannot recover
        // from, so fail loudly rather than send a half-empty page.
        if (!data || !Array.isArray(data.orders)) {
            throw new Error("search_order_history returned an unexpected shape");
        }

        res.json(data);
    } catch (err) {
        console.error("History fetch error:", err?.code, err?.message);
        res.status(500).json({ error: "Failed to fetch order history" });
    }
});

export default router;
