-- =============================================================================
-- Migration: 20261001000000_enhance_notifications_schema.sql
-- Description: Enhances NOTIFICATION table with structured columns (Title,
--              Category, Svg_Type, Avatar_Text, Actions, Entity references,
--              Metadata), enables Realtime CDC replication on NOTIFICATION,
--              BOOKING_CONTRACT, and APPLICATION, provides a SECURITY DEFINER
--              send_notification RPC, and automates notifications via triggers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENHANCE NOTIFICATION TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE public."NOTIFICATION"
    ADD COLUMN IF NOT EXISTS "Sender_Account_ID" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "Title" TEXT,
    ADD COLUMN IF NOT EXISTS "Category" TEXT DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS "Svg_Type" TEXT DEFAULT 'job_posted',
    ADD COLUMN IF NOT EXISTS "Avatar_Text" TEXT DEFAULT 'TONO',
    ADD COLUMN IF NOT EXISTS "Action_Primary" TEXT,
    ADD COLUMN IF NOT EXISTS "Action_Secondary" TEXT,
    ADD COLUMN IF NOT EXISTS "Entity_ID" UUID,
    ADD COLUMN IF NOT EXISTS "Entity_Type" TEXT,
    ADD COLUMN IF NOT EXISTS "Metadata" JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notification_sender ON public."NOTIFICATION"("Sender_Account_ID");
CREATE INDEX IF NOT EXISTS idx_notification_entity ON public."NOTIFICATION"("Entity_ID", "Entity_Type");
CREATE INDEX IF NOT EXISTS idx_notification_svg_type ON public."NOTIFICATION"("Svg_Type");

-- -----------------------------------------------------------------------------
-- 2. CONFIGURE SUPABASE REALTIME REPLICATION (CDC)
-- -----------------------------------------------------------------------------
-- Add tables to supabase_realtime publication so WebSockets stream row changes
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."NOTIFICATION";
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."BOOKING_CONTRACT";
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."APPLICATION";
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

ALTER TABLE public."NOTIFICATION" REPLICA IDENTITY FULL;
ALTER TABLE public."BOOKING_CONTRACT" REPLICA IDENTITY FULL;
ALTER TABLE public."APPLICATION" REPLICA IDENTITY FULL;


