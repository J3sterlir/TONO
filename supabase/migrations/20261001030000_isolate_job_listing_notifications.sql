-- =============================================================================
-- Migration: 20261001030000_isolate_job_listing_notifications.sql
-- Description: 
--   1. Adds format_time_12h helper to format time in standard 12-hour clock (e.g. 12:00 PM, 02:30 PM, 06:30:45 PM).
--   2. Updates trg_notify_job_schedule_update to generate rich before/after diffs:
--      (e.g., Time changed from **12:00 PM - 02:00 PM** to **12:00 PM - 02:30 PM**).
--   3. Isolates Job Listing notifications so that updating or cancelling a job listing
--      emits strictly a single 'JOB_LISTING' entity notification per artist account with DISTINCT deduplication.
--   4. Adds trg_notify_contract_schedule_update for direct booking contracts with before/after diffs.
--   5. Updates trg_notify_contract_status_change to use standard 12-hour clock and bold markdown diff highlights.
--   6. Updates band invite and application triggers with bold diff highlights.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HELPER: format_time_12h
-- Converts 24-hour time text (e.g. '14:30', '12:00:00', '18:30:45') to standard 12-hour format ('02:30 PM', '06:30:45 PM')
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.format_time_12h(p_time TEXT)
RETURNS TEXT AS $$
BEGIN
    IF p_time IS NULL OR TRIM(p_time) = '' THEN
        RETURN 'TBD';
    END IF;
    -- If already contains AM or PM, return trimmed string
    IF UPPER(p_time) LIKE '%AM%' OR UPPER(p_time) LIKE '%PM%' THEN
        RETURN TRIM(p_time);
    END IF;
    -- Check if seconds are non-zero
    IF EXTRACT(SECOND FROM p_time::TIME) > 0 THEN
        RETURN TO_CHAR(p_time::TIME, 'HH12:MI:SS AM');
    ELSE
        RETURN TO_CHAR(p_time::TIME, 'HH12:MI AM');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN p_time;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- -----------------------------------------------------------------------------
-- 2. UPDATE TRIGGER: trg_notify_job_schedule_update
-- Generates rich before/after diffs and sends isolated JOB_LISTING notification
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_job_schedule_update()
RETURNS TRIGGER AS $$
DECLARE
    v_business_name TEXT;
    v_host_account_id UUID;
    v_initials TEXT;
    v_change_list TEXT[] := ARRAY[]::TEXT[];
    v_changes_summary TEXT;
    v_content TEXT;
    v_old_time TEXT;
    v_new_time TEXT;
    r_recipient RECORD;
