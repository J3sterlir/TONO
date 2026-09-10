-- =============================================================================
-- Migration: 20260910170000_allow_reading_business_profiles.sql
-- Description: Allows reading business profiles for discovery in Local Music Industry
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'BUSINESS_PROFILE' 
        AND policyname = 'Allow reading business profiles'
    ) THEN
        CREATE POLICY "Allow reading business profiles" 
        ON public."BUSINESS_PROFILE"
        FOR SELECT 
        USING (true);
    END IF;
END $$;
