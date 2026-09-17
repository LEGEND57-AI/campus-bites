import express from "express";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";
import { supabase } from "../db.js";
import {
    istCalendarParts,
    istStartOfDay,
    istEndOfDay,
    getISTDateRange,
    istDayFromISODate,
} from "../utils/istDate.js";
import {
    buildIntradayTrend,
    buildMultiDayTrend,
} from "../utils/revenueTrend.js";
import {
    accountingFigures,
    callAccountingRpc,
} from "../utils/accounting.js";

const router = express.Router();

router.use(authenticate, isAdmin);

/* ============================================================
   ORDER STATUS CONSTANTS
============================================================ */

const ORDER_STATUS = Object.freeze({
    PENDING: "pending",
    ACCEPTED: "accepted",
    PREPARING: "preparing",
    READY: "ready",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    REJECTED: "rejected",
    REFUNDED: "refunded",
});

const ACTIVE_STATUSES = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.PREPARING,
    ORDER_STATUS.READY,
];

const REVENUE_STATUSES = [
    ORDER_STATUS.COMPLETED,
];

const CANCELLED_STATUSES = [
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.REJECTED,
];

function formatMoney(value = 0) {

    return Number(value || 0);

}

function sumRevenue(orders) {

    return orders.reduce(

        (sum, order) =>

            sum + Number(order.total_amount || 0),

        0

    );

}

/* ============================================================
   DATABASE HELPERS
============================================================ */

// Optionally scoped to a [start, end] window, which is pushed into the SQL
// query instead of being applied to every order in JavaScript afterwards.
//
// The window is computed by the IST helpers in utils/istDate.js and passed in
// as instants, so neither the Node process's nor the database's timezone can
// redefine "today".
//
// Callers that pass no window get the previous behaviour -- every order -- so
// the endpoints still relying on that are unaffected.
async function fetchOrders(start, end) {

    let query = supabase

        .from("orders")

        .select(`
    id,
    user_id,
    total_amount,
    status,
    created_at
`);

    if (start && end) {

        query = query
            .gte("created_at", new Date(start).toISOString())
            .lte("created_at", new Date(end).toISOString());

    }

    const { data, error } = await query

        .order("created_at", {

            ascending: false,

        });

    if (error) throw error;

    return data || [];

}

// Completed orders placed in [start, end], for the intraday Revenue Trend.
// Paged, because PostgREST caps a single read at 1000 rows.
//
// Legacy fallback only: with the accounting migration applied the trend's
// order rows (including refunds) come from analytics_revenue_accounting.
const TREND_PAGE_SIZE = 1000;

async function fetchCompletedOrdersInWindow(start, end) {

    const rows = [];

    for (let from = 0; ; from += TREND_PAGE_SIZE) {

        const { data, error } = await supabase
            .from("orders")
            .select("id, total_amount, created_at")
            .ilike("status", ORDER_STATUS.COMPLETED)
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString())
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + TREND_PAGE_SIZE - 1);

        if (error) throw error;

        rows.push(...(data || []));

        if (!data || data.length < TREND_PAGE_SIZE) break;

    }

    return rows;

}

async function fetchUsers() {

    const { data, error } = await supabase

        .from("users")

        .select(`
    id,
    name,
    email,
    role
`)

    if (error) throw error;

    return data || [];

}

async function fetchFoodItems() {

    const { data, error } = await supabase

        .from("food_items")

        .select(`
    id,
    available
`)

    if (error) throw error;

    return data || [];

}

async function fetchCategories() {

    const { data, error } = await supabase

        .from("categories")

        .select(`
    id,
    name
`)

    if (error) throw error;

    return data || [];

}

/* ============================================================
   JOIN ORDER ITEMS + FOOD ITEMS
============================================================ */

async function fetchOrderItems() {

    const { data, error } = await supabase

        .from("order_items")

        .select(`
            order_id,
            food_item_id,
            quantity,
            price_at_time,
            food_items (
                id,
                name,
                category_id
            )
        `);

    if (error) throw error;

    return data || [];

}

/* ============================================================
   DASHBOARD
============================================================ */

