-- =============================================================================
-- Migration: 20261020221000_update_job_application_accepted_notification.sql
-- Description:
--   Updates the automated trigger on BOOKING_CONTRACT AFTER INSERT so that
--   when a business host accepts a job application (NEW."Job_ID" IS NOT NULL),
--   the notification sent to the artist has:
--   - Main heading: Application Accepted • <Contract_Code>
--   - Content: <Business_Name> accepted your job application to perform at <address> on <date>.
--   - Quick action: Review & Sign
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_notify_booking_contract_created()
RETURNS TRIGGER AS $$
DECLARE
    v_artist_account_id UUID;
    v_client_name TEXT;
    v_client_initials TEXT;
    v_venue TEXT;
    v_date_str TEXT;
    v_fee_str TEXT;
    v_is_direct BOOLEAN;
    v_action_link TEXT;
    v_code TEXT;
BEGIN
    -- Only notify on contracts awaiting artist approval / review
    IF NEW."Status" IN ('Pending_Artist_Approval', 'Pending') THEN
        -- Resolve Artist Account ID
        SELECT a."ACCOUNT_ID" INTO v_artist_account_id
        FROM public."ARTIST" a
        WHERE a."ARTIST_ID" = NEW."Provider_Artist_ID";

        IF v_artist_account_id IS NOT NULL THEN
            v_code := COALESCE(NEW."Contract_Code", 'BK-OFFER');
            v_is_direct := (NEW."Job_ID" IS NULL);

            -- Resolve client/host name
            IF NEW."Provider_Business_ID" IS NOT NULL THEN
                SELECT bp."Business_Name" INTO v_client_name
                FROM public."BUSINESS_PROFILE" bp
                WHERE bp."BUSINESS_ID" = NEW."Provider_Business_ID";
            END IF;

            IF v_client_name IS NULL AND NEW."Requester_Account_ID" IS NOT NULL THEN
                SELECT ua."Username" INTO v_client_name
                FROM public."USER_ACCOUNT" ua
                WHERE ua."ACCOUNT_ID" = NEW."Requester_Account_ID";
            END IF;

            IF v_client_name IS NULL THEN
                v_client_name := CASE WHEN v_is_direct THEN 'A client' ELSE 'A venue host' END;
            END IF;

            v_client_initials := UPPER(SUBSTRING(COALESCE(v_client_name, 'BK'), 1, 2));
            v_venue := COALESCE(NEW."Venue_Location", 'scheduled venue');
            v_date_str := COALESCE(TO_CHAR(NEW."Start_Date", 'Mon DD, YYYY'), 'scheduled date');

            IF NEW."Agreed_Fee" IS NOT NULL THEN
                v_fee_str := ' • ₱' || TO_CHAR(NEW."Agreed_Fee", 'FM999,999,999');
            ELSE
                v_fee_str := '';
            END IF;

            v_action_link := '/Artistprofile?tab=gigs&contractId=' || NEW."Booking_ID";

            -- Idempotency Guard: prevent duplicate notification if inserted within last 10 seconds
            IF NOT EXISTS (
                SELECT 1 FROM public."NOTIFICATION"
                WHERE "Account_ID" = v_artist_account_id
                  AND ("Entity_ID" = NEW."Booking_ID" OR "Metadata"->>'contract_code' = v_code)
                  AND "Created_At" > NOW() - INTERVAL '10 seconds'
            ) THEN
                IF v_is_direct THEN
                    PERFORM public.send_notification(
                        v_artist_account_id,
                        'direct_booking_offer',
                        'Direct Booking Offer • ' || v_code,
                        v_client_name || ' sent a direct booking offer for **' || v_venue || '** on ' || v_date_str || v_fee_str || '. Review terms and sign contract to confirm.',
                        v_action_link,
                        'contract_offer',
                        v_client_initials,
                        'Review & Sign',
                        NULL,
                        NEW."Booking_ID",
                        'BOOKING_CONTRACT',
                        jsonb_build_object(
                            'contract_code', v_code,
                            'sender_name', v_client_name,
                            'venue', v_venue,
                            'fee', NEW."Agreed_Fee",
                            'start_date', NEW."Start_Date",
                            'is_direct', TRUE
                        ),
                        NEW."Requester_Account_ID"
                    );
                ELSE
                    -- Job Application Accepted Notification
                    PERFORM public.send_notification(
                        v_artist_account_id,
                        'contract_offer',
                        'Application Accepted • ' || v_code,
                        v_client_name || ' accepted your job application to perform at ' || v_venue || ' on ' || v_date_str || '.',
                        v_action_link,
                        'contract_offer',
                        v_client_initials,
                        'Review & Sign',
                        NULL,
                        NEW."Booking_ID",
                        'BOOKING_CONTRACT',
                        jsonb_build_object(
                            'contract_code', v_code,
                            'sender_name', v_client_name,
                            'venue', v_venue,
                            'fee', NEW."Agreed_Fee",
                            'start_date', NEW."Start_Date",
                            'is_direct', FALSE
                        ),
                        NEW."Requester_Account_ID"
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure JOB_LISTING remains marked as Open if booking slots are not yet filled
CREATE OR REPLACE FUNCTION public.close_job_listing_on_application_accepted()
RETURNS TRIGGER AS $$
DECLARE
    v_slots INTEGER;
    v_accepted_count INTEGER;
BEGIN
    IF NEW."Status" = 'Accepted' AND (OLD."Status" IS DISTINCT FROM 'Accepted') THEN
        SELECT COALESCE("Slots", 1) INTO v_slots
        FROM public."JOB_LISTING"
        WHERE "Job_ID" = NEW."Job_ID";

        SELECT COUNT(*) INTO v_accepted_count
        FROM public."APPLICATION"
        WHERE "Job_ID" = NEW."Job_ID" AND "Status" = 'Accepted';

        IF v_accepted_count >= COALESCE(v_slots, 1) THEN
            UPDATE public."JOB_LISTING"
            SET "Status" = 'Closed'
            WHERE "Job_ID" = NEW."Job_ID"
              AND "Status" != 'Closed';
        ELSE
            -- Ensure it stays Open if slots are not yet filled
            UPDATE public."JOB_LISTING"
            SET "Status" = 'Open'
            WHERE "Job_ID" = NEW."Job_ID"
              AND "Status" != 'Open';
        END IF;
    ELSIF (OLD."Status" = 'Accepted' AND NEW."Status" IS DISTINCT FROM 'Accepted') THEN
        -- If an accepted application was reverted/declined, reopen listing if slots open
        SELECT COALESCE("Slots", 1) INTO v_slots
        FROM public."JOB_LISTING"
        WHERE "Job_ID" = NEW."Job_ID";

        SELECT COUNT(*) INTO v_accepted_count
        FROM public."APPLICATION"
        WHERE "Job_ID" = NEW."Job_ID" AND "Status" = 'Accepted';

        IF v_accepted_count < COALESCE(v_slots, 1) THEN
            UPDATE public."JOB_LISTING"
            SET "Status" = 'Open'
            WHERE "Job_ID" = NEW."Job_ID"
              AND "Status" != 'Open';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_close_job_listing_on_application_accepted ON public."APPLICATION";
CREATE TRIGGER trg_close_job_listing_on_application_accepted
AFTER INSERT OR UPDATE OF "Status" ON public."APPLICATION"
FOR EACH ROW
EXECUTE FUNCTION public.close_job_listing_on_application_accepted();

