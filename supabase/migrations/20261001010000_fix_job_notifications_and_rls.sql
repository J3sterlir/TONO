-- =============================================================================
-- Migration: 20261001010000_fix_job_notifications_and_rls.sql
-- Description: 
--   1. Fixes NOTIFICATION RLS to allow authenticated senders to insert notifications.
--   2. Adds automated trigger on JOB_LISTING for schedule/date/venue changes.
--   3. Adds automated trigger on JOB_LISTING for job cancellations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADD Sender_Account_ID COLUMN IF NOT EXISTS
-- -----------------------------------------------------------------------------
ALTER TABLE public."NOTIFICATION"
    ADD COLUMN IF NOT EXISTS "Sender_Account_ID" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_sender ON public."NOTIFICATION"("Sender_Account_ID");


-- -----------------------------------------------------------------------------
-- 2. FIX NOTIFICATION RLS INSERT POLICY
-- -----------------------------------------------------------------------------
-- Allow authenticated senders to insert notifications for recipients
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public."NOTIFICATION";
DROP POLICY IF EXISTS "Users can insert own notifications" ON public."NOTIFICATION";
DROP POLICY IF EXISTS "Users can insert notifications as sender or recipient" ON public."NOTIFICATION";

CREATE POLICY "Users can insert notifications as sender or recipient"
ON public."NOTIFICATION"
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = "Account_ID" 
    OR auth.uid() = "Sender_Account_ID" 
    OR "Sender_Account_ID" IS NULL
);


-- -----------------------------------------------------------------------------
-- 2. AUTOMATED TRIGGER: JOB_LISTING Schedule / Details Updated
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_job_schedule_update()
RETURNS TRIGGER AS $$
DECLARE
    v_business_name TEXT;
    v_initials TEXT;
    v_date_text TEXT;
    v_schedule_summary TEXT;
    r_contract RECORD;
    r_app RECORD;
BEGIN
    -- Only fire if schedule, compensation, or venue details have changed on an active listing
    IF (OLD."Start_Date" IS DISTINCT FROM NEW."Start_Date"
        OR OLD."End_Date" IS DISTINCT FROM NEW."End_Date"
        OR OLD."Start_Time" IS DISTINCT FROM NEW."Start_Time"
        OR OLD."End_Time" IS DISTINCT FROM NEW."End_Time"
        OR OLD."Location" IS DISTINCT FROM NEW."Location"
        OR OLD."Compensation_Fee" IS DISTINCT FROM NEW."Compensation_Fee")
        AND NEW."Status" NOT IN ('Draft', 'Cancelled')
    THEN
        -- Get Business Name
        SELECT bp."Business_Name" INTO v_business_name
        FROM public."BUSINESS_PROFILE" bp
        WHERE bp."BUSINESS_ID" = NEW."Posted_By_BUSINESS_ID";

        v_initials := UPPER(SUBSTRING(COALESCE(v_business_name, 'Host'), 1, 2));
        v_date_text := COALESCE(TO_CHAR(NEW."Start_Date", 'Mon DD, YYYY'), 'Updated date');
        v_schedule_summary := v_date_text || ' at ' || COALESCE(NEW."Start_Time", 'TBD') || ' • ' || COALESCE(NEW."Location", 'Updated Venue');

        -- 1. Notify Contracted Performers
        FOR r_contract IN
            SELECT c."Booking_ID", a."ACCOUNT_ID"
            FROM public."BOOKING_CONTRACT" c
            JOIN public."ARTIST" a ON a."ARTIST_ID" = c."Provider_Artist_ID"
            WHERE c."Job_ID" = NEW."Job_ID"
              AND c."Status" NOT IN ('Cancelled', 'Declined')
        LOOP
            IF r_contract."ACCOUNT_ID" IS NOT NULL THEN
                -- Deduplicate: check if identical notification was sent in last 10 seconds
                IF NOT EXISTS (
                    SELECT 1 FROM public."NOTIFICATION"
                    WHERE "Account_ID" = r_contract."ACCOUNT_ID"
                      AND "Entity_ID" = r_contract."Booking_ID"
                      AND "Svg_Type" = 'schedule_update'
                      AND "Created_At" > NOW() - INTERVAL '10 seconds'
                ) THEN
                    PERFORM public.send_notification(
                        r_contract."ACCOUNT_ID",
                        'schedule_update',
                        'Schedule updated for "' || NEW."Event_Title" || '"',
                        'Details were updated by ' || COALESCE(v_business_name, 'the host') || ': ' || v_schedule_summary || '.',
                        '/ArtistNavEvents?contractId=' || r_contract."Booking_ID",
                        'schedule_update',
                        v_initials,
                        'View Schedule',
                        NULL,
                        r_contract."Booking_ID",
                        'BOOKING_CONTRACT'
                    );
                END IF;
            END IF;
        END LOOP;

        -- 2. Notify Active Applicants
        FOR r_app IN
            SELECT app."Application_ID", a."ACCOUNT_ID"
            FROM public."APPLICATION" app
            JOIN public."ARTIST" a ON a."ARTIST_ID" = app."Artist_ID"
            WHERE app."Job_ID" = NEW."Job_ID"
              AND app."Status" IN ('Pending', 'Reviewing', 'Shortlisted')
              AND a."ACCOUNT_ID" NOT IN (
                  SELECT a2."ACCOUNT_ID"
                  FROM public."BOOKING_CONTRACT" c2
                  JOIN public."ARTIST" a2 ON a2."ARTIST_ID" = c2."Provider_Artist_ID"
                  WHERE c2."Job_ID" = NEW."Job_ID"
                    AND c2."Status" NOT IN ('Cancelled', 'Declined')
              )
        LOOP
            IF r_app."ACCOUNT_ID" IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public."NOTIFICATION"
                    WHERE "Account_ID" = r_app."ACCOUNT_ID"
                      AND "Entity_ID" = NEW."Job_ID"
                      AND "Svg_Type" = 'schedule_update'
                      AND "Created_At" > NOW() - INTERVAL '10 seconds'
                ) THEN
                    PERFORM public.send_notification(
                        r_app."ACCOUNT_ID",
                        'schedule_update',
                        'Gig schedule updated for "' || NEW."Event_Title" || '"',
                        'The gig you applied for was updated by ' || COALESCE(v_business_name, 'the host') || ': ' || v_schedule_summary || '.',
                        '/ArtistNavEvents?jobId=' || NEW."Job_ID",
                        'schedule_update',
                        v_initials,
                        'View Gig',
                        NULL,
                        NEW."Job_ID",
                        'JOB_LISTING'
                    );
                END IF;
            END IF;
        END LOOP;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_listing_schedule_update ON public."JOB_LISTING";