-- -----------------------------------------------------------------------------
-- 3. SECURITY DEFINER HELPER: send_notification
-- Bypasses client-side RLS restriction when Account A notifies Account B
-- -----------------------------------------------------------------------------
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
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_notif_id UUID;
BEGIN
    INSERT INTO public."NOTIFICATION" (
        "Account_ID",
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
-- 4. AUTOMATED DATABASE TRIGGERS
-- -----------------------------------------------------------------------------

-- Trigger A: Band Invite Created -> Notify Invited Musician
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
        'Invited as ' || COALESCE(NEW."Instrument_Role", 'Member') || ' for upcoming performances.',
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

DROP TRIGGER IF EXISTS trg_band_members_invite ON public."BAND_MEMBERS";
CREATE TRIGGER trg_band_members_invite
AFTER INSERT ON public."BAND_MEMBERS"
FOR EACH ROW
WHEN (NEW."Status" = 'Pending')
EXECUTE FUNCTION public.trg_notify_band_invite();


-- Trigger B: Band Invite Accepted / Declined -> Notify Band Leader
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
                    'Now an active member of ' || COALESCE(v_band_name, 'your band') || ' as ' || COALESCE(NEW."Instrument_Role", 'Member') || '.',
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
                    'Invitation was declined.',
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

DROP TRIGGER IF EXISTS trg_band_members_invite_response ON public."BAND_MEMBERS";
CREATE TRIGGER trg_band_members_invite_response
AFTER UPDATE OF "Status" ON public."BAND_MEMBERS"
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_band_invite_response();


-- Trigger C: Booking Contract Status Changes (Confirmed, Cancelled, Declined)
CREATE OR REPLACE FUNCTION public.trg_notify_contract_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_artist_account_id UUID;
    v_requester_account_id UUID := NEW."Requester_Account_ID";
    v_business_name TEXT;
    v_artist_name TEXT;
    v_code TEXT := COALESCE(NEW."Contract_Code", 'Contract');
BEGIN
    -- Get Artist Account ID and name
    SELECT a."ACCOUNT_ID", COALESCE(sa."Artist_Name", b."Band_Name", 'Artist')
    INTO v_artist_account_id, v_artist_name
    FROM public."ARTIST" a
    LEFT JOIN public."SOLO_ARTIST" sa ON sa."ARTIST_ID" = a."ARTIST_ID"
    LEFT JOIN public."BAND" b ON b."ARTIST_ID" = a."ARTIST_ID"
    WHERE a."ARTIST_ID" = NEW."Provider_Artist_ID";

    -- Get Business Name if provider/requester is business
    IF NEW."Provider_Business_ID" IS NOT NULL THEN
        SELECT bp."Business_Name" INTO v_business_name
        FROM public."BUSINESS_PROFILE" bp
        WHERE bp."BUSINESS_ID" = NEW."Provider_Business_ID";
    END IF;

    -- 1. Contract Confirmed -> Notify Requester / Host
    IF NEW."Status" = 'Confirmed' AND (OLD."Status" IS DISTINCT FROM 'Confirmed') THEN
        IF v_requester_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_requester_account_id,
                'booking_confirmed',
                COALESCE(v_artist_name, 'Artist') || ' confirmed booking ' || v_code || '!',
                'Performance date is confirmed for ' || COALESCE(TO_CHAR(NEW."Start_Date", 'Mon DD, YYYY'), 'scheduled date') || '.',
                '/BusinessContracts?contractId=' || NEW."Booking_ID",
                'booking_confirmed',
                UPPER(SUBSTRING(COALESCE(v_artist_name, 'TONO'), 1, 2)),
                'View Contract',
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT'
            );
        END IF;

    -- 2. Contract Cancelled -> Notify the other party
    ELSIF NEW."Status" = 'Cancelled' AND (OLD."Status" IS DISTINCT FROM 'Cancelled') THEN
        -- Notify Artist if requester cancelled
        IF NEW."Cancelled_By" = v_requester_account_id AND v_artist_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_artist_account_id,
                'contract_cancel',
                'Contract ' || v_code || ' was cancelled',
                'Booking was cancelled: ' || COALESCE(NEW."Cancellation_Reason", 'No reason provided.'),
                '/ArtistNavEvents',
                'contract_cancel',
                UPPER(SUBSTRING(COALESCE(v_business_name, 'Host'), 1, 2)),
                NULL,
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT'
            );
        -- Notify Requester if artist cancelled
        ELSIF NEW."Cancelled_By" = v_artist_account_id AND v_requester_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_requester_account_id,
                'contract_cancel',
                'Contract ' || v_code || ' was cancelled by artist',
                'Performer cancelled: ' || COALESCE(NEW."Cancellation_Reason", 'No reason provided.'),
                '/BusinessContracts',
                'contract_cancel',
                UPPER(SUBSTRING(COALESCE(v_artist_name, 'Performer'), 1, 2)),
                NULL,
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT'
            );
        END IF;

    -- 3. Contract Declined -> Notify Requester
    ELSIF NEW."Status" = 'Declined' AND (OLD."Status" IS DISTINCT FROM 'Declined') THEN
        IF v_requester_account_id IS NOT NULL THEN
            PERFORM public.send_notification(
                v_requester_account_id,
                'contract_declined',
                COALESCE(v_artist_name, 'Artist') || ' declined contract offer ' || v_code,
                'The artist was unable to accept this booking request.',
                '/BusinessContracts',
                'contract_declined',
                UPPER(SUBSTRING(COALESCE(v_artist_name, 'Performer'), 1, 2)),
                NULL,
                NULL,
                NEW."Booking_ID",
                'BOOKING_CONTRACT'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_booking_contract_status_notify ON public."BOOKING_CONTRACT";
CREATE TRIGGER trg_booking_contract_status_notify
AFTER UPDATE OF "Status" ON public."BOOKING_CONTRACT"
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_contract_status_change();


-- Trigger D: Application Submitted -> Notify Business Host
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
            'Proposed fee: ₱' || COALESCE(TO_CHAR(NEW."Proposed_Fee", 'FM999,999,999.00'), '0.00') || '. Pitch: "' || COALESCE(NEW."Pitch_Message", '') || '"',
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

DROP TRIGGER IF EXISTS trg_application_submitted_notify ON public."APPLICATION";
CREATE TRIGGER trg_application_submitted_notify
AFTER INSERT ON public."APPLICATION"
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_application_submitted();


-- -----------------------------------------------------------------------------
-- 5. RLS INSERT POLICY FIX ON NOTIFICATION
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
-- 6. AUTOMATED TRIGGER: JOB_LISTING Schedule / Details Updated
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
    IF (OLD."Start_Date" IS DISTINCT FROM NEW."Start_Date"
        OR OLD."End_Date" IS DISTINCT FROM NEW."End_Date"
        OR OLD."Start_Time" IS DISTINCT FROM NEW."Start_Time"
        OR OLD."End_Time" IS DISTINCT FROM NEW."End_Time"
        OR OLD."Location" IS DISTINCT FROM NEW."Location"
        OR OLD."Compensation_Fee" IS DISTINCT FROM NEW."Compensation_Fee")
        AND NEW."Status" NOT IN ('Draft', 'Cancelled')
    THEN
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
-- 7. AUTOMATED TRIGGER: JOB_LISTING Cancelled
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
