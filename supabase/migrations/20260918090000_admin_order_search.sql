-- =====================================================================
-- CampusCraves: server-side, indexed search for Admin Orders + Order History
-- =====================================================================
--
-- ADDITIVE ONLY. Creates one extension, three indexes and one function. No
-- table, row, policy or existing function is changed. The existing
-- search_order_history function is left in place; the backend falls back to
-- it (and to its previous Admin Orders query) until this migration is applied.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.admin_order_search(text, text, date, date, text[], text, integer, integer, boolean);
--   DROP INDEX IF EXISTS public.idx_orders_token_number_created;
--   DROP INDEX IF EXISTS public.idx_users_phone_trgm;
--   DROP INDEX IF EXISTS public.idx_users_name_lower_trgm;
--   -- pg_trgm can stay installed; drop it only if nothing else uses it:
--   -- DROP EXTENSION IF EXISTS pg_trgm;
--
-- Large tables: CREATE INDEX takes a write lock for the duration of the build.
-- On a large production table, build the three indexes first with
-- CREATE INDEX CONCURRENTLY (outside a transaction), then apply this file; the
-- IF NOT EXISTS clauses make that safe.
--
-- ---------------------------------------------------------------------
-- Search semantics (input is normalised: trimmed, whitespace collapsed,
-- lower-cased, at most 100 characters)
-- ---------------------------------------------------------------------
--
--   "12" / "#12"     Token search. Exact token 12, plus tokens that START with
--                    the digits (120-129, 1200-1299, ...) -- the "partial
--                    token" case. "#05" (leading zero) is exact only.
--                    Also matches the order id 12 exactly.
--                    3+ bare digits also match inside a phone number.
--   "98765 43210"    Phone search (digits, spaces, +, -, parentheses).
--   "harsh" / "Harshil  G"
--                    Case-insensitive name search: the words must appear in
--                    that order anywhere in the name ("%harshil%g%").
--
-- Every candidate set is produced by an indexed lookup:
--   token      idx_orders_token_number_created   (btree, token_number)
--   order id   orders_pkey
--   name       idx_users_name_lower_trgm (GIN trigram) -> idx_orders_user_created
--   phone      idx_users_phone_trgm      (GIN trigram) -> idx_orders_user_created
-- and only then narrowed by scope / status / date / payment, sorted and paged.
-- Without a search, scope + date use idx_orders_created / idx_orders_status_created.
--
-- The caller's text is only ever used as a bound value: LIKE wildcards in it
-- are escaped, and no SQL is built from it.
-- ---------------------------------------------------------------------


CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;


-- Name search: lower(name) LIKE '%...%'.
CREATE INDEX IF NOT EXISTS idx_users_name_lower_trgm
    ON public.users USING gin (lower(name) extensions.gin_trgm_ops);

-- Phone search: phone LIKE '%digits%'.
CREATE INDEX IF NOT EXISTS idx_users_phone_trgm
    ON public.users USING gin (phone extensions.gin_trgm_ops);

-- Token search across dates. The existing unique (token_date, token_number)
-- index cannot serve a lookup that has no token_date.
CREATE INDEX IF NOT EXISTS idx_orders_token_number_created
    ON public.orders (token_number, created_at DESC);


