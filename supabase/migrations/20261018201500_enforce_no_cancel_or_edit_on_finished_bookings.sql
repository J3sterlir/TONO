-- =============================================================================
-- Migration: 20261018201500_enforce_no_cancel_or_edit_on_finished_bookings.sql
-- Description: Enforces backend immutability for finished/ended gigs and booking contracts:
--              1. Disallows updating Status to 'Cancelled' once the event date/time has passed.
--              2. Disallows editing core gig/booking details once the event date/time has passed.
--              3. Only allows updating Status to 'Completed' (and subsequent reviews/ratings).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HELPER FUNCTION: Check if an event schedule has passed in Philippine Time
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_event_concluded(
    p_start_date DATE,
    p_end_date DATE,
    p_end_time TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_end_date DATE;
    v_manila_now TIMESTAMPTZ;
    v_manila_date DATE;
    v_manila_time TIME;
    v_parsed_time TIME;
BEGIN
    v_end_date := COALESCE(p_end_date, p_start_date);
    IF v_end_date IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Current date and time in Philippine timezone (Asia/Manila, UTC+08:00)
    v_manila_now := timezone('Asia/Manila', NOW());
    v_manila_date := v_manila_now::DATE;
    v_manila_time := v_manila_now::TIME;

    -- If end date is in the past
    IF v_end_date < v_manila_date THEN
        RETURN TRUE;
    END IF;

    -- If end date is today, check if the end time has arrived
    IF v_end_date = v_manila_date AND p_end_time IS NOT NULL AND trim(p_end_time) <> '' THEN
        BEGIN
            v_parsed_time := p_end_time::TIME;
            IF v_manila_time >= v_parsed_time THEN
                RETURN TRUE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RETURN FALSE;
        END;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- -----------------------------------------------------------------------------
-- 2. TRIGGER ON JOB_LISTING: Block cancel or editing when finished/completed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_enforce_finished_job_listing_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_is_concluded BOOLEAN;
BEGIN
    -- Determine whether the existing gig schedule has finished
    v_is_concluded := public.is_event_concluded(OLD."Start_Date", OLD."End_Date", OLD."End_Time");

    -- If the gig has concluded or is already completed:
    IF v_is_concluded OR OLD."Status" = 'Completed' THEN
        -- Rule 1: Cannot cancel a concluded gig
        IF NEW."Status" = 'Cancelled' THEN
            RAISE EXCEPTION 'Cannot cancel a gig that has already concluded or finished. It can only be marked as complete.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Rule 2: Cannot revert or change a completed gig's status
        IF OLD."Status" = 'Completed' AND NEW."Status" <> 'Completed' THEN
            RAISE EXCEPTION 'Completed gigs are final and cannot be reopened or cancelled.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Rule 3: Cannot edit core listing details (Title, Schedule, Location, Compensation, Song Lineup)
        IF (NEW."Event_Title" IS DISTINCT FROM OLD."Event_Title") OR
           (NEW."Start_Date" IS DISTINCT FROM OLD."Start_Date") OR
           (NEW."End_Date" IS DISTINCT FROM OLD."End_Date") OR
           (NEW."Start_Time" IS DISTINCT FROM OLD."Start_Time") OR
           (NEW."End_Time" IS DISTINCT FROM OLD."End_Time") OR
           (NEW."Location" IS DISTINCT FROM OLD."Location") OR
           (NEW."Compensation_Fee" IS DISTINCT FROM OLD."Compensation_Fee") OR
           (NEW."Requested_Song_Lineup" IS DISTINCT FROM OLD."Requested_Song_Lineup") THEN
            RAISE EXCEPTION 'Cannot edit the details of a gig that has already finished or ended. Concluded gigs can only be marked as complete.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_finished_job_listing ON public."JOB_LISTING";
CREATE TRIGGER trg_check_finished_job_listing
    BEFORE UPDATE ON public."JOB_LISTING"
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_enforce_finished_job_listing_rules();


-- -----------------------------------------------------------------------------
-- 3. TRIGGER ON BOOKING_CONTRACT: Block cancel or editing when finished/completed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_enforce_finished_booking_contract_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_is_concluded BOOLEAN;
BEGIN
    -- Determine whether the existing booking contract schedule has finished
    v_is_concluded := public.is_event_concluded(
        COALESCE(OLD."Start_Date", OLD."Event_Date"),
        COALESCE(OLD."End_Date", OLD."Start_Date", OLD."Event_Date"),
        OLD."End_Time"
    );

    -- If the booking contract has concluded or is already completed:
    IF v_is_concluded OR OLD."Status" = 'Completed' THEN
        -- Rule 1: Cannot cancel a concluded booking
        IF NEW."Status" = 'Cancelled' THEN
            RAISE EXCEPTION 'Cannot cancel a booking that has already concluded or finished. It can only be marked as complete.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Rule 2: Cannot revert or change a completed booking contract
        IF OLD."Status" = 'Completed' AND NEW."Status" <> 'Completed' THEN
            RAISE EXCEPTION 'Completed booking contracts are final and cannot be reopened or cancelled.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Rule 3: Cannot edit core booking contract terms
        IF (NEW."Start_Date" IS DISTINCT FROM OLD."Start_Date") OR
           (NEW."End_Date" IS DISTINCT FROM OLD."End_Date") OR
           (NEW."Event_Date" IS DISTINCT FROM OLD."Event_Date") OR
           (NEW."Start_Time" IS DISTINCT FROM OLD."Start_Time") OR
           (NEW."End_Time" IS DISTINCT FROM OLD."End_Time") OR
           (NEW."Venue_Location" IS DISTINCT FROM OLD."Venue_Location") OR
           (NEW."Agreed_Fee" IS DISTINCT FROM OLD."Agreed_Fee") THEN
            RAISE EXCEPTION 'Cannot edit the terms of a booking that has already finished or ended. Concluded bookings can only be marked as complete.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_finished_booking_contract ON public."BOOKING_CONTRACT";
CREATE TRIGGER trg_check_finished_booking_contract
    BEFORE UPDATE ON public."BOOKING_CONTRACT"
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_enforce_finished_booking_contract_rules();
