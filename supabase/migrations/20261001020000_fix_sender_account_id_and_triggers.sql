-- =============================================================================
-- Migration: 20261001020000_fix_sender_account_id_and_triggers.sql
-- Description: 
--   1. Ensures Sender_Account_ID column exists on NOTIFICATION.
--   2. Updates public.send_notification RPC with p_sender_account_id (falling back to auth.uid()).
--   3. Updates triggers on JOB_LISTING (schedule update & cancelled) to populate Sender_Account_ID from BUSINESS_PROFILE.ACCOUNT_ID.
--   4. Backfills existing NOTIFICATION rows where Sender_Account_ID is NULL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENSURE Sender_Account_ID COLUMN AND INDEX EXIST
-- -----------------------------------------------------------------------------
ALTER TABLE public."NOTIFICATION"
    ADD COLUMN IF NOT EXISTS "Sender_Account_ID" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_sender ON public."NOTIFICATION"("Sender_Account_ID");


-- -----------------------------------------------------------------------------
-- 2. UPDATE send_notification TO ACCEPT AND PERSIST Sender_Account_ID
-- -----------------------------------------------------------------------------
-- Drop older overloaded variants to prevent duplicate parameter signature conflicts
DROP FUNCTION IF EXISTS public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.send_notification(
    p_account_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_content TEXT,
    p_action_link TEXT DEFAULT NULL,
    p_svg_type TEXT DEFAULT 'job_posted',
    p_avatar_text TEXT DEFAULT 'TONO',
    p_action_primary TEXT DEFAULT NULL,
    p_action_secondary TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_sender_account_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_notif_id UUID;
    v_actual_sender UUID := p_sender_account_id;
BEGIN
    -- Fallback to current authenticated caller if sender was not explicitly provided
    IF v_actual_sender IS NULL THEN
        v_actual_sender := auth.uid();
    END IF;

    INSERT INTO public."NOTIFICATION" (
        "Account_ID",
        "Sender_Account_ID",
        "Type",
        "Title",
        "Content",
        "Action_Link",
        "Svg_Type",
        "Avatar_Text",
        "Action_Primary",
        "Action_Secondary",
        "Entity_ID",
        "Entity_Type",
        "Metadata",
        "Is_Read",
        "Created_At"
    ) VALUES (
        p_account_id,
        v_actual_sender,
        p_type,
        p_title,
        p_content,
        p_action_link,
        p_svg_type,
        p_avatar_text,
        p_action_primary,
        p_action_secondary,
        p_entity_id,
        p_entity_type,
        p_metadata,
        FALSE,
        NOW()
    ) RETURNING "Notification_ID" INTO v_notif_id;

    RETURN v_notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -----------------------------------------------------------------------------
-- 3. UPDATE TRIGGER FUNCTION: JOB_LISTING Schedule / Details Updated
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_job_schedule_update()
RETURNS TRIGGER AS $$
DECLARE
    v_business_name TEXT;
    v_host_account_id UUID;
    v_initials TEXT;
    v_date_text TEXT;
    v_schedule_summary TEXT;
    r_contract RECORD;
    r_app RECORD;
BEGIN
    IF (OLD."Start_Date" IS DISTINCT FROM NEW."Start_Date"
        OR OLD."End_Date" IS DISTINCT FROM NEW."End_Date"
        OR OLD."Start_Time" IS DISTINCT FROM NEW."Start_Time"
        OR OLD."End_Time" IS DISTINCT FROM NEW."End_Time"
        OR OLD."Location" IS DISTINCT FROM NEW."Location"
        OR OLD."Compensation_Fee" IS DISTINCT FROM NEW."Compensation_Fee")
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
                        'BOOKING_CONTRACT',
                        '{}'::jsonb,
                        v_host_account_id
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
                        'JOB_LISTING',
                        '{}'::jsonb,
                        v_host_account_id
                    );
                END IF;
            END IF;
        END LOOP;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -----------------------------------------------------------------------------
-- 4. UPDATE TRIGGER FUNCTION: JOB_LISTING Cancelled
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_job_cancelled()
RETURNS TRIGGER AS $$
DECLARE
    v_business_name TEXT;
    v_host_account_id UUID;
    v_initials TEXT;
    r_target RECORD;
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
                    'BOOKING_CONTRACT',
                    '{}'::jsonb,
                    v_host_account_id
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
-- 5. BACKFILL EXISTING NOTIFICATION ROWS WHERE Sender_Account_ID IS NULL
-- -----------------------------------------------------------------------------
-- Backfill for notifications tied to JOB_LISTING
UPDATE public."NOTIFICATION" n
SET "Sender_Account_ID" = bp."ACCOUNT_ID"
FROM public."JOB_LISTING" j
JOIN public."BUSINESS_PROFILE" bp ON bp."BUSINESS_ID" = j."Posted_By_BUSINESS_ID"
WHERE n."Sender_Account_ID" IS NULL
  AND n."Entity_Type" = 'JOB_LISTING'
  AND n."Entity_ID" = j."Job_ID"
  AND bp."ACCOUNT_ID" IS NOT NULL;

-- Backfill for notifications tied to BOOKING_CONTRACT
UPDATE public."NOTIFICATION" n
SET "Sender_Account_ID" = COALESCE(c."Requester_Account_ID", bp."ACCOUNT_ID")
FROM public."BOOKING_CONTRACT" c
LEFT JOIN public."BUSINESS_PROFILE" bp ON bp."BUSINESS_ID" = c."Provider_Business_ID"
WHERE n."Sender_Account_ID" IS NULL
  AND n."Entity_Type" = 'BOOKING_CONTRACT'
  AND n."Entity_ID" = c."Booking_ID";
