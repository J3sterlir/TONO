-- =============================================================================
-- Migration: 20261020213000_multi_artist_jobs_and_date_validation.sql
-- Description:
--   1. Adds "Slots" column to JOB_LISTING with default 1 (min 1).
--   2. Updates close_job_listing_on_application_accepted trigger to only close
--      the parent job listing when all available slots have been filled.
--   3. Adds check_no_past_event_dates trigger to JOB_LISTING and BOOKING_CONTRACT
--      to block past start dates on creation or date update.
-- =============================================================================

-- 1. ADD SLOTS TO JOB_LISTING
ALTER TABLE public."JOB_LISTING"
ADD COLUMN IF NOT EXISTS "Slots" INTEGER DEFAULT 1 CHECK ("Slots" >= 1);

-- 2. UPDATE TRIGGER FUNCTION: CLOSE JOB LISTING ONLY WHEN ALL SLOTS FILLED
CREATE OR REPLACE FUNCTION public.close_job_listing_on_application_accepted()
RETURNS TRIGGER AS $$
DECLARE
    v_slots INTEGER;
    v_accepted_count INTEGER;
BEGIN
    -- When an application transitions to 'Accepted'
    IF NEW."Status" = 'Accepted' AND (OLD."Status" IS DISTINCT FROM 'Accepted') THEN
        -- Retrieve the job listing's required slots (default 1)
        SELECT COALESCE("Slots", 1) INTO v_slots
        FROM public."JOB_LISTING"
        WHERE "Job_ID" = NEW."Job_ID";

        -- Count how many applications are now accepted for this job
        SELECT COUNT(*) INTO v_accepted_count
        FROM public."APPLICATION"
        WHERE "Job_ID" = NEW."Job_ID" AND "Status" = 'Accepted';

        -- Only close if all required slots are filled
        IF v_accepted_count >= COALESCE(v_slots, 1) THEN
            UPDATE public."JOB_LISTING"
            SET "Status" = 'Closed'
            WHERE "Job_ID" = NEW."Job_ID"
              AND "Status" != 'Closed';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for safety and idempotency
DROP TRIGGER IF EXISTS trg_close_job_listing_on_application_accepted ON public."APPLICATION";
CREATE TRIGGER trg_close_job_listing_on_application_accepted
AFTER INSERT OR UPDATE OF "Status" ON public."APPLICATION"
FOR EACH ROW
EXECUTE FUNCTION public.close_job_listing_on_application_accepted();

-- 3. FUNCTION & TRIGGERS TO PREVENT PAST EVENT DATES
CREATE OR REPLACE FUNCTION public.check_no_past_event_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Only evaluate on INSERT or when Start_Date is explicitly being changed
    IF (TG_OP = 'INSERT' OR NEW."Start_Date" IS DISTINCT FROM OLD."Start_Date") THEN
        IF NEW."Start_Date" IS NOT NULL AND NEW."Start_Date"::date < CURRENT_DATE THEN
            RAISE EXCEPTION 'Event start date (%) cannot be in the past. Only today and future dates are permitted.', NEW."Start_Date";
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on JOB_LISTING
DROP TRIGGER IF EXISTS trg_prevent_past_date_job_listing ON public."JOB_LISTING";
CREATE TRIGGER trg_prevent_past_date_job_listing
BEFORE INSERT OR UPDATE OF "Start_Date" ON public."JOB_LISTING"
FOR EACH ROW
EXECUTE FUNCTION public.check_no_past_event_dates();

-- Trigger on BOOKING_CONTRACT
DROP TRIGGER IF EXISTS trg_prevent_past_date_booking_contract ON public."BOOKING_CONTRACT";
CREATE TRIGGER trg_prevent_past_date_booking_contract
BEFORE INSERT OR UPDATE OF "Start_Date" ON public."BOOKING_CONTRACT"
FOR EACH ROW
EXECUTE FUNCTION public.check_no_past_event_dates();