BEGIN
    -- Only fire if schedule, compensation, venue, or title details have changed on an active listing
    IF (OLD."Start_Date" IS DISTINCT FROM NEW."Start_Date"
        OR OLD."End_Date" IS DISTINCT FROM NEW."End_Date"
        OR OLD."Start_Time" IS DISTINCT FROM NEW."Start_Time"
        OR OLD."End_Time" IS DISTINCT FROM NEW."End_Time"
        OR OLD."Location" IS DISTINCT FROM NEW."Location"
        OR OLD."Compensation_Fee" IS DISTINCT FROM NEW."Compensation_Fee"
        OR OLD."Event_Title" IS DISTINCT FROM NEW."Event_Title")
        AND NEW."Status" NOT IN ('Draft', 'Cancelled')
    THEN
        -- Query Business Name and Host Account ID
        SELECT bp."Business_Name", bp."ACCOUNT_ID" 
        INTO v_business_name, v_host_account_id
        FROM public."BUSINESS_PROFILE" bp
        WHERE bp."BUSINESS_ID" = NEW."Posted_By_BUSINESS_ID";

        IF v_host_account_id IS NULL THEN
            v_host_account_id := auth.uid();
        END IF;

        v_initials := UPPER(SUBSTRING(COALESCE(v_business_name, 'Host'), 1, 2));

        -- 1. Date Diff (YYYY-MM-DD)
        IF OLD."Start_Date" IS DISTINCT FROM NEW."Start_Date" OR OLD."End_Date" IS DISTINCT FROM NEW."End_Date" THEN
            v_change_list := array_append(
                v_change_list, 
                'Date changed from **' || 
                COALESCE(TO_CHAR(OLD."Start_Date", 'YYYY-MM-DD'), 'TBD') || 
                CASE WHEN OLD."End_Date" IS NOT NULL AND OLD."End_Date" <> OLD."Start_Date" THEN ' - ' || TO_CHAR(OLD."End_Date", 'YYYY-MM-DD') ELSE '' END || 
                '** to **' || 
                COALESCE(TO_CHAR(NEW."Start_Date", 'YYYY-MM-DD'), 'TBD') || 
                CASE WHEN NEW."End_Date" IS NOT NULL AND NEW."End_Date" <> NEW."Start_Date" THEN ' - ' || TO_CHAR(NEW."End_Date", 'YYYY-MM-DD') ELSE '' END || 
                '**'
            );
        END IF;

        -- 2. Time Diff (Standard 12-hour Clock: e.g. 12:00 PM - 02:30 PM)
        IF OLD."Start_Time" IS DISTINCT FROM NEW."Start_Time" OR OLD."End_Time" IS DISTINCT FROM NEW."End_Time" THEN
            v_old_time := public.format_time_12h(OLD."Start_Time") || 
                CASE WHEN OLD."End_Time" IS NOT NULL AND TRIM(OLD."End_Time") <> '' THEN ' - ' || public.format_time_12h(OLD."End_Time") ELSE '' END;
            v_new_time := public.format_time_12h(NEW."Start_Time") || 
                CASE WHEN NEW."End_Time" IS NOT NULL AND TRIM(NEW."End_Time") <> '' THEN ' - ' || public.format_time_12h(NEW."End_Time") ELSE '' END;
            v_change_list := array_append(v_change_list, 'Time changed from **' || v_old_time || '** to **' || v_new_time || '**');
        END IF;

        -- 3. Location / Venue Diff
        IF OLD."Location" IS DISTINCT FROM NEW."Location" THEN
            v_change_list := array_append(
                v_change_list, 
                'Venue changed from **' || COALESCE(OLD."Location", 'TBD') || '** to **' || COALESCE(NEW."Location", 'TBD') || '**'
            );
        END IF;

        -- 4. Compensation Fee Diff
        IF OLD."Compensation_Fee" IS DISTINCT FROM NEW."Compensation_Fee" THEN
            v_change_list := array_append(
                v_change_list, 
                'Pay changed from **₱' || COALESCE(TO_CHAR(OLD."Compensation_Fee", 'FM999,999,999.00'), '0.00') || 
                '** to **₱' || COALESCE(TO_CHAR(NEW."Compensation_Fee", 'FM999,999,999.00'), '0.00') || '**'
            );
        END IF;

        -- 5. Title Diff
        IF OLD."Event_Title" IS DISTINCT FROM NEW."Event_Title" THEN
            v_change_list := array_append(
                v_change_list,
                'Title changed from **' || COALESCE(OLD."Event_Title", 'Untitled') || '** to **' || COALESCE(NEW."Event_Title", 'Untitled') || '**'
            );
        END IF;

        -- Build final notification content
        IF array_length(v_change_list, 1) > 0 THEN
            v_changes_summary := array_to_string(v_change_list, ' • ');
            v_content := 'Details for "' || NEW."Event_Title" || '" were updated by ' || COALESCE(v_business_name, 'the host') || ': ' || v_changes_summary || '.';
        ELSE
            v_content := 'Details for "' || NEW."Event_Title" || '" were updated by ' || COALESCE(v_business_name, 'the host') || 
                '. Performance schedule: **' || COALESCE(TO_CHAR(NEW."Start_Date", 'YYYY-MM-DD'), 'TBD') || 
                ' (' || public.format_time_12h(NEW."Start_Time") || 
                CASE WHEN NEW."End_Time" IS NOT NULL AND TRIM(NEW."End_Time") <> '' THEN ' - ' || public.format_time_12h(NEW."End_Time") ELSE '' END || 
                ')** at **' || COALESCE(NEW."Location", 'Updated Venue') || '**.';
        END IF;

        -- Notify each associated artist account EXACTLY ONCE (deduplicating across contracts & applications)
        FOR r_recipient IN
            SELECT DISTINCT a."ACCOUNT_ID"
            FROM (
                -- Contracted performers for this job
                SELECT c."Provider_Artist_ID" AS artist_id
                FROM public."BOOKING_CONTRACT" c
                WHERE c."Job_ID" = NEW."Job_ID"
                  AND c."Status" NOT IN ('Cancelled', 'Declined')
                UNION
                -- Active applicants for this job
                SELECT app."Artist_ID" AS artist_id
                FROM public."APPLICATION" app
                WHERE app."Job_ID" = NEW."Job_ID"
                  AND app."Status" IN ('Pending', 'Reviewing', 'Shortlisted', 'Accepted')
            ) rec
            JOIN public."ARTIST" a ON a."ARTIST_ID" = rec.artist_id
            WHERE a."ACCOUNT_ID" IS NOT NULL
        LOOP
            -- Deduplicate: check if identical notification was sent in last 10 seconds
            IF NOT EXISTS (
                SELECT 1 FROM public."NOTIFICATION"
                WHERE "Account_ID" = r_recipient."ACCOUNT_ID"
                  AND "Entity_ID" = NEW."Job_ID"
                  AND "Svg_Type" = 'schedule_update'
                  AND "Created_At" > NOW() - INTERVAL '10 seconds'
            ) THEN
                PERFORM public.send_notification(
                    r_recipient."ACCOUNT_ID",
                    'schedule_update',
                    'Gig schedule updated for "' || NEW."Event_Title" || '"',
                    v_content,
                    '/ArtistNavEvents?jobId=' || NEW."Job_ID",
                    'schedule_update',
                    v_initials,
                    'View Gig',
                    NULL,
                    NEW."Job_ID",
                    'JOB_LISTING',
                    '{}'::jsonb,
                    v_host_account_id
                );
            END IF;
        END LOOP;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -----------------------------------------------------------------------------