router.get("/dashboard", async (req, res) => {

    try {

        const {
            range = "7days",
            from,
            to,
        } = req.query;

        // Boundaries are resolved on the IST calendar and passed to the RPC as
        // explicit instants, so neither the Node process's nor the database's
        // timezone can redefine a day.
        let start, end, startParts, endParts;

        const fromDay = from ? istDayFromISODate(from) : null;
        const toDay = to ? istDayFromISODate(to) : null;

        if (fromDay && toDay) {
            startParts = fromDay;
            endParts = toDay;
            start = istStartOfDay(fromDay);
            end = istEndOfDay(toDay);
        } else {
            ({ start, end } = getISTDateRange(range));
            startParts = istCalendarParts(start);
            endParts = istCalendarParts(end);
        }

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: "Invalid date range.",
            });
        }

        const todayParts = istCalendarParts();
        const todayStart = istStartOfDay(todayParts);
        const todayEnd = istEndOfDay(todayParts);

        // A range covering one IST calendar day (Today, Yesterday, a specific
        // date) gets a time-of-day chart; anything longer gets a date axis.
        //
        // Previously every custom from/to range was bucketed by hour of day,
        // so a multi-day custom range summed different days into the same
        // "10:00" bucket.
        const singleDay =
            startParts.year === endParts.year &&
            startParts.month === endParts.month &&
            startParts.day === endParts.day;

        // Every count, sum, grouping and top-N is done in SQL.
        //
        // analytics_dashboard supplies the order counters and status
        // breakdown. analytics_revenue_accounting supplies Gross / Refunds /
        // Net revenue, the per-day series, the intraday order rows and the
        // item rankings, all over the same [start, end] window.
        const [{ data, error }, accounting] = await Promise.all([
            supabase.rpc("analytics_dashboard", {
                p_start: start.toISOString(),
                p_end: end.toISOString(),
                p_today_start: todayStart.toISOString(),
                p_today_end: todayEnd.toISOString(),
                p_bucket: "day",
            }),
            callAccountingRpc("analytics_revenue_accounting", {
                p_start: start.toISOString(),
                p_end: end.toISOString(),
                p_include_items: true,
                p_include_order_rows: singleDay,
            }),
        ]);

        if (error) throw error;

        if (!data) {
            throw new Error("analytics_dashboard returned no data");
        }

        const figures = accountingFigures(accounting, {
            legacyRevenue: data.totalRevenue,
            legacyRevenueOrders: data.completedOrders,
        });

        /* =====================================================
           REVENUE TREND

           The same accounting as the KPIs: every point carries
           gross, refunds and net revenue; the running line is net.
           Dated by when orders were placed (IST).
        ===================================================== */

        let revenueTrend;

        if (singleDay) {
            const orderRows = accounting
                ? accounting.orderRows || []
                : await fetchCompletedOrdersInWindow(start, end);

            revenueTrend = buildIntradayTrend(orderRows, {
                windowStart: start,
                windowEnd: end,
            });
        } else {
            revenueTrend = buildMultiDayTrend(
                accounting ? accounting.revenueByDay || [] : data.revenueByDay || [],
                { startParts, endParts }
            );
        }

        // The simplified workflow is Pending -> Preparing -> Ready ->
        // Completed. "Accepted" exists only on legacy rows, which have not
        // started preparing, so they are reported with Pending instead of as
        // a stage of their own.
        const rawBreakdown = data.statusBreakdown || {};
        const statusBreakdown = {
            pending:
                Number(rawBreakdown.pending || 0) +
                Number(rawBreakdown.accepted || 0),
            preparing: Number(rawBreakdown.preparing || 0),
            ready: Number(rawBreakdown.ready || 0),
            completed: Number(rawBreakdown.completed || 0),
            cancelled: Number(rawBreakdown.cancelled || 0),
            refunded: Number(rawBreakdown.refunded || 0),
        };

        /* =====================================================
           RESPONSE
        ===================================================== */

        res.json({

            success: true,

            // For the "today" range the selected window IS today, so the
            // range count is used -- exactly as before.
            ordersToday:
                range === "today"
                    ? Number(data.totalOrders || 0)
                    : Number(data.ordersToday || 0),

            totalOrders:
                Number(data.totalOrders || 0),

            // Gross / Refunds / Net revenue, revenue orders, AOV, failed
            // refunds, and which accounting model produced them.
            ...figures,

            // Kept for older clients: the headline revenue figure, now NET.
            totalRevenue: figures.netRevenue,

            activeOrders: Number(data.activeOrders || 0),

            completedOrders:
                Number(data.completedOrders || 0),

            cancelledOrders:
                Number(data.cancelledOrders || 0),

            totalCustomers:
                Number(data.totalCustomers || 0),

            totalFoodItems:
                Number(data.totalFoodItems || 0),

            availableItems:
                Number(data.availableItems || 0),

            unavailableItems:
                Number(data.unavailableItems || 0),

            revenueTrend,

            statusBreakdown,

            // Ranked over revenue orders (Completed or Refunded) when the
            // accounting function is available, so a refund does not remove
            // what was sold; Completed orders only otherwise.
            popularItems:
                (accounting ? accounting.popularItems : data.popularItems) || [],

            topCategories:
                (accounting ? accounting.topCategories : data.topCategories) || [],

            lowItems:
                (accounting ? accounting.lowItems : data.lowItems) || [],

        });

    }

    catch (error) {

        console.error(
            "Analytics Dashboard Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to load analytics.",

        });

    }

});

