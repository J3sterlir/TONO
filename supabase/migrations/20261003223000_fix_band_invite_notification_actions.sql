-- =============================================================================
-- Migration: Fix Band Invite Notification Actions & Stale Statuses
-- Description:
--   1. Updates trg_notify_band_invite_response to clear Action_Primary /
--      Action_Secondary and update Content on the invitee's notification
--      upon accepting or declining.
--   2. Updates existing stale band_invite notifications where membership
--      status is already Accepted or Declined.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_notify_band_invite_response()
RETURNS TRIGGER AS $$
DECLARE
    v_leader_account_ID UUID;
    v_band_name TEXT;
    v_responder_name TEXT;
    v_initials TEXT;
BEGIN
    IF NEW."Status" IN ('Accepted', 'Declined') AND (OLD."Status" IS DISTINCT FROM NEW."Status") THEN
        -- 1. Clear action buttons on the original invite notification for the solo artist
        UPDATE public."NOTIFICATION"
        SET 
            "Action_Primary" = NULL,
            "Action_Secondary" = NULL,
            "Content" = CASE 
                WHEN NEW."Status" = 'Accepted' THEN '✓ Invitation accepted! Welcome to the band.'
                ELSE 'Invitation declined.'
            END,
            "Is_Read" = TRUE
        WHERE "Account_ID" = NEW."Member_ID"
          AND "Type" = 'band_invite'
          AND "Entity_ID" = NEW."Band_ID";

        -- 2. Find band leader to notify
        SELECT a."ACCOUNT_ID", b."Band_Name" INTO v_leader_account_ID, v_band_name
        FROM public."BAND" b
        JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
        WHERE b."ARTIST_ID" = NEW."Band_ID";

        SELECT COALESCE(sa."Artist_Name", u."Username", 'Solo Artist') INTO v_responder_name
        FROM public."USER_ACCOUNT" u
        LEFT JOIN public."ARTIST" a ON a."ACCOUNT_ID" = u."ACCOUNT_ID" AND a."Artist_Type" = 'Solo'
        LEFT JOIN public."SOLO_ARTIST" sa ON sa."ARTIST_ID" = a."ARTIST_ID"
        WHERE u."ACCOUNT_ID" = NEW."Member_ID";

        v_initials := UPPER(SUBSTRING(COALESCE(v_responder_name, 'TONO'), 1, 2));

        IF v_leader_account_ID IS NOT NULL THEN
            IF NEW."Status" = 'Accepted' THEN
                -- Band side: SoloArtistName **accepted** your band member invitation.
                PERFORM public.send_notification(
                    v_leader_account_ID,
                    'band_joined',
                    COALESCE(v_responder_name, 'Solo Artist') || ' **accepted** your band member invitation.',
                    'Now an active member of ' || COALESCE(v_band_name, 'your band') || ' as ' || COALESCE(NEW."Instrument_Role", 'Member') || '.',
                    '/Artistprofile?tab=members',
                    'band_joined',
                    v_initials,
                    NULL,
                    NULL,
                    NEW."Band_ID",
                    'BAND_MEMBERS'
                );
            ELSE
                -- Band side: SoloArtistName **rejected** your band member invitation.
                PERFORM public.send_notification(
                    v_leader_account_ID,
                    'band_declined',
                    COALESCE(v_responder_name, 'Solo Artist') || ' **rejected** your band member invitation.',
                    'The invitation to join ' || COALESCE(v_band_name, 'your band') || ' was declined.',
                    '/Artistprofile?tab=members',
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

-- 3. Clean up existing stale notifications in database
UPDATE public."NOTIFICATION" n
SET 
    "Action_Primary" = NULL,
    "Action_Secondary" = NULL,
    "Content" = CASE 
        WHEN bm."Status" = 'Accepted' THEN '✓ Invitation accepted! Welcome to the band.'
        ELSE 'Invitation declined.'
    END,
    "Is_Read" = TRUE
FROM public."BAND_MEMBERS" bm
WHERE n."Account_ID" = bm."Member_ID"
  AND n."Type" = 'band_invite'
  AND n."Entity_ID" = bm."Band_ID"
  AND bm."Status" IN ('Accepted', 'Declined');
