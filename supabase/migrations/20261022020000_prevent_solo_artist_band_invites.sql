-- =============================================================================
-- Migration: 20261022020000_prevent_solo_artist_band_invites.sql
-- Description:
--   1. Enforces at backend/database level that Solo artists CANNOT invite
--      members into a band roster. Only registered Bands (Artist_Type = 'Band')
--      can invite members.
--   2. Adds a BEFORE INSERT trigger on BAND_MEMBERS to reject any invite
--      where Band_ID is not a registered Band.
--   3. Updates invite_band_member RPC with strict Artist_Type = 'Band' validation.
--   4. Updates trg_notify_band_invite() so that when a band invites a solo artist,
--      the notification Action_Link points to the band's public profile (/artist/<username>)
--      instead of /Artistprofile?tab=members, preventing solo artists from accessing
--      the band roster management tab.
--   5. Cleans up existing band_invite notifications where Action_Link was set to tab=members.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Database-level BEFORE INSERT trigger on BAND_MEMBERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_prevent_solo_artist_band_invite()
RETURNS TRIGGER AS $$
DECLARE
    v_artist_type TEXT;
BEGIN
    SELECT a."Artist_Type" INTO v_artist_type
    FROM public."ARTIST" a
    WHERE a."ARTIST_ID" = NEW."Band_ID";

    IF v_artist_type IS DISTINCT FROM 'Band' THEN
        RAISE EXCEPTION 'Solo artists cannot invite members or create band rosters. Only registered Bands can invite members.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_solo_artist_band_invite ON public."BAND_MEMBERS";
CREATE TRIGGER trg_prevent_solo_artist_band_invite
BEFORE INSERT OR UPDATE OF "Band_ID" ON public."BAND_MEMBERS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_solo_artist_band_invite();


-- -----------------------------------------------------------------------------
-- 2. Update invite_band_member RPC with strict Band validation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_band_member(
    p_band_id UUID,
    p_member_account_id UUID,
    p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_artist_type TEXT;
    v_band_exists BOOLEAN;
    v_normalized_role TEXT;
    v_existing_status TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Verify that the caller is registered as a Band (Solo artists cannot invite members)
    SELECT a."Artist_Type" INTO v_caller_artist_type
    FROM public."ARTIST" a
    WHERE a."ACCOUNT_ID" = v_caller_id
      AND a."ARTIST_ID" = p_band_id;

    IF v_caller_artist_type IS NULL OR v_caller_artist_type != 'Band' THEN
        RAISE EXCEPTION 'Unauthorized: Only registered Bands can invite members. Solo artists cannot invite members.';
    END IF;

    -- Verify ownership of the band
    SELECT EXISTS (
        SELECT 1 
        FROM public."BAND" b
        WHERE b."ARTIST_ID" = p_band_id
    ) INTO v_band_exists;

    IF NOT v_band_exists THEN
        RAISE EXCEPTION 'Band record not found for this artist.';
    END IF;

    -- Verify caller cannot invite themselves
    IF v_caller_id = p_member_account_id THEN
        RAISE EXCEPTION 'You cannot invite yourself to your own band.';
    END IF;

    -- Check if target user account exists
    IF NOT EXISTS (SELECT 1 FROM public."USER_ACCOUNT" WHERE "ACCOUNT_ID" = p_member_account_id) THEN
        RAISE EXCEPTION 'Target artist user account not found.';
    END IF;

    -- Normalize role
    v_normalized_role := public.normalize_band_role(p_role);

    -- Check existing status
    SELECT "Status" INTO v_existing_status
    FROM public."BAND_MEMBERS"
    WHERE "Band_ID" = p_band_id AND "Member_ID" = p_member_account_id;

    IF v_existing_status = 'Accepted' THEN
        RAISE EXCEPTION 'This artist is already an active member of your band.';
    END IF;

    IF v_existing_status = 'Pending' THEN
        RAISE EXCEPTION 'An invitation is already pending for this artist.';
    END IF;

    -- Upsert invitation
    INSERT INTO public."BAND_MEMBERS" (
        "Band_ID",
        "Member_ID",
        "Instrument_Role",
        "Status",
        "Invited_at",
        "Joined_at"
    ) VALUES (
        p_band_id,
        p_member_account_id,
        v_normalized_role,
        'Pending',
        NOW(),
        NULL
    )
    ON CONFLICT ("Band_ID", "Member_ID") DO UPDATE SET
        "Instrument_Role" = v_normalized_role,
        "Status" = 'Pending',
        "Invited_at" = NOW(),
        "Joined_at" = NULL;

    RETURN jsonb_build_object(
        'success', TRUE,
        'band_id', p_band_id,
        'member_id', p_member_account_id,
        'role', v_normalized_role
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. Update trg_notify_band_invite() to link to Band's profile (/artist/<username>)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_band_invite()
RETURNS TRIGGER AS $$
DECLARE
    v_band_name TEXT;
    v_band_username TEXT;
    v_initials TEXT;
    v_normalized_role TEXT;
    v_target_url TEXT;
BEGIN
    SELECT b."Band_Name", u."Username" INTO v_band_name, v_band_username
    FROM public."BAND" b
    JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
    JOIN public."USER_ACCOUNT" u ON u."ACCOUNT_ID" = a."ACCOUNT_ID"
    WHERE b."ARTIST_ID" = NEW."Band_ID";

    v_initials := UPPER(SUBSTRING(COALESCE(v_band_name, 'TONO'), 1, 2));
    v_normalized_role := public.normalize_band_role(NEW."Instrument_Role");

    -- Point invitation notification to the band's public profile page
    IF v_band_username IS NOT NULL AND v_band_username != '' THEN
        v_target_url := '/artist/' || v_band_username;
    ELSE
        v_target_url := NULL;
    END IF;

    -- Send notification to solo artist: "Band Name **invited** you to be their **[Role]**"
    PERFORM public.send_notification(
        NEW."Member_ID",
        'band_invite',
        COALESCE(v_band_name, 'A band') || ' **invited** you to be their **' || v_normalized_role || '**.',
        'Join ' || COALESCE(v_band_name, 'the band') || ' as their ' || v_normalized_role || ' for upcoming performances.',
        v_target_url,
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


-- -----------------------------------------------------------------------------
-- 4. Clean up existing stale invitations with tab=members link
-- -----------------------------------------------------------------------------
UPDATE public."NOTIFICATION" n
SET "Action_Link" = CASE 
    WHEN u."Username" IS NOT NULL AND u."Username" != '' THEN '/artist/' || u."Username"
    ELSE NULL
END
FROM public."BAND" b
JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
JOIN public."USER_ACCOUNT" u ON u."ACCOUNT_ID" = a."ACCOUNT_ID"
WHERE n."Type" = 'band_invite'
  AND n."Entity_ID" = b."ARTIST_ID"
  AND n."Action_Link" LIKE '%tab=members%';

-- Fallback for any remaining unlinked tab=members invite notifications
UPDATE public."NOTIFICATION"
SET "Action_Link" = NULL
WHERE "Type" = 'band_invite'
  AND "Action_Link" LIKE '%tab=members%';
