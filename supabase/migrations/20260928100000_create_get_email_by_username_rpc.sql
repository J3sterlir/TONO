-- =============================================================================
-- Migration: 20260928100000_create_get_email_by_username_rpc.sql
-- Description: Creates secure lookup function to resolve a login email by username
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
BEGIN
    IF p_username IS NULL OR TRIM(p_username) = '' THEN
        RETURN NULL;
    END IF;

    SELECT "Email" INTO v_email
    FROM public."USER_ACCOUNT"
    WHERE LOWER("Username") = LOWER(TRIM(p_username))
      AND "Is_Banned" IS NOT TRUE
    LIMIT 1;

    RETURN v_email;
END;
$$;

-- Allow anonymous and authenticated users to resolve username for login
REVOKE ALL ON FUNCTION public.get_email_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;
