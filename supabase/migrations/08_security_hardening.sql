-- Migration 08: Security hardening
-- Applied 2026-06-18. Enables RLS on subscriptions and pins search_path
-- on SECURITY DEFINER functions to prevent search_path injection.

-- ─── Enable RLS on subscriptions ──────────────────────────────────────────────
-- subscriptions is only written by edge functions via service-role key (bypasses
-- RLS) and never queried directly from the browser — safe to lock down.

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- No SELECT policy needed: service-role key bypasses RLS entirely.
-- Anon/authenticated users have no business reading subscription records.

-- ─── Pin search_path on SECURITY DEFINER functions ────────────────────────────
-- Prevents search_path injection attacks where a malicious schema is prepended.

ALTER FUNCTION public.get_my_brand_id()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_returns_updated_at()
  SET search_path = public, pg_temp;
