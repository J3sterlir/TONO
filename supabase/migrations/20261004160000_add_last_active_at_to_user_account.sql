-- =============================================================================
-- MIGRATION: 20261004160000_add_last_active_at_to_user_account.sql
-- DESCRIPTION: Adds Last_Active_At timestamp to USER_ACCOUNT and creates a
--              dedicated RPC to update user session activity / last login.
-- =============================================================================

ALTER TABLE public."USER_ACCOUNT"
ADD COLUMN IF NOT EXISTS "Last_Active_At" TIMESTAMPTZ DEFAULT NOW();

-- Index for quick sorting and checking active users
CREATE INDEX IF NOT EXISTS idx_user_account_last_active_at
ON public."USER_ACCOUNT"("Last_Active_At" DESC NULLS LAST);

-- Secure RPC to update caller's last active timestamp
CREATE OR REPLACE FUNCTION public.update_user_last_active()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public."USER_ACCOUNT"
    SET "Last_Active_At" = NOW()
    WHERE "ACCOUNT_ID" = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_last_active() TO authenticated;
