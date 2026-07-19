import express from "express";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";
import { supabase } from "../db.js";

const router = express.Router();

router.use(authenticate, isAdmin);

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

async function fetchOrders() {

    const { data, error } = await supabase

        .from("orders")

        .select("*")

        .order("created_at", {

            ascending: false,

        });

    if (error) throw error;

    return data || [];

}

async function fetchUsers() {

    const { data, error } = await supabase

        .from("users")

        .select("*");

    if (error) throw error;

    return data || [];

}

async function fetchFoodItems() {

    const { data, error } = await supabase

        .from("food_items")

        .select("*");

    if (error) throw error;

    return data || [];

}

async function fetchCategories() {

    const { data, error } = await supabase

        .from("categories")

        .select("*");

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

        let start, end;

        if (from && to) {
            start = startOfDay(new Date(from));
            end = endOfDay(new Date(to));
        } else {
            ({ start, end } = getDateRange(range));
        }

        const [

            orders,
            users,
            foodItems,
            categories,
            orderItems,

        ] = await Promise.all([

            fetchOrders(),
            fetchUsers(),
            fetchFoodItems(),
            fetchCategories(),
            fetchOrderItems(),

        ]);

        /* =====================================================
           FILTER ORDERS
        ===================================================== */
        const filteredOrders =
            orders.filter(order => {

                const created =
                    new Date(order.created_at);

                return (

                    created >= start &&
                    created <= end

                );

            });

        const todayStart =
            startOfDay();
        const todayEnd = endOfDay();

        const todayOrders =
            orders.filter(order => {

                const created = new Date(order.created_at);

                return (
                    created >= todayStart &&
                    created <= todayEnd
                );

            });



        /* =====================================================
           ORDER STATUS
        ===================================================== */

        const activeStatuses = [

            "pending",
            "accepted",
            "preparing",
            "ready",

        ];

        const revenueStatuses = [
            "completed",
        ];

        const activeOrders =
            filteredOrders.filter(order =>
                activeStatuses.includes(
                    String(order.status || "").toLowerCase()
                )
            );

        const completedOrders =
            filteredOrders.filter(order =>
                revenueStatuses.includes(
                    String(order.status || "").toLowerCase()
                )
            );

        const cancelledOrders =
            filteredOrders.filter(order =>
                String(order.status || "").toLowerCase() === "cancelled"
            );

        const totalRevenue =
            sumRevenue(completedOrders);

        /* =====================================================
   REVENUE TREND
===================================================== */

        const revenueMap = {};
        const groupByHour =
            range === "today" ||
            range === "yesterday" ||
            (from && to);

        filteredOrders.forEach(order => {

            const created = new Date(order.created_at);

            let key;

            if (groupByHour) {

                key = `${String(created.getHours()).padStart(2, "0")}:00`;

            } else if (range === "3months") {

                key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-01`;

            } else {

                key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;

            }

            if (!revenueMap[key]) {

                revenueMap[key] = {
                    date: key,
                    revenue: 0,
                    orders: 0,
                };

            }

            revenueMap[key].orders++;

            if (
                revenueStatuses.includes(
                    String(order.status || "").toLowerCase()
                )
            ) {

                revenueMap[key].revenue += Number(order.total_amount || 0);

            }

        });

        // Last 3 months me empty months bhi show honge
        if (range === "3months") {

            for (let i = 2; i >= 0; i--) {

                const d = new Date();

                d.setMonth(d.getMonth() - i);

                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

                if (!revenueMap[key]) {

                    revenueMap[key] = {
                        date: key,
                        revenue: 0,
                        orders: 0,
                    };

                }

            }

        }

        const revenueByDay = Object.values(revenueMap).sort((a, b) => {

            if (groupByHour) {
                return Number(a.date.split(":")[0]) - Number(b.date.split(":")[0]);
            }

            return new Date(a.date) - new Date(b.date);

        });


        if (groupByHour) {

            const filled = [];

            for (let hour = 0; hour < 24; hour++) {

                const key = `${String(hour).padStart(2, "0")}:00`;

                const existing = revenueByDay.find(r => r.date === key);

                filled.push(
                    existing || {
                        date: key,
                        revenue: 0,
                        orders: 0,
                    }
                );
            }

            revenueByDay.length = 0;
            revenueByDay.push(...filled);
        }


        /* =====================================================
           STATUS BREAKDOWN
        ===================================================== */

        const statusBreakdown = {

            pending: 0,
            accepted: 0,
            preparing: 0,
            ready: 0,
            completed: 0,
            cancelled: 0,

        };

        filteredOrders.forEach(order => {

            const status =
                String(
                    order.status || ""
                ).toLowerCase();

            if (

                statusBreakdown[status] !==
                undefined

            ) {

                statusBreakdown[status]++;

            }

        });

        /* =====================================================
   TOP SELLING ITEMS
===================================================== */
        const completedOrderIds = new Set(
            filteredOrders
                .filter(order =>
                    String(order.status || "").toLowerCase() === "completed"
                )
                .map(order => order.id)
        );

        const filteredOrderItems = orderItems.filter(item =>
            completedOrderIds.has(item.order_id)
        );

        const itemMap = {};

        filteredOrderItems.forEach(item => {

            if (!item.food_items) return;

            const id =
                item.food_item_id;

            if (!itemMap[id]) {

                itemMap[id] = {

                    id,

                    name:
                        item.food_items.name,

                    category_id:
                        item.food_items.category_id,

                    quantitySold: 0,

                    revenue: 0,

                };

            }

            const quantity =
                Number(item.quantity || 0);

            const price =
                Number(item.price_at_time || 0);

            itemMap[id].quantitySold += quantity;

            itemMap[id].revenue +=
                quantity * price;

        });

        const popularItems =
            Object.values(itemMap)

                .sort(
                    (a, b) =>
                        b.quantitySold -
                        a.quantitySold
                )

                .slice(0, 10);

        popularItems.forEach(item => {
            item.qty = item.quantitySold;
        });

        /* =====================================================
           TOP CATEGORIES
        ===================================================== */

        const categoryMap = {};

        popularItems.forEach(item => {

            const category =
                categories.find(

                    c =>
                        c.id ===
                        item.category_id

                );

            const name =
                category?.name ||
                "Others";

            if (!categoryMap[name]) {

                categoryMap[name] = {

                    name,

                    quantity: 0,

                };

            }

            categoryMap[name].quantity +=
                item.quantitySold;

        });

        const topCategories =
            Object.values(categoryMap)

                .sort(
                    (a, b) =>
                        b.quantity -
                        a.quantity
                )

                .slice(0, 10);

        topCategories.forEach(category => {
            category.qty = category.quantity;
        });

        /* =====================================================
           LOW PERFORMING ITEMS
        ===================================================== */

        const lowItems =
            Object.values(itemMap)

                .filter(
                    item =>
                        item.quantitySold <= 2
                )

                .sort(
                    (a, b) =>
                        a.quantitySold -
                        b.quantitySold
                )

                .slice(0, 10);

        lowItems.forEach(item => {
            item.qty = item.quantitySold;
        });

        /* =====================================================
           RESPONSE
        ===================================================== */

        res.json({

            success: true,

            ordersToday:
                range === "today"
                    ? filteredOrders.length
                    : todayOrders.length,

            totalOrders:
                filteredOrders.length,

            totalRevenue: formatMoney(totalRevenue),

            activeOrders: activeOrders.length,

            completedOrders:
                completedOrders.length,

            cancelledOrders:
                cancelledOrders.length,

            totalCustomers:
                users.filter(
                    user =>
                        user.role ===
                        "student"
                ).length,

            totalFoodItems:
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

            revenueByDay,

            statusBreakdown,

            popularItems,

            topCategories,

            lowItems,

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

            error:
                error.message,

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

        const revenueStatuses = [
            "completed",
        ];

        const filtered =
            orders.filter(order => {

                const created =
                    new Date(order.created_at);

                return (

                    created >= start &&
                    created <= end &&

                    revenueStatuses.includes(

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

        res.status(500).json({

            success: false,

            message:
                error.message,

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

        res.status(500).json({

            success: false,

            message:
                error.message,

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

        res.status(500).json({

            success: false,

            message:
                error.message,

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

        const customerStats =
            students.map(student => {

                const customerOrders =
                    orders.filter(
                        order =>
                            order.user_id ===
                            student.id
                    );

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
                                    String(order.status || "").toLowerCase() === "completed"
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

        res.status(500).json({

            success: false,

            message:
                error.message,

        });

    }

});



/* ============================================================
   SYSTEM OVERVIEW
============================================================ */

router.get("/dashboard-summary", async (req, res) => {

    try {

        const orders = await fetchOrders();

        const todayStart = startOfDay();
        const todayEnd = endOfDay();

        const todayOrders = orders.filter(order => {

            const created = new Date(order.created_at);

            return created >= todayStart && created <= todayEnd;

        });

        const activeStatuses = [
            "pending",
            "accepted",
            "preparing",
            "ready",
        ];

        const revenueStatuses = [
            "completed",
        ];

        const activeOrders = todayOrders.filter(order =>
            activeStatuses.includes(
                String(order.status || "").toLowerCase()
            )
        );

        const completedOrders = todayOrders.filter(order =>
            revenueStatuses.includes(
                String(order.status || "").toLowerCase()
            )
        );

        const pendingOrders = todayOrders.filter(order =>
            String(order.status || "").toLowerCase() === "pending"
        );

        const preparingOrders = todayOrders.filter(order =>
            String(order.status || "").toLowerCase() === "preparing"
        );

        const readyOrders = todayOrders.filter(order =>
            String(order.status || "").toLowerCase() === "ready"
        );

        res.json({

            success: true,

            ordersToday: todayOrders.length,

            totalRevenue: formatMoney(
                sumRevenue(completedOrders)
            ),

            activeOrders: activeOrders.length,

            pendingOrders: pendingOrders.length,

            preparingOrders: preparingOrders.length,

            readyOrders: readyOrders.length,

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: error.message

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
                        String(order.status || "").toLowerCase() === "completed"
                    )
                )
            ),

            generatedAt:
                new Date().toISOString(),

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message:
                error.message,

        });

    }

});

/* ============================================================
   EXPORT
============================================================ */

export default router;