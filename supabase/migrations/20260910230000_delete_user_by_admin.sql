-- Migration: Add delete_user_by_admin stored procedure
-- This allows verified admins to permanently remove a user from auth.users,
-- triggering ON DELETE CASCADE on USER_ACCOUNT, ARTIST, BUSINESS_PROFILE, etc.

CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 1. Ensure the caller is an authenticated admin in the ADMIN table
  IF NOT EXISTS (
    SELECT 1 FROM public."ADMIN" WHERE "ADMIN_ID" = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete users';
  END IF;

  -- 2. Prevent an admin from deleting their own account via this endpoint
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Action not allowed: You cannot delete your own admin account';
  END IF;

  -- 3. Delete from auth.users (cascades to public."USER_ACCOUNT" and related tables)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Grant execution permission to authenticated users (internal admin verification guards execution)
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(UUID) TO authenticated;
