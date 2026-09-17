-- =====================================================================
-- CampusCraves: Gross / Refunds / Net revenue accounting
-- =====================================================================
--
-- ADDITIVE ONLY. This migration creates new functions and does not replace,
-- alter or drop any existing function, table, policy or row. The existing
-- analytics_dashboard, analytics_dashboard_summary and search_order_history
-- functions keep working exactly as before; the backend reads the accounting
-- figures from the functions below and falls back to the previous figures
-- until this migration has been applied.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.order_history_accounting(date, date, text);
--   DROP FUNCTION IF EXISTS public.analytics_revenue_accounting(timestamptz, timestamptz, boolean, boolean);
--   DROP FUNCTION IF EXISTS public.order_successful_refund(text, text, numeric, numeric, boolean, text);
--   DROP FUNCTION IF EXISTS public.order_is_revenue(text, text, boolean);
--
-- ---------------------------------------------------------------------
-- Accounting model
-- ---------------------------------------------------------------------
--
-- Revenue order   An order with status Completed, or status Refunded (a
--                 refund was recorded against its captured payment).
--                 A Refunded row whose refund FAILED only counts when the
--                 order had completed (completed_at is set); the backend's
--                 refund.failed handling moves such orders back out of
--                 Refunded, so this only matters for rows recorded before it.
--
-- Gross revenue   SUM(total_amount) of revenue orders.
--
-- Refunds         SUM(refund_amount) of revenue orders whose refund Razorpay
--                 reports as processed (refund_status = 'processed'), capped
--                 at the order total. A failed refund (or any refund not
--                 reported processed) is NOT a refund for accounting.
--
-- Net revenue     Gross revenue - Refunds.
--
-- Revenue orders  COUNT of revenue orders (the AOV denominator).
--
-- Dates           Every figure is dated by orders.created_at (when the order
--                 was placed). Callers pass explicit IST instants/dates, as
--                 the existing analytics functions do. A refund is therefore
--                 attributed to the day the ORDER was placed, not the day the
--                 refund was made.
-- ---------------------------------------------------------------------