/* ============================================================
   REVENUE ANALYTICS
============================================================ */

router.get("/revenue", async (req, res) => {

    try {

        const { range = "7days" } = req.query;

        // Resolved on the IST calendar like every other analytics range.
        const { start, end } =
            getISTDateRange(range);

        const accounting = await callAccountingRpc("analytics_revenue_accounting", {
            p_start: start.toISOString(),
            p_end: end.toISOString(),
            p_include_items: false,
            p_include_order_rows: false,
        });

        let legacyRevenue = 0;
        let legacyRevenueOrders = 0;

        if (!accounting) {
            const completed = (await fetchOrders(start, end)).filter(order =>
                REVENUE_STATUSES.includes(String(order.status || "").toLowerCase())
            );

            legacyRevenue = sumRevenue(completed);
            legacyRevenueOrders = completed.length;
        }

        const figures = accountingFigures(accounting, {
            legacyRevenue,
            legacyRevenueOrders,
        });

        res.json({

            success: true,

            ...figures,

            totalRevenue: figures.netRevenue,

            revenueByDay: [],

        });

    }

    catch (error) {

        console.error("Revenue analytics error:", error);

        res.status(500).json({

            success: false,

            message:
                "Failed to load revenue analytics.",

        });

    }

});

/* ============================================================
   ORDERS ANALYTICS
============================================================ */

router.get("/orders", async (req, res) => {

    try {

        const orders =
            await fetchOrders();

        res.json({

            success: true,

            totalOrders:
                orders.length,

            orders,

        });

    }

    catch (error) {

        console.error("Orders analytics error:", error);

        res.status(500).json({

            success: false,

            message:
                "Failed to load orders analytics.",

        });

    }

});

/* ============================================================
   FOOD ANALYTICS
============================================================ */

router.get("/food", async (req, res) => {

    try {

        const foodItems =
            await fetchFoodItems();

        res.json({

            success: true,

            totalItems:
                foodItems.length,

            availableItems:
                foodItems.filter(
                    item =>
                        item.available !== false
                ).length,

            unavailableItems:
                foodItems.filter(
                    item =>
                        item.available === false
                ).length,

            items:
                foodItems,

        });

    }

    catch (error) {

        console.error("Food analytics error:", error);

        res.status(500).json({

            success: false,

            message:
                "Failed to load food analytics.",

        });

    }

});

/* ============================================================
   CUSTOMER ANALYTICS
============================================================ */

