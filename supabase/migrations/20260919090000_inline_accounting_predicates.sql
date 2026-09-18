-- Accounting summaries: same figures, without per-row function calls.
--
-- order_history_accounting and analytics_revenue_accounting (migration
-- 20260917120000) classify every order in their window by calling
-- order_is_revenue() and order_successful_refund() once per row. Those are SQL
-- functions declared with SET search_path, and PostgreSQL never inlines a SQL
-- function that carries a SET clause -- so each row paid two to three full
-- function invocations. That, not the scan, was the cost: in an all-dates
-- History summary over 55,000 orders the function took ~2.05 s, and the same
-- query with the expressions written inline ~0.095 s (PGlite).
--
-- This redefines ONLY those two functions, with the two helper expressions
-- inlined verbatim. Nothing else changes:
--   * same signatures, arguments, defaults, LANGUAGE, STABLE and search_path;
--   * same order set (terminal statuses / window / payment method; for the
--     analytics window the inclusive [p_start, p_end] on created_at);
--   * same accounting model (see 20260917120000): revenue order, gross,
--     successful refund (processed, recorded, capped at the order total),
--     net = gross - refunds, IST dating by created_at;
--   * same result keys and shapes.
-- order_is_revenue() and order_successful_refund() themselves are untouched
-- and remain the reference definitions; the regression suite compares these
-- functions against them order-by-order.
--
-- Safe to re-run (CREATE OR REPLACE). Privileges are restated exactly as in
-- 20260917120000 (backend service role only).
--
-- ROLLBACK: re-run the two CREATE OR REPLACE FUNCTION statements from
-- 20260917120000_net_revenue_accounting.sql.

-- Accounting for an analytics window [p_start, p_end] (inclusive).
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
            (
                   lower(coalesce(o.status, '')) = 'completed'
                OR (
                       lower(coalesce(o.status, '')) = 'refunded'
                   AND (
                           lower(coalesce(o.refund_status, '')) <> 'failed'
                        OR o.completed_at IS NOT NULL
                       )
                   )
            ) AS is_revenue,
            CASE
                WHEN (
                       lower(coalesce(o.status, '')) = 'completed'
                    OR (
                           lower(coalesce(o.status, '')) = 'refunded'
                       AND (
                               lower(coalesce(o.refund_status, '')) <> 'failed'
                            OR o.completed_at IS NOT NULL
                           )
                       )
                )
                 AND o.refund_id IS NOT NULL
                 AND lower(coalesce(o.refund_status, '')) = 'processed'
                THEN LEAST(GREATEST(coalesce(o.refund_amount, 0), 0), coalesce(o.total_amount, 0))
                ELSE 0
            END AS refund
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

-- Accounting for the Order History summary cards (IST date window, optional
-- payment method, terminal statuses).
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
            (
                   lower(coalesce(o.status, '')) = 'completed'
                OR (
                       lower(coalesce(o.status, '')) = 'refunded'
                   AND (
                           lower(coalesce(o.refund_status, '')) <> 'failed'
                        OR o.completed_at IS NOT NULL
                       )
                   )
            ) AS is_revenue,
            CASE
                WHEN (
                       lower(coalesce(o.status, '')) = 'completed'
                    OR (
                           lower(coalesce(o.status, '')) = 'refunded'
                       AND (
                               lower(coalesce(o.refund_status, '')) <> 'failed'
                            OR o.completed_at IS NOT NULL
                           )
                       )
                )
                 AND o.refund_id IS NOT NULL
                 AND lower(coalesce(o.refund_status, '')) = 'processed'
                THEN LEAST(GREATEST(coalesce(o.refund_amount, 0), 0), coalesce(o.total_amount, 0))
                ELSE 0
            END AS refund
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