-- 3. UPDATE TRIGGER: trg_notify_job_cancelled
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_job_cancelled()
RETURNS TRIGGER AS $$
DECLARE
    v_business_name TEXT;
    v_host_account_id UUID;
    v_initials TEXT;
    r_recipient RECORD;
BEGIN
    IF NEW."Status" = 'Cancelled' AND (OLD."Status" IS DISTINCT FROM 'Cancelled') THEN
        SELECT bp."Business_Name", bp."ACCOUNT_ID" 
        INTO v_business_name, v_host_account_id
        FROM public."BUSINESS_PROFILE" bp
        WHERE bp."BUSINESS_ID" = NEW."Posted_By_BUSINESS_ID";

        IF v_host_account_id IS NULL THEN
            v_host_account_id := auth.uid();
        END IF;

        v_initials := UPPER(SUBSTRING(COALESCE(v_business_name, 'Host'), 1, 2));

        -- Notify each associated artist account EXACTLY ONCE
        FOR r_recipient IN
            SELECT DISTINCT a."ACCOUNT_ID"
            FROM (
                SELECT c."Provider_Artist_ID" AS artist_id
                FROM public."BOOKING_CONTRACT" c
                WHERE c."Job_ID" = NEW."Job_ID"
                  AND c."Status" NOT IN ('Cancelled', 'Declined')
                UNION
                SELECT app."Artist_ID" AS artist_id
                FROM public."APPLICATION" app
                WHERE app."Job_ID" = NEW."Job_ID"
                  AND app."Status" IN ('Pending', 'Reviewing', 'Shortlisted', 'Accepted')
            ) rec
            JOIN public."ARTIST" a ON a."ARTIST_ID" = rec.artist_id
            WHERE a."ACCOUNT_ID" IS NOT NULL
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public."NOTIFICATION"
                WHERE "Account_ID" = r_recipient."ACCOUNT_ID"
                  AND "Entity_ID" = NEW."Job_ID"
                  AND "Svg_Type" = 'job_cancelled'
                  AND "Created_At" > NOW() - INTERVAL '10 seconds'
            ) THEN
                PERFORM public.send_notification(
                    r_recipient."ACCOUNT_ID",
                    'job_cancelled',
                    'Gig "' || NEW."Event_Title" || '" was cancelled',
                    COALESCE(v_business_name, 'The host') || ' cancelled gig "**' || NEW."Event_Title" || '**": ' || COALESCE(NEW."Cancellation_Reason", 'No cancellation reason provided.'),
                    '/ArtistNavEvents',
                    'job_cancelled',
                    v_initials,
                    NULL,
                    NULL,
                    NEW."Job_ID",
                    'JOB_LISTING',
                    '{}'::jsonb,
                    v_host_account_id
                );
            END IF;
        END LOOP;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -----------------------------------------------------------------------------
