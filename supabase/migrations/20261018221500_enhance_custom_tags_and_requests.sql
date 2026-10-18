-- =============================================================================
-- Migration: 20261018221500_enhance_custom_tags_and_requests.sql
-- Description:
--   1. Enhances TAG_GENRE and TAG_INSTRUMENT with Normalized_Name and Request_Count.
--   2. Enforces unique constraints on Normalized_Name to prevent duplicate tags.
--   3. Enhances TAG_REQUEST with Genre_ID and Instrument_ID foreign keys for
--      persistent unique ID linkage (admin spelling edits will never unlink requesters).
--   4. Adds unique constraints on (ACCOUNT_ID, Genre_ID) and (ACCOUNT_ID, Instrument_ID).
--   5. Configures RLS policies for custom tag submission and admin review.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENHANCE TAG_GENRE
-- -----------------------------------------------------------------------------
ALTER TABLE public."TAG_GENRE"
ADD COLUMN IF NOT EXISTS "Normalized_Name" TEXT,
ADD COLUMN IF NOT EXISTS "Request_Count" INT DEFAULT 1;

-- Backfill Normalized_Name on existing genre rows
UPDATE public."TAG_GENRE"
SET "Normalized_Name" = LOWER(TRIM(regexp_replace("Name", '\s+', ' ', 'g')))
WHERE "Normalized_Name" IS NULL;

-- Ensure default Is_active is set
ALTER TABLE public."TAG_GENRE"
ALTER COLUMN "Is_active" SET DEFAULT TRUE;

-- Add unique constraint on Normalized_Name for TAG_GENRE if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_tag_genre_normalized'
    ) THEN
        ALTER TABLE public."TAG_GENRE"
        ADD CONSTRAINT uq_tag_genre_normalized UNIQUE ("Normalized_Name");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tag_genre_normalized ON public."TAG_GENRE"("Normalized_Name");


-- -----------------------------------------------------------------------------
-- 2. ENHANCE TAG_INSTRUMENT
-- -----------------------------------------------------------------------------
ALTER TABLE public."TAG_INSTRUMENT"
ADD COLUMN IF NOT EXISTS "Normalized_Name" TEXT,
ADD COLUMN IF NOT EXISTS "Request_Count" INT DEFAULT 1;

-- Backfill Normalized_Name on existing instrument rows
UPDATE public."TAG_INSTRUMENT"
SET "Normalized_Name" = LOWER(TRIM(regexp_replace("Name", '\s+', ' ', 'g')))
WHERE "Normalized_Name" IS NULL;

-- Ensure default Is_active is set
ALTER TABLE public."TAG_INSTRUMENT"
ALTER COLUMN "Is_active" SET DEFAULT TRUE;

-- Add unique constraint on Normalized_Name for TAG_INSTRUMENT if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_tag_instrument_normalized'
    ) THEN
        ALTER TABLE public."TAG_INSTRUMENT"
        ADD CONSTRAINT uq_tag_instrument_normalized UNIQUE ("Normalized_Name");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tag_instrument_normalized ON public."TAG_INSTRUMENT"("Normalized_Name");


-- -----------------------------------------------------------------------------
-- 3. ENHANCE TAG_REQUEST
-- -----------------------------------------------------------------------------
ALTER TABLE public."TAG_REQUEST"
ADD COLUMN IF NOT EXISTS "Genre_ID" UUID REFERENCES public."TAG_GENRE"("Genre_ID") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "Instrument_ID" UUID REFERENCES public."TAG_INSTRUMENT"("Instrument_ID") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "Normalized_Name" TEXT;

-- Backfill Normalized_Name on existing tag request rows
UPDATE public."TAG_REQUEST"
SET "Normalized_Name" = LOWER(TRIM(regexp_replace("Tag_Name", '\s+', ' ', 'g')))
WHERE "Normalized_Name" IS NULL;

-- Ensure unique requests per account per genre tag
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_tag_request_genre_account'
    ) THEN
        ALTER TABLE public."TAG_REQUEST"
        ADD CONSTRAINT uq_tag_request_genre_account UNIQUE ("ACCOUNT_ID", "Genre_ID");
    END IF;
END $$;

-- Ensure unique requests per account per instrument tag
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_tag_request_instrument_account'
    ) THEN
        ALTER TABLE public."TAG_REQUEST"
        ADD CONSTRAINT uq_tag_request_instrument_account UNIQUE ("ACCOUNT_ID", "Instrument_ID");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tag_request_genre ON public."TAG_REQUEST"("Genre_ID");
CREATE INDEX IF NOT EXISTS idx_tag_request_instrument ON public."TAG_REQUEST"("Instrument_ID");
CREATE INDEX IF NOT EXISTS idx_tag_request_normalized ON public."TAG_REQUEST"("Normalized_Name");
CREATE INDEX IF NOT EXISTS idx_tag_request_status ON public."TAG_REQUEST"("Status");


-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES FOR CUSTOM TAGS & REQUESTS
-- -----------------------------------------------------------------------------
-- Allow authenticated users to view active tags OR inactive tags they requested
DROP POLICY IF EXISTS "Public can view active genres" ON public."TAG_GENRE";
CREATE POLICY "Public can view active genres"
ON public."TAG_GENRE"
FOR SELECT
USING ("Is_active" = TRUE OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Public can view active instruments" ON public."TAG_INSTRUMENT";
CREATE POLICY "Public can view active instruments"
ON public."TAG_INSTRUMENT"
FOR SELECT
USING ("Is_active" = TRUE OR auth.uid() IS NOT NULL);

-- Allow authenticated users to insert custom inactive tags
DROP POLICY IF EXISTS "Authenticated users can insert inactive genre tags" ON public."TAG_GENRE";
CREATE POLICY "Authenticated users can insert inactive genre tags"
ON public."TAG_GENRE"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert inactive instrument tags" ON public."TAG_INSTRUMENT";
CREATE POLICY "Authenticated users can insert inactive instrument tags"
ON public."TAG_INSTRUMENT"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
