import express from "express";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";
import { supabase } from "../db.js";

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

/* ============================================================
   DATE HELPERS
============================================================ */

function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function getDateRange(range = "7days") {

    const now = new Date();

    let start = new Date(now);

    switch (range) {

        case "today":
            start = startOfDay(now);
            break;

        case "yesterday":

            start = new Date(now);
            start.setDate(now.getDate() - 1);
            start = startOfDay(start);

            return {
                start,
                end: endOfDay(start)
            };

        case "7days":
            start.setDate(now.getDate() - 6);
            start = startOfDay(start);
            break;

        case "3months":

            start.setMonth(now.getMonth() - 3);
            start = startOfDay(start);
            break;

        case "thismonth":

            start = new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            );

            break;

        case "thisyear":

            start = new Date(
                now.getFullYear(),
                0,
                1
            );

            break;

        default:
            start.setDate(now.getDate() - 6);
            start = startOfDay(start);

    }

    return {

        start,
        end: endOfDay(now),

    };

}

function formatMoney(value = 0) {

    return Number(value || 0);

}

/* ============================================================
   IST DATE HELPERS
   ------------------------------------------------------------
   Used only by the two RPC-backed endpoints below. The helpers
   above (startOfDay/endOfDay/getDateRange) resolve boundaries in
   the Node process's own timezone, which is unset in this project
   -- IST in development, UTC on a default Linux container. These
   helpers pin the calendar to Asia/Kolkata regardless of where the
   process runs, and hand PostgreSQL explicit instants so the
   database's timezone cannot influence the result either.
============================================================ */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The IST calendar date an instant falls on.
function istCalendarParts(instant = new Date()) {

    const shifted = new Date(instant.getTime() + IST_OFFSET_MS);

    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth(),
        day: shifted.getUTCDate(),
    };
}

// Date.UTC normalises out-of-range month/day, so { month: month - 3 } and
// { day: day - 6 } roll back across year and month boundaries correctly.
function istStartOfDay({ year, month, day }) {
    return new Date(
        Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS
    );
}

function istEndOfDay({ year, month, day }) {
    return new Date(
        Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS
    );
}

// Mirrors getDateRange()'s range semantics exactly, resolved in IST.
function getISTDateRange(range = "7days") {

    const today = istCalendarParts();

    const endOfToday = istEndOfDay(today);

    switch (range) {

        case "today":
            return { start: istStartOfDay(today), end: endOfToday };

        case "yesterday": {
            const yesterday = { ...today, day: today.day - 1 };
            return {
                start: istStartOfDay(yesterday),
                end: istEndOfDay(yesterday),
            };
        }

        case "7days":
            return {
                start: istStartOfDay({ ...today, day: today.day - 6 }),
                end: endOfToday,
            };

        case "3months":
            return {
                start: istStartOfDay({ ...today, month: today.month - 3 }),
                end: endOfToday,
            };

        case "thismonth":
            return {
                start: istStartOfDay({ ...today, day: 1 }),
                end: endOfToday,
            };

        case "thisyear":
            return {
                start: istStartOfDay({ year: today.year, month: 0, day: 1 }),
                end: endOfToday,
            };

        default:
            return {
                start: istStartOfDay({ ...today, day: today.day - 6 }),
                end: endOfToday,
            };
    }
}