-- Whether an order counts toward gross revenue.
CREATE OR REPLACE FUNCTION public.order_is_revenue(
    p_status        text,
    p_refund_status text,
    p_has_completed boolean
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT lower(coalesce(p_status, '')) = 'completed'
        OR (
               lower(coalesce(p_status, '')) = 'refunded'
           AND (
                   lower(coalesce(p_refund_status, '')) <> 'failed'
                OR coalesce(p_has_completed, false)
               )
           );
$function$;


-- The successfully refunded amount of an order for accounting: the recorded
-- refund amount once Razorpay reports it processed, capped at the order total,
-- and 0 for anything that is not a revenue order.
CREATE OR REPLACE FUNCTION public.order_successful_refund(
    p_status        text,
    p_refund_status text,
    p_refund_amount numeric,
    p_total_amount  numeric,
    p_has_completed boolean,
    p_refund_id     text
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT CASE
        WHEN public.order_is_revenue(p_status, p_refund_status, p_has_completed)
         AND p_refund_id IS NOT NULL
         AND lower(coalesce(p_refund_status, '')) = 'processed'
        THEN LEAST(GREATEST(coalesce(p_refund_amount, 0), 0), coalesce(p_total_amount, 0))
        ELSE 0
    END;
$function$;


-- Accounting for an analytics window [p_start, p_end] (inclusive, like
-- analytics_dashboard).
--
--   p_include_items       popularItems / topCategories / lowItems, computed
--                         over revenue orders with the same shapes and the
--                         same truncation rules as analytics_dashboard.
--   p_include_order_rows  one row per revenue order (placed time, gross,
--                         successful refund) for the intraday Revenue Trend.
--                         Intended for single-day windows.
CREATE OR REPLACE FUNCTION public.analytics_revenue_accounting(
    p_start               timestamptz,
    p_end                 timestamptz,
    p_include_items       boolean DEFAULT true,
    p_include_order_rows  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    WITH scoped AS (
        SELECT
            o.id,
            o.created_at,
            o.total_amount,
            lower(coalesce(o.refund_status, '')) AS rs,
            o.refund_id,
            public.order_is_revenue(o.status, o.refund_status, o.completed_at IS NOT NULL) AS is_revenue,
            public.order_successful_refund(
                o.status, o.refund_status, o.refund_amount, o.total_amount,
                o.completed_at IS NOT NULL, o.refund_id
            ) AS refund
        FROM public.orders o
        WHERE o.created_at >= p_start
          AND o.created_at <= p_end
    ),
    rev AS (
        SELECT * FROM scoped WHERE is_revenue
    ),
    totals AS (
        SELECT
            coalesce(sum(total_amount), 0)                                   AS gross,
            coalesce(sum(refund), 0)                                         AS refunds,
            count(*)                                                         AS revenue_orders,
            count(*) FILTER (WHERE refund > 0)                               AS refunded_orders,
            count(*) FILTER (WHERE refund > 0 AND refund < total_amount)     AS partial_refunds
        FROM rev
    ),
    failed AS (
        SELECT count(*) AS failed_refunds
        FROM scoped
        WHERE refund_id IS NOT NULL AND rs = 'failed'
    ),
    days AS (
        SELECT
            to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
            sum(total_amount)  AS gross,
            sum(refund)        AS refunds,
            count(*)           AS orders
        FROM rev
        GROUP BY 1
    ),
    items AS (
        SELECT
            oi.food_item_id                      AS id,
            f.name                               AS name,
            f.category_id                        AS category_id,
            sum(oi.quantity)::bigint             AS quantity_sold,
            sum(oi.quantity * oi.price_at_time)  AS revenue
        FROM public.order_items oi
        JOIN rev r               ON r.id = oi.order_id
        JOIN public.food_items f ON f.id = oi.food_item_id
        WHERE p_include_items
        GROUP BY oi.food_item_id, f.name, f.category_id
    ),
    popular AS (
        SELECT * FROM items
        ORDER BY quantity_sold DESC, id ASC
        LIMIT 10
    ),
    cats AS (
        -- Derived from `popular` (top 10 items), exactly as analytics_dashboard.
        SELECT
            coalesce(c.name, 'Others') AS name,
            sum(p.quantity_sold)       AS quantity
        FROM popular p
        LEFT JOIN public.categories c ON c.id = p.category_id
        GROUP BY coalesce(c.name, 'Others')
    ),
    low AS (
        SELECT * FROM items
        WHERE quantity_sold <= 2
        ORDER BY quantity_sold ASC, id ASC
        LIMIT 10
    )
    SELECT jsonb_build_object(
        'grossRevenue',   t.gross,
        'refunds',        t.refunds,
        'netRevenue',     t.gross - t.refunds,
        'revenueOrders',  t.revenue_orders,
        'refundedOrders', t.refunded_orders,
        'partialRefunds', t.partial_refunds,
        'failedRefunds',  fl.failed_refunds,
        'revenueByDay', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'date',    d.day,
                       'gross',   d.gross,
                       'refunds', d.refunds,
                       'net',     d.gross - d.refunds,
                       'orders',  d.orders
                   ) ORDER BY d.day)
            FROM days d
        ), '[]'::jsonb),
        'orderRows', CASE WHEN p_include_order_rows THEN coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'created_at', r.created_at,
                       'gross',      r.total_amount,
                       'refund',     r.refund
                   ) ORDER BY r.created_at, r.id)
            FROM rev r
        ), '[]'::jsonb) ELSE NULL END,
        'popularItems', CASE WHEN p_include_items THEN coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'id',           p.id,
                       'name',         p.name,
                       'category_id',  p.category_id,
                       'quantitySold', p.quantity_sold,
                       'revenue',      p.revenue,
                       'qty',          p.quantity_sold
                   ) ORDER BY p.quantity_sold DESC, p.id ASC)
            FROM popular p
        ), '[]'::jsonb) ELSE NULL END,
        'topCategories', CASE WHEN p_include_items THEN coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'name',     k.name,
                       'quantity', k.quantity,
                       'qty',      k.quantity
                   ) ORDER BY k.quantity DESC, k.name ASC)
            FROM (SELECT * FROM cats ORDER BY quantity DESC, name ASC LIMIT 10) k
        ), '[]'::jsonb) ELSE NULL END,
        'lowItems', CASE WHEN p_include_items THEN coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'id',           l.id,
                       'name',         l.name,
                       'category_id',  l.category_id,
                       'quantitySold', l.quantity_sold,
                       'revenue',      l.revenue,
                       'qty',          l.quantity_sold
                   ) ORDER BY l.quantity_sold ASC, l.id ASC)
            FROM low l
        ), '[]'::jsonb) ELSE NULL END
    )
    INTO v_result
    FROM totals t, failed fl;

    RETURN v_result;
