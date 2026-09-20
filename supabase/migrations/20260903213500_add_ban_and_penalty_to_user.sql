-- Add Is_Banned and Penalty_Rating_Deduction to USER_ACCOUNT
ALTER TABLE "public"."USER_ACCOUNT" 
ADD COLUMN IF NOT EXISTS "Is_Banned" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "Penalty_Rating_Deduction" numeric DEFAULT 0.0;

-- Create is_admin() function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public."ADMIN" WHERE "ADMIN_ID" = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for Admins on USER_ACCOUNT
CREATE POLICY "Admins have full access to USER_ACCOUNT"
ON "public"."USER_ACCOUNT"
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Add RLS policies for Admins on ARTIST (if not already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ARTIST' AND policyname = 'Admins have full access to ARTIST'
    ) THEN
        CREATE POLICY "Admins have full access to ARTIST" ON "public"."ARTIST"
        FOR ALL TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;
END
$$;

-- Add RLS policies for Admins on BUSINESS_PROFILE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'BUSINESS_PROFILE' AND policyname = 'Admins have full access to BUSINESS_PROFILE'
    ) THEN
        CREATE POLICY "Admins have full access to BUSINESS_PROFILE" ON "public"."BUSINESS_PROFILE"
        FOR ALL TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;
END
$$;

-- Add RLS policies for Admins on SOLO_ARTIST
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'SOLO_ARTIST' AND policyname = 'Admins have full access to SOLO_ARTIST'
    ) THEN
        CREATE POLICY "Admins have full access to SOLO_ARTIST" ON "public"."SOLO_ARTIST"
        FOR ALL TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;
END
$$;

-- Add RLS policies for Admins on BAND
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'BAND' AND policyname = 'Admins have full access to BAND'
    ) THEN
        CREATE POLICY "Admins have full access to BAND" ON "public"."BAND"
        FOR ALL TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;
END
$$;
