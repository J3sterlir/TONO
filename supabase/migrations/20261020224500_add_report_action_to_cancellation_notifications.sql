-- =============================================================================
-- Migration: 20261020224500_add_report_action_to_cancellation_notifications.sql
-- Description: 
--   1. Adds 'Report' quick action to contract cancellation notifications (Late Cancellation / Modification Policy).
--   2. Ensures sender_account_id and cancellation metadata are preserved.
--   3. Updates cascade_job_listing_cancellation() to retain specific reason text.
--   4. Backfills existing cancellation notifications with Action_Primary = 'Report'.
-- =============================================================================

-- 1. UPDATE TRIGGER: trg_notify_contract_status_change
CREATE OR REPLACE FUNCTION public.trg_notify_contract_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_artist_account_id UUID;
    v_requester_account_id UUID := NEW."Requester_Account_ID";
    v_business_name TEXT;
    v_artist_name TEXT;
    v_code TEXT := COALESCE(NEW."Contract_Code", 'Contract');
    v_time_text TEXT;
BEGIN
    SELECT a."ACCOUNT_ID", COALESCE(sa."Artist_Name", b."Band_Name", 'Artist')
    INTO v_artist_account_id, v_artist_name
    FROM public."ARTIST" a
    LEFT JOIN public."SOLO_ARTIST" sa ON sa."ARTIST_ID" = a."ARTIST_ID"
    LEFT JOIN public."BAND" b ON b."ARTIST_ID" = a."ARTIST_ID"
    WHERE a."ARTIST_ID" = NEW."Provider_Artist_ID";

    -- Resolve business host name
    IF NEW."Provider_Business_ID" IS NOT NULL THEN
        SELECT bp."Business_Name" INTO v_business_name
        FROM public."BUSINESS_PROFILE" bp
        WHERE bp."BUSINESS_ID" = NEW."Provider_Business_ID";
    ELSIF v_requester_account_id IS NOT NULL THEN
        SELECT bp."Business_Name" INTO v_business_name
        FROM public."BUSINESS_PROFILE" bp
        WHERE bp."ACCOUNT_ID" = v_requester_account_id;
    END IF;

    v_time_text := public.format_time_12h(NEW."Start_Time") || 
        CASE WHEN NEW."End_Time" IS NOT NULL AND TRIM(NEW."End_Time") <> '' THEN ' - ' || public.format_time_12h(NEW."End_Time") ELSE '' END;

    -- 1. Contract Confirmed -> Notify Requester / Host
    IF NEW."Status" = 'Confirmed' AND (OLD."Status" IS DISTINCT FROM 'Confirmed') THEN
        IF v_requester_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_requester_account_id,
                'booking_confirmed',
                COALESCE(v_artist_name, 'Artist') || ' confirmed booking ' || v_code || '!',
                'Status changed from **' || COALESCE(OLD."Status", 'Pending') || '** to **Confirmed**! Performance date is confirmed for **' || 
                COALESCE(TO_CHAR(NEW."Start_Date", 'YYYY-MM-DD'), 'scheduled date') || 
                '** at **' || v_time_text || '** at **' || COALESCE(NEW."Venue_Location", 'designated venue') || '**.',
                '/BusinessContracts?contractId=' || NEW."Booking_ID",
                'booking_confirmed',
                UPPER(SUBSTRING(COALESCE(v_artist_name, 'TONO'), 1, 2)),
                'View Contract',
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT',
                '{}'::jsonb,
                v_artist_account_id
            );
        END IF;

    -- 2. Contract Cancelled -> Notify the other party with 'Report' action
    ELSIF NEW."Status" = 'Cancelled' AND (OLD."Status" IS DISTINCT FROM 'Cancelled') THEN
        -- Host cancelled -> Notify artist performer
        IF (NEW."Cancelled_By" = v_requester_account_id OR NEW."Cancelled_By" IS NULL) AND v_artist_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_artist_account_id,
                'contract_cancel',
                'Contract ' || v_code || ' was cancelled',
                'Booking for **' || v_code || '** was cancelled: ' || COALESCE(NEW."Cancellation_Reason", 'No reason provided.'),
                '/ArtistNavEvents',
                'contract_cancel',
                UPPER(SUBSTRING(COALESCE(v_business_name, 'Host'), 1, 2)),
                'Report', -- Primary action: Report late/frequent cancellation
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT',
                jsonb_build_object(
                    'contract_code', v_code,
                    'booking_id', NEW."Booking_ID",
                    'is_late', COALESCE(NEW."Is_Late_Cancellation", false),
                    'cancellation_reason', NEW."Cancellation_Reason",
                    'sender_account_id', v_requester_account_id
                ),
                v_requester_account_id
            );
        -- Artist cancelled -> Notify host requester
        ELSIF NEW."Cancelled_By" = v_artist_account_id AND v_requester_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_requester_account_id,
                'contract_cancel',
                'Contract ' || v_code || ' was cancelled by artist',
                'Performer cancelled **' || v_code || '**: ' || COALESCE(NEW."Cancellation_Reason", 'No reason provided.'),
                '/BusinessContracts',
                'contract_cancel',
                UPPER(SUBSTRING(COALESCE(v_artist_name, 'Performer'), 1, 2)),
                'Report', -- Primary action: Report performer breach/late cancellation
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT',
                jsonb_build_object(
                    'contract_code', v_code,
                    'booking_id', NEW."Booking_ID",
                    'is_late', COALESCE(NEW."Is_Late_Cancellation", false),
                    'cancellation_reason', NEW."Cancellation_Reason",
                    'sender_account_id', v_artist_account_id
                ),
                v_artist_account_id
            );
        END IF;

    -- 3. Contract Declined -> Notify Requester
    ELSIF NEW."Status" = 'Declined' AND (OLD."Status" IS DISTINCT FROM 'Declined') THEN
        IF v_requester_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_requester_account_id,
                'contract_declined',
                COALESCE(v_artist_name, 'Artist') || ' declined contract offer ' || v_code,
                'The artist was unable to accept booking request for **' || v_code || '**.',
                '/BusinessContracts',
                'contract_declined',
                UPPER(SUBSTRING(COALESCE(v_artist_name, 'Performer'), 1, 2)),
                NULL,
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT',
                '{}'::jsonb,
                v_artist_account_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. UPDATE TRIGGER FUNCTION: cascade_job_listing_cancellation
