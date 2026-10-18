-- =============================================================================
-- Migration: Normalize Tag Names to ALL CAPS
-- Description:
--   Ensures all existing and future tags in TAG_GENRE, TAG_INSTRUMENT,
--   and TAG_REQUEST are uniformly stored and displayed in ALL CAPS.
-- =============================================================================

-- 1. Normalize existing genre tags to uppercase
UPDATE public."TAG_GENRE"
SET "Name" = UPPER(TRIM("Name")),
    "Normalized_Name" = LOWER(TRIM(regexp_replace("Name", '\s+', ' ', 'g')))
WHERE "Name" IS NOT NULL;

-- 2. Normalize existing instrument tags to uppercase
UPDATE public."TAG_INSTRUMENT"
SET "Name" = UPPER(TRIM("Name")),
    "Normalized_Name" = LOWER(TRIM(regexp_replace("Name", '\s+', ' ', 'g')))
WHERE "Name" IS NOT NULL;

-- 3. Normalize existing tag requests to uppercase
UPDATE public."TAG_REQUEST"
SET "Tag_Name" = UPPER(TRIM("Tag_Name")),
    "Normalized_Name" = LOWER(TRIM(regexp_replace("Tag_Name", '\s+', ' ', 'g')))
WHERE "Tag_Name" IS NOT NULL;
