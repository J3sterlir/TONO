-- Migration: 20261007154000_backfill_close_accepted_job_listings.sql
-- Description: Backfill to close any existing JOB_LISTING entries that have accepted applications or active contracts.

-- 1. Close any open job listings that have an accepted application
UPDATE public."JOB_LISTING" j
SET "Status" = 'Closed'
WHERE j."Status" = 'Open'
  AND EXISTS (
      SELECT 1 
      FROM public."APPLICATION" a
      WHERE a."Job_ID" = j."Job_ID"
        AND a."Status" = 'Accepted'
  );

-- 2. Also close any open job listings that have an active/pending booking contract attached
UPDATE public."JOB_LISTING" j
SET "Status" = 'Closed'
WHERE j."Status" = 'Open'
  AND EXISTS (
      SELECT 1
      FROM public."BOOKING_CONTRACT" c
      WHERE c."Job_ID" = j."Job_ID"
        AND c."Status" NOT IN ('Cancelled', 'Declined')
  );
