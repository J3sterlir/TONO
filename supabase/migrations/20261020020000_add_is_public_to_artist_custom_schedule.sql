-- =============================================================================
-- Migration: 20261020020000_add_is_public_to_artist_custom_schedule.sql
-- Description:
--   1. Adds Is_Public flag to ARTIST_CUSTOM_SCHEDULE table (default true).
--   2. Creates index on (Artist_ID, Is_Public, Start_Date) for fast calendar & public profile lookups.
-- =============================================================================

ALTER TABLE public."ARTIST_CUSTOM_SCHEDULE"
    ADD COLUMN IF NOT EXISTS "Is_Public" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_artist_custom_schedule_public
    ON public."ARTIST_CUSTOM_SCHEDULE"("Artist_ID", "Is_Public", "Start_Date");