-- 4. UPDATE TRIGGER: trg_notify_contract_schedule_update (For Direct Bookings)
-- Compares before/after values and notifies other party when contract terms change
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_contract_schedule_update()
RETURNS TRIGGER AS $$
DECLARE
    v_artist_account_id UUID;
    v_requester_account_id UUID := NEW."Requester_Account_ID";
    v_business_name TEXT;
    v_artist_name TEXT;
    v_code TEXT := COALESCE(NEW."Contract_Code", 'Contract');
    v_change_list TEXT[] := ARRAY[]::TEXT[];
    v_changes_summary TEXT;
    v_content TEXT;
    v_old_time TEXT;
    v_new_time TEXT;
    v_recipient UUID;
    v_sender UUID;
    v_initials TEXT;
BEGIN
    -- Only for standalone/direct contracts (Job_ID IS NULL) to prevent duplicate notifications with JOB_LISTING
    IF NEW."Job_ID" IS NULL 
        AND NEW."Status" NOT IN ('Cancelled', 'Declined', 'Completed')
        AND (OLD."Start_Date" IS DISTINCT FROM NEW."Start_Date"
            OR OLD."End_Date" IS DISTINCT FROM NEW."End_Date"
            OR OLD."Start_Time" IS DISTINCT FROM NEW."Start_Time"
            OR OLD."End_Time" IS DISTINCT FROM NEW."End_Time"
            OR OLD."Venue_Location" IS DISTINCT FROM NEW."Venue_Location"
            OR OLD."Agreed_Fee" IS DISTINCT FROM NEW."Agreed_Fee")
    THEN
        SELECT a."ACCOUNT_ID", COALESCE(sa."Artist_Name", b."Band_Name", 'Artist')
        INTO v_artist_account_id, v_artist_name
        FROM public."ARTIST" a
        LEFT JOIN public."SOLO_ARTIST" sa ON sa."ARTIST_ID" = a."ARTIST_ID"
        LEFT JOIN public."BAND" b ON b."ARTIST_ID" = a."ARTIST_ID"
        WHERE a."ARTIST_ID" = NEW."Provider_Artist_ID";

        IF NEW."Provider_Business_ID" IS NOT NULL THEN
            SELECT bp."Business_Name" INTO v_business_name
            FROM public."BUSINESS_PROFILE" bp
            WHERE bp."BUSINESS_ID" = NEW."Provider_Business_ID";
        END IF;

        -- 1. Date Diff
        IF OLD."Start_Date" IS DISTINCT FROM NEW."Start_Date" OR OLD."End_Date" IS DISTINCT FROM NEW."End_Date" THEN
            v_change_list := array_append(
                v_change_list, 
                'Date changed from **' || 
                COALESCE(TO_CHAR(OLD."Start_Date", 'YYYY-MM-DD'), 'TBD') || 
                CASE WHEN OLD."End_Date" IS NOT NULL AND OLD."End_Date" <> OLD."Start_Date" THEN ' - ' || TO_CHAR(OLD."End_Date", 'YYYY-MM-DD') ELSE '' END || 
                '** to **' || 
                COALESCE(TO_CHAR(NEW."Start_Date", 'YYYY-MM-DD'), 'TBD') || 
                CASE WHEN NEW."End_Date" IS NOT NULL AND NEW."End_Date" <> NEW."Start_Date" THEN ' - ' || TO_CHAR(NEW."End_Date", 'YYYY-MM-DD') ELSE '' END || 
                '**'
            );
        END IF;

        -- 2. Time Diff (Standard 12-hour Clock: e.g. 12:00 PM - 02:30 PM)
        IF OLD."Start_Time" IS DISTINCT FROM NEW."Start_Time" OR OLD."End_Time" IS DISTINCT FROM NEW."End_Time" THEN
            v_old_time := public.format_time_12h(OLD."Start_Time") || 
                CASE WHEN OLD."End_Time" IS NOT NULL AND TRIM(OLD."End_Time") <> '' THEN ' - ' || public.format_time_12h(OLD."End_Time") ELSE '' END;
            v_new_time := public.format_time_12h(NEW."Start_Time") || 
                CASE WHEN NEW."End_Time" IS NOT NULL AND TRIM(NEW."End_Time") <> '' THEN ' - ' || public.format_time_12h(NEW."End_Time") ELSE '' END;
            v_change_list := array_append(v_change_list, 'Time changed from **' || v_old_time || '** to **' || v_new_time || '**');
        END IF;

        -- 3. Venue Diff
        IF OLD."Venue_Location" IS DISTINCT FROM NEW."Venue_Location" THEN
            v_change_list := array_append(
                v_change_list, 
                'Venue changed from **' || COALESCE(OLD."Venue_Location", 'TBD') || '** to **' || COALESCE(NEW."Venue_Location", 'TBD') || '**'
            );
        END IF;

        -- 4. Agreed Fee Diff
        IF OLD."Agreed_Fee" IS DISTINCT FROM NEW."Agreed_Fee" THEN
            v_change_list := array_append(
                v_change_list, 
                'Fee changed from **₱' || COALESCE(TO_CHAR(OLD."Agreed_Fee", 'FM999,999,999.00'), '0.00') || 
                '** to **₱' || COALESCE(TO_CHAR(NEW."Agreed_Fee", 'FM999,999,999.00'), '0.00') || '**'
            );
        END IF;

        IF array_length(v_change_list, 1) > 0 THEN
            v_changes_summary := array_to_string(v_change_list, ' • ');
            v_content := 'Terms for contract **' || v_code || '** were updated: ' || v_changes_summary || '.';

            -- Determine who changed it and notify the other party
            IF auth.uid() = v_artist_account_id THEN
                v_recipient := v_requester_account_id;
                v_sender := v_artist_account_id;
                v_initials := UPPER(SUBSTRING(COALESCE(v_artist_name, 'Artist'), 1, 2));
            ELSE
                v_recipient := v_artist_account_id;
                v_sender := v_requester_account_id;
                v_initials := UPPER(SUBSTRING(COALESCE(v_business_name, 'Host'), 1, 2));
            END IF;

            IF v_recipient IS NOT NULL THEN
                PERFORM public.send_notification(
                    v_recipient,
                    'schedule_update',
                    'Booking terms updated for ' || v_code,
                    v_content,
                    CASE WHEN v_recipient = v_artist_account_id 
                         THEN '/ArtistNavEvents?contractId=' || NEW."Booking_ID"
                         ELSE '/BusinessContracts?contractId=' || NEW."Booking_ID" END,
                    'schedule_update',
                    v_initials,
                    'View Contract',
                    NULL,
                    NEW."Booking_ID",
                    'BOOKING_CONTRACT',
                    '{}'::jsonb,
                    v_sender
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_booking_contract_schedule_update ON public."BOOKING_CONTRACT";
CREATE TRIGGER trg_booking_contract_schedule_update
AFTER UPDATE ON public."BOOKING_CONTRACT"
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_contract_schedule_update();


-- -----------------------------------------------------------------------------
-- 5. UPDATE TRIGGER: trg_notify_contract_status_change
-- Uses standard 12-hour clock and bold markdown highlights
-- -----------------------------------------------------------------------------
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

    IF NEW."Provider_Business_ID" IS NOT NULL THEN
        SELECT bp."Business_Name" INTO v_business_name
        FROM public."BUSINESS_PROFILE" bp
        WHERE bp."BUSINESS_ID" = NEW."Provider_Business_ID";
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

    -- 2. Contract Cancelled -> Notify the other party
    ELSIF NEW."Status" = 'Cancelled' AND (OLD."Status" IS DISTINCT FROM 'Cancelled') THEN
        IF NEW."Cancelled_By" = v_requester_account_id AND v_artist_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_artist_account_id,
                'contract_cancel',
                'Contract ' || v_code || ' was cancelled',
                'Booking for **' || v_code || '** was cancelled: ' || COALESCE(NEW."Cancellation_Reason", 'No reason provided.'),
                '/ArtistNavEvents',
                'contract_cancel',
                UPPER(SUBSTRING(COALESCE(v_business_name, 'Host'), 1, 2)),
                NULL,
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT',
                '{}'::jsonb,
                v_requester_account_id
            );
        ELSIF NEW."Cancelled_By" = v_artist_account_id AND v_requester_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_requester_account_id,
                'contract_cancel',
                'Contract ' || v_code || ' was cancelled by artist',
                'Performer cancelled **' || v_code || '**: ' || COALESCE(NEW."Cancellation_Reason", 'No reason provided.'),
                '/BusinessContracts',
                'contract_cancel',
                UPPER(SUBSTRING(COALESCE(v_artist_name, 'Performer'), 1, 2)),
                NULL,
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT',
                '{}'::jsonb,
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