CREATE OR REPLACE FUNCTION public.admin_order_search(
    p_scope            text,
    p_search           text     DEFAULT NULL,
    p_from             date     DEFAULT NULL,
    p_to               date     DEFAULT NULL,
    p_statuses         text[]   DEFAULT NULL,
    p_payment_method   text     DEFAULT NULL,
    p_page             integer  DEFAULT 1,
    p_limit            integer  DEFAULT 20,
    p_include_summary  boolean  DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    -- Admin Orders shows the live queue, Order History the finished orders.
    -- A caller-supplied status list is intersected with the scope, so no
    -- argument can widen either page.
    c_active   constant text[] := ARRAY['Pending', 'Accepted', 'Preparing', 'Ready'];
    c_history  constant text[] := ARRAY['Completed', 'Rejected', 'Cancelled', 'Refunded'];

    v_scope     text[];
    v_statuses  text[];

    v_page      integer := LEAST(GREATEST(COALESCE(p_page, 1), 1), 100000);
    v_limit     integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
    v_offset    bigint;

    v_start     timestamptz;
    v_end       timestamptz;
    v_payment   text := NULLIF(btrim(COALESCE(p_payment_method, '')), '');

    v_search    text;
    v_digits    text;
    v_number    bigint;
    v_is_token  boolean := false;
    v_lo        integer[] := '{}';
    v_hi        integer[] := '{}';
    v_name_like  text;
    v_phone_like text;

    v_ids       integer[];
    v_total     bigint;
    v_orders    jsonb;
    v_summary   jsonb;
    k           integer;
BEGIN
    IF p_scope = 'active' THEN
        v_scope := c_active;
    ELSIF p_scope = 'history' THEN
        v_scope := c_history;
    ELSE
        RAISE EXCEPTION 'admin_order_search: invalid scope' USING ERRCODE = '22023';
    END IF;

    IF p_statuses IS NULL OR cardinality(p_statuses) = 0 THEN
        v_statuses := v_scope;
    ELSE
        v_statuses := ARRAY(SELECT unnest(p_statuses) INTERSECT SELECT unnest(v_scope));
    END IF;

    v_offset := (v_page - 1)::bigint * v_limit;

    -- IST calendar days, half-open [from 00:00, to + 1 day 00:00).
    IF p_from IS NOT NULL THEN
        v_start := (p_from::timestamp) AT TIME ZONE 'Asia/Kolkata';
    END IF;

    IF p_to IS NOT NULL THEN
        v_end := ((p_to + 1)::timestamp) AT TIME ZONE 'Asia/Kolkata';
    END IF;

    -- ---------------- search input ----------------
    v_search := NULLIF(
        left(lower(btrim(regexp_replace(COALESCE(p_search, ''), '\s+', ' ', 'g'))), 100),
        ''
    );

    IF v_search IS NOT NULL THEN
        IF v_search ~ '^#?[0-9]{1,9}$' THEN
            -- Token / order id (and phone digits when 3+ bare digits).
            v_is_token := true;
            v_digits := ltrim(v_search, '#');
            v_number := v_digits::bigint;

            -- Token prefixes: n -> [n*10^k, (n+1)*10^k - 1] up to 6 digits.
            IF left(v_digits, 1) <> '0' AND length(v_digits) < 6 THEN
                FOR k IN 1 .. (6 - length(v_digits)) LOOP
                    v_lo := v_lo || (v_number * (10 ^ k)::bigint)::integer;
                    v_hi := v_hi || ((v_number + 1) * (10 ^ k)::bigint - 1)::integer;
                END LOOP;
            END IF;

            IF left(v_search, 1) <> '#' AND length(v_digits) >= 3 THEN
                v_phone_like := '%' || v_digits || '%';
            END IF;

        ELSIF v_search ~ '^\+?[0-9][0-9 ()-]{2,}$' THEN
            -- Phone typed with separators.
            v_digits := regexp_replace(v_search, '[^0-9]', '', 'g');
            IF length(v_digits) >= 3 THEN
                v_phone_like := '%' || v_digits || '%';
            END IF;

        ELSE
            -- Name: escape LIKE wildcards, then each space becomes '%' so the
            -- words match in order with anything between them.
            v_name_like := '%' || replace(
                replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_'),
                ' ', '%'
            ) || '%';
        END IF;
    END IF;

    -- ---------------- page of ids + total ----------------
    IF v_search IS NULL THEN

        SELECT count(*) INTO v_total
        FROM public.orders o
        WHERE o.status = ANY (v_statuses)
          AND (v_start   IS NULL OR o.created_at >= v_start)
          AND (v_end     IS NULL OR o.created_at <  v_end)
          AND (v_payment IS NULL OR o.payment_method = v_payment);

        v_ids := ARRAY(
            SELECT o.id
            FROM public.orders o
            WHERE o.status = ANY (v_statuses)
              AND (v_start   IS NULL OR o.created_at >= v_start)
              AND (v_end     IS NULL OR o.created_at <  v_end)
              AND (v_payment IS NULL OR o.payment_method = v_payment)
            ORDER BY o.created_at DESC, o.id DESC
            OFFSET v_offset
            LIMIT v_limit
        );

    ELSE

        -- One branch per kind of match, each an indexed lookup. Every branch
        -- returns the columns the filters need, so the scope / status / date /
        -- payment conditions below are pushed down INTO each branch's index
        -- scan (e.g. idx_orders_user_created with the created_at range) and no
        -- candidate is ever joined back to orders. A row matched by two
        -- branches (token 12 and order id 12) is counted once.
        -- (v_number has at most 9 digits, so it always fits an integer.)
        WITH matched AS MATERIALIZED (
            SELECT DISTINCT c.id, c.created_at
            FROM (
                SELECT t.id, t.created_at, t.status, t.payment_method
                FROM public.orders t
                WHERE v_is_token
                  AND (   t.token_number = v_number::integer
                       OR t.token_number BETWEEN v_lo[1] AND v_hi[1]
                       OR t.token_number BETWEEN v_lo[2] AND v_hi[2]
                       OR t.token_number BETWEEN v_lo[3] AND v_hi[3]
                       OR t.token_number BETWEEN v_lo[4] AND v_hi[4]
                       OR t.token_number BETWEEN v_lo[5] AND v_hi[5])

                UNION ALL
                SELECT t.id, t.created_at, t.status, t.payment_method
                FROM public.orders t
                WHERE v_is_token
                  AND t.id = v_number::integer

                UNION ALL
                SELECT t.id, t.created_at, t.status, t.payment_method
                FROM public.users u
                JOIN public.orders t ON t.user_id = u.id
                WHERE v_name_like IS NOT NULL
                  AND lower(u.name) LIKE v_name_like

                UNION ALL
                SELECT t.id, t.created_at, t.status, t.payment_method
                FROM public.users u
                JOIN public.orders t ON t.user_id = u.id
                WHERE v_phone_like IS NOT NULL
                  AND u.phone LIKE v_phone_like
            ) c
            WHERE c.status = ANY (v_statuses)
              AND (v_start   IS NULL OR c.created_at >= v_start)
              AND (v_end     IS NULL OR c.created_at <  v_end)
              AND (v_payment IS NULL OR c.payment_method = v_payment)
        )
        SELECT
            (SELECT count(*) FROM matched),
            ARRAY(
                SELECT m.id
                FROM matched m
                ORDER BY m.created_at DESC, m.id DESC
                OFFSET v_offset
                LIMIT v_limit
            )
        INTO v_total, v_ids;

    END IF;

    -- ---------------- rows: only the fields the admin screens use ----------------
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',             o.id,
            'token_number',   o.token_number,
            'status',         o.status,
            'created_at',     o.created_at,
            'completed_at',   o.completed_at,
            'total_amount',   o.total_amount,
            'payment_method', o.payment_method,
            'payment_status', o.payment_status,
            'payment_due_at', o.payment_due_at,
            'cancel_reason',  o.cancel_reason,
            'cancelled_by',   o.cancelled_by,
            'refund_status',  o.refund_status,
            'refund_type',    o.refund_type,
            'refund_amount',  o.refund_amount,
            'refund_reason',  o.refund_reason,
            'refund_id',      o.refund_id,
            'refunded_at',    o.refunded_at,
            'user', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object(
                'name',  u.name,
                'phone', u.phone
            ) END,
            'order_items', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id',            oi.id,
                    'quantity',      oi.quantity,
                    'price_at_time', oi.price_at_time,
                    'food_items', CASE WHEN fi.id IS NULL THEN NULL ELSE jsonb_build_object(
                        'id',   fi.id,
                        'name', fi.name
                    ) END
                ) ORDER BY oi.id)
                FROM public.order_items oi
                LEFT JOIN public.food_items fi ON fi.id = oi.food_item_id
                WHERE oi.order_id = o.id
            ), '[]'::jsonb)
        )
        ORDER BY o.created_at DESC, o.id DESC
    ), '[]'::jsonb)
    INTO v_orders
    FROM public.orders o
    LEFT JOIN public.users u ON u.id = o.user_id
    WHERE o.id = ANY (v_ids);

    -- ---------------- summary: scope + date + payment (not status/search) ----------------
    IF p_include_summary THEN
        SELECT jsonb_build_object(
            'total',     count(*),
            'pending',   count(*) FILTER (WHERE o.status IN ('Pending', 'Accepted')),
            'preparing', count(*) FILTER (WHERE o.status = 'Preparing'),
            'ready',     count(*) FILTER (WHERE o.status = 'Ready'),
            'completed', count(*) FILTER (WHERE o.status = 'Completed'),
            'cancelled', count(*) FILTER (WHERE o.status IN ('Rejected', 'Cancelled')),
            'refunded',  count(*) FILTER (WHERE o.status = 'Refunded'),
            'revenue',   COALESCE(sum(o.total_amount) FILTER (WHERE o.status = 'Completed'), 0)
        )
        INTO v_summary
        FROM public.orders o
        WHERE o.status = ANY (v_scope)
          AND (v_start   IS NULL OR o.created_at >= v_start)
          AND (v_end     IS NULL OR o.created_at <  v_end)
          AND (v_payment IS NULL OR o.payment_method = v_payment);
    END IF;

    RETURN jsonb_build_object(
        'orders', v_orders,
        'pagination', jsonb_build_object(
            'page',       v_page,
            'limit',      v_limit,
            'total',      v_total,
            'totalPages', GREATEST(ceil(v_total::numeric / v_limit)::integer, 1),
            'hasMore',    (v_offset + v_limit) < v_total
        ),
        'summary', v_summary
    );
END;
$function$;


-- Only the backend (service role) calls this.
DO $grants$
BEGIN
    REVOKE ALL ON FUNCTION public.admin_order_search(text, text, date, date, text[], text, integer, integer, boolean) FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.admin_order_search(text, text, date, date, text[], text, integer, integer, boolean) FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.admin_order_search(text, text, date, date, text[], text, integer, integer, boolean) FROM authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.admin_order_search(text, text, date, date, text[], text, integer, integer, boolean) TO service_role;
    END IF;
END;
$grants$;
