-- =============================================================================
-- Migration: 20261002000000_set_security_invoker_on_deduplicated_events_view.sql
-- Description: Sets security_invoker = true on public.view_deduplicated_events so that
--              Postgres evaluates permissions and RLS policies using the querying user's
--              context rather than the view owner (fixing Supabase linter 0010_security_definer_view).
-- =============================================================================

ALTER VIEW IF EXISTS public.view_deduplicated_events SET (security_invoker = true);