router.get("/customers", async (req, res) => {

    try {

        const users =
            await fetchUsers();

        const orders =
            await fetchOrders();

        const students =
            users.filter(
                user =>
                    user.role === "student"
            );

        const userOrdersMap = new Map();

        for (const order of orders) {

            if (!userOrdersMap.has(order.user_id)) {
                userOrdersMap.set(order.user_id, []);
            }

            userOrdersMap
                .get(order.user_id)
                .push(order);

        }

        const customerStats =
            students.map(student => {

                const customerOrders =
                    userOrdersMap.get(student.id) || [];

                return {

                    id:
                        student.id,

                    name:
                        student.name,

                    email:
                        student.email,

                    totalOrders:
                        customerOrders.length,

                    totalSpent:
                        formatMoney(
                            sumRevenue(
                                customerOrders.filter(order =>
                                    REVENUE_STATUSES.includes(
                                        String(order.status || "").toLowerCase()
                                    )
                                )
                            )
                        ),

                };

            });

        res.json({

            success: true,

            totalCustomers:
                students.length,

            customers:
                customerStats,

        });

    }

    catch (error) {

        console.error("Customer analytics error:", error);

        res.status(500).json({

            success: false,

            message:
                "Failed to load customer analytics.",

        });

    }

});



/* ============================================================
   SYSTEM OVERVIEW
============================================================ */

router.get("/dashboard-summary", async (req, res) => {

    try {

        // "Today" is the current Asia/Kolkata calendar day, resolved to
        // explicit instants and passed to the RPC -- the same contract
        // /dashboard now uses, so both admin screens always agree on which
        // day they are showing. The previous startOfDay()/endOfDay() used the
        // Node process timezone, which is unset in this project and so meant
        // IST in development but UTC on a default container.
        const todayParts = istCalendarParts();
        const todayStart = istStartOfDay(todayParts);
        const todayEnd = istEndOfDay(todayParts);

        // Counting, filtering and the revenue sums all happen in SQL. Today's
        // Gross / Refunds / Net revenue come from the same accounting function
        // and the same IST window as Analytics, so both screens agree.
        const [{ data, error }, accounting] = await Promise.all([
            supabase.rpc(
                "analytics_dashboard_summary",
                {
                    p_today_start: todayStart.toISOString(),
                    p_today_end: todayEnd.toISOString(),
                }
            ),
            callAccountingRpc("analytics_revenue_accounting", {
                p_start: todayStart.toISOString(),
                p_end: todayEnd.toISOString(),
                p_include_items: false,
                p_include_order_rows: false,
            }),
        ]);

        if (error) throw error;

        if (!data) {
            throw new Error(
                "analytics_dashboard_summary returned no data"
            );
        }

        // Legacy fallback has no Completed count here; AOV is not shown on the
        // Dashboard, so it is left at 0 in that mode.
        const figures = accountingFigures(accounting, {
            legacyRevenue: data.totalRevenue,
        });

        res.json({

            success: true,

            ordersToday: Number(data.ordersToday || 0),

            // Today's accounting (IST day of order placement).
            ...figures,

            // Kept for older clients: today's NET revenue.
            totalRevenue: figures.netRevenue,

            activeOrders: Number(data.activeOrders || 0),

            pendingOrders: Number(data.pendingOrders || 0),

            preparingOrders: Number(data.preparingOrders || 0),

            readyOrders: Number(data.readyOrders || 0),

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Failed to load dashboard summary."

        });

    }

});

router.get("/overview", async (req, res) => {

    try {

        const [

            users,
            foodItems,
            orders,
            accounting,

        ] = await Promise.all([

            fetchUsers(),
            fetchFoodItems(),
            fetchOrders(),
            // All time.
            callAccountingRpc("analytics_revenue_accounting", {
                p_start: new Date(0).toISOString(),
                p_end: new Date(Date.UTC(9999, 11, 31)).toISOString(),
                p_include_items: false,
                p_include_order_rows: false,
            }),

        ]);

        const completed = orders.filter(order =>
            REVENUE_STATUSES.includes(String(order.status || "").toLowerCase())
        );

        const figures = accountingFigures(accounting, {
            legacyRevenue: sumRevenue(completed),
            legacyRevenueOrders: completed.length,
        });

        res.json({

            success: true,

            users:
                users.length,

            foodItems:
                foodItems.length,

            orders:
                orders.length,

            ...figures,

            // Kept for older clients: NET revenue.
            revenue: figures.netRevenue,

            generatedAt:
                new Date().toISOString(),

        });

    }

    catch (error) {

        console.error("Overview analytics error:", error);

        res.status(500).json({

            success: false,

            message:
                "Failed to load analytics overview.",

        });

    }

});

/* ============================================================
   EXPORT
============================================================ */

export default router;