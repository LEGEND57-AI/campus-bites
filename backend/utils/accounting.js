// Revenue accounting shared by Analytics, the Admin Dashboard and Order History.
//
// Definitions (implemented in SQL, see
// supabase/migrations/20260917120000_net_revenue_accounting.sql):
//
//   Revenue orders  status Completed, or status Refunded
//   Gross revenue   SUM(total_amount) of revenue orders
//   Refunds         successful (Razorpay "processed") refund amounts of those
//                   orders; failed refunds are not refunds
//   Net revenue     Gross revenue - Refunds
//   AOV             Net revenue / revenue orders
//
// All figures are dated by when the order was placed, on the IST calendar.
//
// Until the migration has been applied the accounting functions do not exist.
// The callers then fall back to their previous figures (Completed orders only,
// no refund data) and report accountingModel "legacy", so deploying this code
// before the migration cannot break any screen.

import { supabase } from "../db.js";
import { numericToPaise, formatPaise } from "./money.js";

export const ACCOUNTING_MODEL = Object.freeze({
    NET: "net",
    LEGACY: "legacy",
});

// PostgREST: function not found in the schema cache / Postgres: undefined function.
const MISSING_FUNCTION_CODES = new Set(["PGRST202", "42883"]);

const warned = new Set();

function warnMissingOnce(name) {
    if (warned.has(name)) return;
    warned.add(name);

    console.warn(
        `[accounting] ${name} is not available; reporting legacy revenue ` +
        "figures (Completed orders only, no refund accounting). Apply " +
        "supabase/migrations/20260917120000_net_revenue_accounting.sql."
    );
}

// Calls an accounting RPC. Resolves to its data, or to null when the function
// does not exist yet (migration not applied). Any other error is thrown.
export async function callAccountingRpc(name, params) {
    const { data, error } = await supabase.rpc(name, params);

    if (error) {
        if (MISSING_FUNCTION_CODES.has(error.code)) {
            warnMissingOnce(name);
            return null;
        }

        throw error;
    }

    if (!data || typeof data !== "object") {
        throw new Error(`${name} returned no data`);
    }

    return data;
}

export const toRupeeNumber = (value) => {
    const paise = numericToPaise(value ?? 0);
    return paise === null ? 0 : paise / 100;
};

// AOV in rupees, computed in paise so the division never accumulates float
// error: Net revenue / revenue orders, 0 when there are none.
export function averageOrderValue(netRevenue, revenueOrders) {
    const orders = Number(revenueOrders) || 0;
    const netPaise = numericToPaise(netRevenue ?? 0) ?? 0;

    if (orders <= 0) return 0;

    return Number(formatPaise(Math.round(netPaise / orders)));
}

/**
 * The accounting block every revenue response carries.
 *
 * @param {object|null} accounting  analytics_revenue_accounting /
 *                                  order_history_accounting result, or null
 * @param {{ legacyRevenue: number, legacyRevenueOrders: number }} legacy
 *        the caller's previous figures, used only when accounting is null
 */
export function accountingFigures(accounting, { legacyRevenue = 0, legacyRevenueOrders = 0 } = {}) {
    if (!accounting) {
        const gross = toRupeeNumber(legacyRevenue);
        const orders = Number(legacyRevenueOrders) || 0;

        return {
            accountingModel: ACCOUNTING_MODEL.LEGACY,
            grossRevenue: gross,
            refunds: 0,
            netRevenue: gross,
            revenueOrders: orders,
            avgOrderValue: averageOrderValue(gross, orders),
            failedRefunds: 0,
        };
    }

    const grossPaise = numericToPaise(accounting.grossRevenue ?? 0) ?? 0;
    const refundPaise = Math.min(
        Math.max(numericToPaise(accounting.refunds ?? 0) ?? 0, 0),
        grossPaise
    );
    const netPaise = grossPaise - refundPaise;
    const orders = Number(accounting.revenueOrders) || 0;

    return {
        accountingModel: ACCOUNTING_MODEL.NET,
        grossRevenue: grossPaise / 100,
        refunds: refundPaise / 100,
        netRevenue: netPaise / 100,
        revenueOrders: orders,
        avgOrderValue: averageOrderValue(netPaise / 100, orders),
        failedRefunds: Number(accounting.failedRefunds) || 0,
    };
}