-- -----------------------------------------------------------------------------
-- 6. UPDATE TRIGGER: trg_notify_band_invite & trg_notify_band_invite_response
-- Adds bold markdown highlights
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_band_invite()
RETURNS TRIGGER AS $$
DECLARE
    v_band_name TEXT;
    v_initials TEXT;
BEGIN
    SELECT b."Band_Name" INTO v_band_name 
    FROM public."BAND" b WHERE b."ARTIST_ID" = NEW."Band_ID";

    v_initials := UPPER(SUBSTRING(COALESCE(v_band_name, 'TONO'), 1, 2));

    PERFORM public.send_notification(
        NEW."Member_ID",
        'band_invite',
        COALESCE(v_band_name, 'A band') || ' invited you to join Band',
        'Invited as **' || COALESCE(NEW."Instrument_Role", 'Member') || '** to join **' || COALESCE(v_band_name, 'the band') || '** for upcoming performances.',
        '/Artistprofile',
        'band_invite',
        v_initials,
        'Accept',
        'Decline',
        NEW."Band_ID",
        'BAND_MEMBERS'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_notify_band_invite_response()
RETURNS TRIGGER AS $$
DECLARE
    v_leader_account_ID UUID;
    v_band_name TEXT;
    v_responder_name TEXT;
    v_initials TEXT;
BEGIN
    IF NEW."Status" IN ('Accepted', 'Declined') AND (OLD."Status" IS DISTINCT FROM NEW."Status") THEN
        SELECT a."ACCOUNT_ID", b."Band_Name" INTO v_leader_account_ID, v_band_name
        FROM public."BAND" b
        JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
        WHERE b."ARTIST_ID" = NEW."Band_ID";

        SELECT u."Username" INTO v_responder_name
        FROM public."USER_ACCOUNT" u
        WHERE u."ACCOUNT_ID" = NEW."Member_ID";

        v_initials := UPPER(SUBSTRING(COALESCE(v_responder_name, 'TONO'), 1, 2));

        IF v_leader_account_ID IS NOT NULL THEN
            IF NEW."Status" = 'Accepted' THEN
                PERFORM public.send_notification(
                    v_leader_account_ID,
                    'band_joined',
                    COALESCE(v_responder_name, 'A musician') || ' accepted your band invitation!',
                    'Status changed from **Pending** to **Accepted**! Now an active member of **' || COALESCE(v_band_name, 'your band') || '** as **' || COALESCE(NEW."Instrument_Role", 'Member') || '**.',
                    '/Artistprofile?tab=posts',
                    'band_joined',
                    v_initials,
                    NULL,
                    NULL,
                    NEW."Band_ID",
                    'BAND_MEMBERS'
                );
            ELSE
                PERFORM public.send_notification(
                    v_leader_account_ID,
                    'band_declined',
                    COALESCE(v_responder_name, 'A musician') || ' declined the invitation to join ' || COALESCE(v_band_name, 'your band') || '.',
                    'Status changed from **Pending** to **Declined** for **' || COALESCE(v_band_name, 'your band') || '**.',
                    '/Artistprofile?tab=posts',
                    'band_declined',
                    v_initials,
                    NULL,
                    NULL,
                    NEW."Band_ID",
                    'BAND_MEMBERS'
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -----------------------------------------------------------------------------
-- 7. UPDATE TRIGGER: trg_notify_application_submitted
-- Adds bold markdown highlights
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_application_submitted()
RETURNS TRIGGER AS $$
DECLARE
    v_host_account_id UUID;
    v_event_title TEXT;
    v_artist_name TEXT;
    v_initials TEXT;
BEGIN
    SELECT b."ACCOUNT_ID", j."Event_Title"
    INTO v_host_account_id, v_event_title
    FROM public."JOB_LISTING" j
    JOIN public."BUSINESS_PROFILE" b ON b."BUSINESS_ID" = j."Posted_By_BUSINESS_ID"
    WHERE j."Job_ID" = NEW."Job_ID";

    SELECT COALESCE(sa."Artist_Name", bd."Band_Name", u."Username", 'Artist')
    INTO v_artist_name
    FROM public."ARTIST" a
    LEFT JOIN public."SOLO_ARTIST" sa ON sa."ARTIST_ID" = a."ARTIST_ID"
    LEFT JOIN public."BAND" bd ON bd."ARTIST_ID" = a."ARTIST_ID"
    LEFT JOIN public."USER_ACCOUNT" u ON u."ACCOUNT_ID" = a."ACCOUNT_ID"
    WHERE a."ARTIST_ID" = NEW."Artist_ID";

    v_initials := UPPER(SUBSTRING(COALESCE(v_artist_name, 'TONO'), 1, 2));

    IF v_host_account_id IS NOT NULL THEN
        PERFORM public.send_notification(
            v_host_account_id,
            'contract_submission',
            'New Application: ' || COALESCE(v_artist_name, 'An artist') || ' applied for "' || COALESCE(v_event_title, 'Listing') || '"',
            'Proposed fee: **₱' || COALESCE(TO_CHAR(NEW."Proposed_Fee", 'FM999,999,999.00'), '0.00') || '**' || 
            CASE WHEN NEW."Pitch_Message" IS NOT NULL AND TRIM(NEW."Pitch_Message") <> '' THEN '. Pitch: "' || NEW."Pitch_Message" || '"' ELSE '.' END,
            '/BusinessJobApp?jobId=' || NEW."Job_ID",
            'contract_submission',
            v_initials,
            'Review Application',
            NULL,
            NEW."Application_ID",
            'APPLICATION'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