END;
$function$;


-- Accounting for the Order History summary cards. The order set is exactly
-- search_order_history's summary scope: terminal statuses (case-sensitive),
-- the IST calendar-date window [p_from, p_to + 1 day) and the optional payment
-- method. Search text and the status filter do not narrow it, as they do not
-- narrow that summary either.
CREATE OR REPLACE FUNCTION public.order_history_accounting(
    p_from            date DEFAULT NULL,
    p_to              date DEFAULT NULL,
    p_payment_method  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_terminal constant text[] := ARRAY['Completed', 'Rejected', 'Cancelled', 'Refunded'];
    v_start    timestamptz;
    v_end      timestamptz;
    v_payment  text := NULLIF(btrim(COALESCE(p_payment_method, '')), '');
    v_result   jsonb;
BEGIN
    IF p_from IS NOT NULL THEN
        v_start := (p_from::timestamp) AT TIME ZONE 'Asia/Kolkata';
    END IF;

    IF p_to IS NOT NULL THEN
        v_end := ((p_to + 1)::timestamp) AT TIME ZONE 'Asia/Kolkata';
    END IF;

    WITH base AS (
        SELECT
            o.total_amount,
            o.refund_id,
            lower(coalesce(o.refund_status, '')) AS rs,
            public.order_is_revenue(o.status, o.refund_status, o.completed_at IS NOT NULL) AS is_revenue,
            public.order_successful_refund(
                o.status, o.refund_status, o.refund_amount, o.total_amount,
                o.completed_at IS NOT NULL, o.refund_id
            ) AS refund
        FROM public.orders o
        WHERE o.status = ANY (v_terminal)
          AND (v_start   IS NULL OR o.created_at >= v_start)
          AND (v_end     IS NULL OR o.created_at <  v_end)
          AND (v_payment IS NULL OR o.payment_method = v_payment)
    )
    SELECT jsonb_build_object(
        'grossRevenue',  coalesce(sum(total_amount) FILTER (WHERE is_revenue), 0),
        'refunds',       coalesce(sum(refund), 0),
        'netRevenue',    coalesce(sum(total_amount) FILTER (WHERE is_revenue), 0) - coalesce(sum(refund), 0),
        'revenueOrders', count(*) FILTER (WHERE is_revenue),
        'failedRefunds', count(*) FILTER (WHERE refund_id IS NOT NULL AND rs = 'failed')
    )
    INTO v_result
    FROM base;

    RETURN v_result;
END;
$function$;


-- Only the backend (service role) calls these. They are not exposed to the
-- anon / authenticated API roles.
DO $grants$
BEGIN
    REVOKE ALL ON FUNCTION public.analytics_revenue_accounting(timestamptz, timestamptz, boolean, boolean) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.order_history_accounting(date, date, text) FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.analytics_revenue_accounting(timestamptz, timestamptz, boolean, boolean) FROM anon;
        REVOKE ALL ON FUNCTION public.order_history_accounting(date, date, text) FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.analytics_revenue_accounting(timestamptz, timestamptz, boolean, boolean) FROM authenticated;
        REVOKE ALL ON FUNCTION public.order_history_accounting(date, date, text) FROM authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.analytics_revenue_accounting(timestamptz, timestamptz, boolean, boolean) TO service_role;
        GRANT EXECUTE ON FUNCTION public.order_history_accounting(date, date, text) TO service_role;
    END IF;
END;
$grants$;