CREATE TRIGGER trg_job_listing_schedule_update
AFTER UPDATE ON public."JOB_LISTING"
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_job_schedule_update();


-- -----------------------------------------------------------------------------
-- 3. AUTOMATED TRIGGER: JOB_LISTING Cancelled
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_job_cancelled()
RETURNS TRIGGER AS $$
DECLARE
    v_business_name TEXT;
    v_initials TEXT;
    r_target RECORD;
BEGIN
    IF NEW."Status" = 'Cancelled' AND (OLD."Status" IS DISTINCT FROM 'Cancelled') THEN
        SELECT bp."Business_Name" INTO v_business_name
        FROM public."BUSINESS_PROFILE" bp
        WHERE bp."BUSINESS_ID" = NEW."Posted_By_BUSINESS_ID";

        v_initials := UPPER(SUBSTRING(COALESCE(v_business_name, 'Host'), 1, 2));

        -- 1. Notify Contracted Performers
        FOR r_target IN
            SELECT c."Booking_ID", a."ACCOUNT_ID"
            FROM public."BOOKING_CONTRACT" c
            JOIN public."ARTIST" a ON a."ARTIST_ID" = c."Provider_Artist_ID"
            WHERE c."Job_ID" = NEW."Job_ID"
              AND c."Status" NOT IN ('Cancelled', 'Declined')
        LOOP
            IF r_target."ACCOUNT_ID" IS NOT NULL THEN
                PERFORM public.send_notification(
                    r_target."ACCOUNT_ID",
                    'job_cancelled',
                    'Gig "' || NEW."Event_Title" || '" was cancelled',
                    COALESCE(v_business_name, 'The host') || ' cancelled this gig: ' || COALESCE(NEW."Cancellation_Reason", 'No cancellation reason provided.'),
                    '/ArtistNavEvents',
                    'job_cancelled',
                    v_initials,
                    NULL,
                    NULL,
                    r_target."Booking_ID",
                    'BOOKING_CONTRACT'
                );
            END IF;
        END LOOP;

        -- 2. Notify Active Applicants
        FOR r_target IN
            SELECT app."Application_ID", a."ACCOUNT_ID"
            FROM public."APPLICATION" app
            JOIN public."ARTIST" a ON a."ARTIST_ID" = app."Artist_ID"
            WHERE app."Job_ID" = NEW."Job_ID"
              AND app."Status" IN ('Pending', 'Reviewing', 'Shortlisted')
        LOOP
            IF r_target."ACCOUNT_ID" IS NOT NULL THEN
                PERFORM public.send_notification(
                    r_target."ACCOUNT_ID",
                    'job_cancelled',
                    'Listing "' || NEW."Event_Title" || '" was cancelled',
                    COALESCE(v_business_name, 'The host') || ' cancelled the gig you applied for.',
                    '/ArtistNavEvents',
                    'job_cancelled',
                    v_initials,
                    NULL,
                    NULL,
                    NEW."Job_ID",
                    'JOB_LISTING'
                );
            END IF;
        END LOOP;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_listing_cancelled ON public."JOB_LISTING";
CREATE TRIGGER trg_job_listing_cancelled
AFTER UPDATE ON public."JOB_LISTING"
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_job_cancelled();
