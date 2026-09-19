-- Restrict EXECUTE on the order-token functions to the backend (service role).
--
-- public.generate_daily_token() reserves the next (token_date, token_number)
-- for a new order. Only the backend calls it -- supabase.rpc() with the
-- service-role key, from utils/tokenGenerator.js (order creation, payment
-- verification, and the Razorpay webhook's order recovery).
--
-- public.get_next_token(date) is an older counter function. Nothing in the
-- application, and no other database function, trigger or view, calls it. It is
-- kept for now (a later cleanup can decide whether to drop it) and given the
-- same access rule so it is not left callable by clients either.
--
-- Both functions were executable by PUBLIC, anon and authenticated (the
-- PostgreSQL default plus Supabase's default privileges for functions created
-- in public), so any client holding the public anon key could call them
-- through PostgREST (/rest/v1/rpc/...). They are SECURITY INVOKER and
-- daily_token_counters has forced RLS denying anon/authenticated, so such a
-- call could not advance a counter today -- but that protection depends on the
-- table's policies staying exactly as they are. Revoking EXECUTE removes the
-- entry point itself.
--
-- Only privileges change: no function body, signature, owner, volatility or
-- search_path is touched. service_role keeps EXECUTE (granted explicitly below)
-- and bypasses RLS as before, so the backend's token generation is unchanged.
-- Idempotent: safe to run more than once.
--
-- ROLLBACK:
--   GRANT EXECUTE ON FUNCTION public.generate_daily_token() TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.get_next_token(date) TO PUBLIC, anon, authenticated;

DO $grants$
BEGIN
    REVOKE EXECUTE ON FUNCTION public.generate_daily_token() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_next_token(date) FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE EXECUTE ON FUNCTION public.generate_daily_token() FROM anon;
        REVOKE EXECUTE ON FUNCTION public.get_next_token(date) FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE EXECUTE ON FUNCTION public.generate_daily_token() FROM authenticated;
        REVOKE EXECUTE ON FUNCTION public.get_next_token(date) FROM authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.generate_daily_token() TO service_role;
        GRANT EXECUTE ON FUNCTION public.get_next_token(date) TO service_role;
    END IF;
END;
$grants$;
