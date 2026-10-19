-- =============================================================================
-- Migration: 20261020002000_add_direct_booking_notification_trigger.sql
-- Description:
--   Automated trigger on BOOKING_CONTRACT AFTER INSERT:
--   When a new contract is created with Status 'Pending_Artist_Approval' or 'Pending',
--   automatically dispatches a real-time notification to the artist's account.
--   Includes deduplication guard to prevent double-inserting if dispatched by client.
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

            -- Idempotency Guard: prevent duplicate notification if client inserted within last 10 seconds
            IF NOT EXISTS (
                SELECT 1 FROM public."NOTIFICATION"
                WHERE "Account_ID" = v_artist_account_id
                  AND "Entity_ID" = NEW."Booking_ID"
                  AND "Created_At" > NOW() - INTERVAL '10 seconds'
            ) THEN
                PERFORM public.send_notification(
                    v_artist_account_id,
                    'direct_booking_offer',
                    CASE 
                        WHEN v_is_direct THEN 'Direct Booking Offer • ' || v_code
                        ELSE 'Contract Offer • ' || v_code
                    END,
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
                        'is_direct', v_is_direct
                    ),
                    NEW."Requester_Account_ID"
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_booking_contract_created_notify ON public."BOOKING_CONTRACT";
CREATE TRIGGER trg_booking_contract_created_notify
AFTER INSERT ON public."BOOKING_CONTRACT"
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_booking_contract_created();
