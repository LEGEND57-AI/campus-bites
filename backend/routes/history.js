import express from "express";
import { supabase } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";
import { adminLimiter } from "../middleware/rateLimiter.js";
import { accountingFigures, callAccountingRpc } from "../utils/accounting.js";
import {
    ORDER_SCOPE,
    OrderSearchInputError,
    parseOrderSearchQuery,
    searchOrders,
} from "../utils/orderSearch.js";

const router = express.Router();

router.use(adminLimiter);
router.use(authenticate, isAdmin);

// ---------- Order History ----------
//
// GET /admin/history?search=&from=&to=&status=&payment_method=&page=&limit=&include_summary=
//
// Searching, filtering, sorting and pagination happen in PostgreSQL through
// the same function as the Admin Orders queue (utils/orderSearch.js,
// public.admin_order_search, scope "history"), so both screens share one set
// of search rules. Only the requested page is returned.
//
// The summary cards (counts over the date + payment window, independent of
// status and search) and the Gross / Refunds / Net figures are only computed
// when asked for: the client requests them when the window changes, not on
// every search keystroke or next page, because on a large table that count is
// the expensive part of the request.
router.get("/", async (req, res) => {
    let params;

    try {
        params = parseOrderSearchQuery(req.query, ORDER_SCOPE.HISTORY);
    } catch (err) {
        if (err instanceof OrderSearchInputError) {
            return res.status(err.status).json({ error: err.message });
        }

        console.error("History fetch error:", err?.message);
        return res.status(500).json({ error: "Failed to fetch order history" });
    }

    try {
        const [searched, accounting] = await Promise.all([
            searchOrders(ORDER_SCOPE.HISTORY, params),
            params.includeSummary
                ? callAccountingRpc("order_history_accounting", {
                    p_from: params.from,
                    p_to: params.to,
                    p_payment_method: params.paymentMethod,
                })
                : Promise.resolve(null),
        ]);

        let data = searched;

        if (!data) {
            // Pre-migration fallback: the previous history RPC (also
            // server-side and paginated).
            const { data: legacy, error } = await supabase.rpc("search_order_history", {
                p_search: params.search,
                p_from: params.from,
                p_to: params.to,
                p_statuses: params.statuses,
                p_payment_method: params.paymentMethod,
                p_page: params.page,
                p_limit: params.limit,
            });

            if (error) throw error;

            if (!legacy || !Array.isArray(legacy.orders)) {
                throw new Error("search_order_history returned an unexpected shape");
            }

            data = { ...legacy, summary: params.includeSummary ? legacy.summary : null };
        }

        if (!params.includeSummary || !data.summary) {
            return res.json({ orders: data.orders, pagination: data.pagination, summary: null });
        }

        const figures = accountingFigures(accounting, {
            legacyRevenue: data.summary.revenue,
            legacyRevenueOrders: data.summary.completed,
        });

        res.json({
            orders: data.orders,
            pagination: data.pagination,
            summary: {
                total: data.summary.total,
                completed: data.summary.completed,
                cancelled: data.summary.cancelled,
                refunded: data.summary.refunded,
                ...figures,
                // Kept for older clients: the revenue card figure, now NET.
                revenue: figures.netRevenue,
            },
        });
    } catch (err) {
        console.error("History fetch error:", err?.code, err?.message);
        res.status(500).json({ error: "Failed to fetch order history" });
    }
});

export default router;
