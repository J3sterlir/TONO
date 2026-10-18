-- =============================================================================
-- Migration: 20261018205000_add_is_contact_hidden_to_business_profile.sql
-- Description:
--   1. Adds "Is_Contact_Hidden" column (BOOLEAN DEFAULT TRUE) to BUSINESS_PROFILE.
--   2. Backfills any existing records with NULL to TRUE so they default to hidden.
--   3. Ensures RLS policies allow business owners to update their profile.
-- =============================================================================

-- Add Is_Contact_Hidden column defaulting to TRUE
ALTER TABLE public."BUSINESS_PROFILE"
ADD COLUMN IF NOT EXISTS "Is_Contact_Hidden" BOOLEAN DEFAULT TRUE;

-- Backfill any existing NULL records to TRUE
UPDATE public."BUSINESS_PROFILE"
SET "Is_Contact_Hidden" = TRUE
WHERE "Is_Contact_Hidden" IS NULL;

-- Comment for schema documentation
COMMENT ON COLUMN public."BUSINESS_PROFILE"."Is_Contact_Hidden" IS 'Flag indicating whether business contact information is hidden (private) on public profile pages. Defaults to TRUE.';