// A YYYY-MM-DD string is an IST calendar date, not an instant, so it is
// parsed by component rather than by Date() -- which would read it as UTC.
function istDayFromISODate(value) {

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));

    if (!match) return null;

    return {
        year: Number(match[1]),
        month: Number(match[2]) - 1,
        day: Number(match[3]),
    };
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
// The window itself is still computed by the JS date helpers above and passed
// in as instants. That is deliberate: startOfDay()/endOfDay() use setHours(),
// so the day boundaries follow the Node process's own timezone, which SQL
// cannot observe. Recomputing them in SQL would silently redefine "today".
// Filtering on instants keeps the existing semantics exactly.
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
        // explicit instants. They previously came from setHours(), i.e. the
        // Node process timezone, so the same range meant a different day in
        // development (IST) and on a UTC container.
        let start, end;

        const fromDay = from ? istDayFromISODate(from) : null;
        const toDay = to ? istDayFromISODate(to) : null;

        if (fromDay && toDay) {
            start = istStartOfDay(fromDay);
            end = istEndOfDay(toDay);
        } else {
            ({ start, end } = getISTDateRange(range));
        }

        const todayParts = istCalendarParts();
        const todayStart = istStartOfDay(todayParts);
        const todayEnd = istEndOfDay(todayParts);

        // Same bucketing rule the JS aggregation applied.
        const groupByHour =
            range === "today" ||
            range === "yesterday" ||
            Boolean(fromDay && toDay);

        const bucket = groupByHour
            ? "hour"
            : range === "3months"
                ? "month"
                : "day";

        // Every count, sum, grouping and top-N is now done in SQL.
        //
        // The previous implementation fetched all orders in the window plus
        // the ENTIRE order_items table (with joined food_items) and aggregated
        // in JavaScript. PostgREST silently caps those reads at 1000 rows, so
        // any range holding more than 1000 orders -- and the top/low item
        // figures for every range, because order_items has 2014 rows -- was
        // computed from partial data.
        const { data, error } = await supabase.rpc("analytics_dashboard", {
            p_start: start.toISOString(),
            p_end: end.toISOString(),
            p_today_start: todayStart.toISOString(),
            p_today_end: todayEnd.toISOString(),
            p_bucket: bucket,
        });

        if (error) throw error;

        if (!data) {
            throw new Error("analytics_dashboard returned no data");
        }

        /* =====================================================
           ZERO-FILL

           Presentation only, and deliberately still in Node: the
           RPC returns the buckets that actually have orders, and
           the back-fill below is unchanged from the previous
           implementation.
        ===================================================== */

        let revenueByDay = (data.revenueByDay || []).map(entry => ({
            date: entry.date,
            revenue: Number(entry.revenue || 0),
            orders: Number(entry.orders || 0),
        }));

        // Last 3 months me empty months bhi show honge
        if (range === "3months") {

            const seen = new Set(
                revenueByDay.map(entry => entry.date)
            );

            for (let i = 2; i >= 0; i--) {

                const month = new Date(
                    Date.UTC(todayParts.year, todayParts.month - i, 1, 12)
                );

                const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-01`;

                if (!seen.has(key)) {

                    revenueByDay.push({
                        date: key,
                        revenue: 0,
                        orders: 0,
                    });

                    seen.add(key);

                }

            }

        }

        if (groupByHour) {

            const filled = [];

            for (let hour = 0; hour < 24; hour++) {

                const key = `${String(hour).padStart(2, "0")}:00`;

                filled.push(
                    revenueByDay.find(entry => entry.date === key) || {
                        date: key,
                        revenue: 0,
                        orders: 0,
                    }
                );

            }

            revenueByDay = filled;

        } else {

            revenueByDay.sort(
                (a, b) => new Date(a.date) - new Date(b.date)
            );

        }

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

            totalRevenue: formatMoney(data.totalRevenue),

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

            revenueByDay,

            statusBreakdown: data.statusBreakdown,

            popularItems: data.popularItems || [],

            topCategories: data.topCategories || [],

            lowItems: data.lowItems || [],

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

        const { start, end } =
            getDateRange(range);

        const orders =
            await fetchOrders();

        const filtered =
            orders.filter(order => {

                const created =
                    new Date(order.created_at);

                return (

                    created >= start &&
                    created <= end &&

                    REVENUE_STATUSES.includes(

                        String(
                            order.status || ""
                        ).toLowerCase()

                    )

                );

            });

        res.json({

            success: true,

            totalRevenue:
                formatMoney(
                    sumRevenue(filtered)
                ),

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

        // Counting, filtering and the revenue sum all happen in SQL now.
        // Nothing is fetched into Node to be counted.
        const { data, error } = await supabase.rpc(
            "analytics_dashboard_summary",
            {
                p_today_start: todayStart.toISOString(),
                p_today_end: todayEnd.toISOString(),
            }
        );

        if (error) throw error;

        if (!data) {
            throw new Error(
                "analytics_dashboard_summary returned no data"
            );
        }

        res.json({

            success: true,

            ordersToday: Number(data.ordersToday || 0),

            totalRevenue: formatMoney(data.totalRevenue),

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

        ] = await Promise.all([

            fetchUsers(),
            fetchFoodItems(),
            fetchOrders(),

        ]);

        res.json({

            success: true,

            users:
                users.length,

            foodItems:
                foodItems.length,

            orders:
                orders.length,

            revenue: formatMoney(
                sumRevenue(
                    orders.filter(order =>
                        REVENUE_STATUSES.includes(
                            String(order.status || "").toLowerCase()
                        )
                    )
                )
            ),

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