CREATE OR REPLACE FUNCTION public.cascade_job_listing_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."Status" = 'Cancelled' AND (OLD."Status" IS DISTINCT FROM 'Cancelled') THEN
        -- Cascade cancel any linked booking contract that is not yet completed
        UPDATE public."BOOKING_CONTRACT"
        SET "Status" = 'Cancelled',
            "Cancellation_Reason" = CASE 
                WHEN NEW."Cancellation_Reason" IS NOT NULL AND TRIM(NEW."Cancellation_Reason") <> '' 
                THEN 'Parent Job Listing cancelled by Business Host: ' || TRIM(NEW."Cancellation_Reason")
                ELSE 'Parent Job Listing cancelled by Business Host'
            END,
            "Cancelled_By" = NEW."Cancelled_By",
            "Is_Late_Cancellation" = NEW."Is_Late_Cancellation"
        WHERE "Job_ID" = NEW."Job_ID" 
          AND "Status" NOT IN ('Completed', 'Cancelled');

        -- Cascade decline any pending applications
        UPDATE public."APPLICATION"
        SET "Status" = 'Declined'
        WHERE "Job_ID" = NEW."Job_ID" 
          AND "Status" = 'Pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. BACKFILL EXISTING NOTIFICATIONS
UPDATE public."NOTIFICATION"
SET "Action_Primary" = 'Report'
WHERE "Type" = 'contract_cancel'
  AND ("Action_Primary" IS NULL OR "Action_Primary" = '');
