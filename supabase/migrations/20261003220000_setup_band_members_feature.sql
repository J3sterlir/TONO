-- =============================================================================
-- Migration: Setup Band Members Feature, RPCs, Realtime, and Notifications
-- Description:
--   1. Adds BAND_MEMBERS to supabase_realtime publication.
--   2. Creates get_band_members(p_band_id, p_include_pending) RPC for roster display.
--   3. Creates get_verified_solo_artists() RPC for the recruitment directory.
--   4. Creates invite_band_member() and remove_band_member() secure RPCs.
--   5. Updates notification triggers for band invite, acceptance, and rejection.
-- =============================================================================

-- 1. Enable Realtime for BAND_MEMBERS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'BAND_MEMBERS'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."BAND_MEMBERS";
    END IF;
END $$;


-- 2. Helper function to normalize role text in SQL (e.g. 'DrumMer' -> 'Drummer')
CREATE OR REPLACE FUNCTION public.normalize_band_role(p_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_clean TEXT := TRIM(COALESCE(p_role, 'Member'));
    v_parts TEXT[];
    v_part TEXT;
    v_normalized TEXT := '';
BEGIN
    IF v_clean = '' THEN
        RETURN 'Member';
    END IF;

    -- Split on whitespace
    v_parts := regexp_split_to_array(v_clean, '\s+');
    FOREACH v_part IN ARRAY v_parts LOOP
        IF v_part <> '' THEN
            IF v_normalized <> '' THEN
                v_normalized := v_normalized || ' ';
            END IF;
            -- Handle slashes e.g. "Vocalist/Guitarist"
            IF v_part LIKE '%/%' THEN
                v_normalized := v_normalized || INITCAP(v_part);
            ELSE
                v_normalized := v_normalized || UPPER(SUBSTRING(v_part FROM 1 FOR 1)) || LOWER(SUBSTRING(v_part FROM 2));
            END IF;
        END IF;
    END LOOP;

    RETURN v_normalized;
END;
$$;


-- 3. RPC: Get Band Members (Active + optionally Pending for Band Owner)
CREATE OR REPLACE FUNCTION public.get_band_members(
    p_band_id UUID,
    p_include_pending BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    member_id UUID,
    artist_id UUID,
    artist_name TEXT,
    username TEXT,
    profile_picture TEXT,
    city TEXT,
    instrument_role TEXT,
    specialty TEXT,
    status TEXT,
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_band_owner BOOLEAN := FALSE;
BEGIN
    -- Check if current authenticated user owns this band
    SELECT EXISTS (
        SELECT 1 
        FROM public."BAND" b
        JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
        WHERE b."ARTIST_ID" = p_band_id
          AND a."ACCOUNT_ID" = auth.uid()
    ) INTO v_is_band_owner;

    RETURN QUERY
    SELECT 
        bm."Member_ID" AS member_id,
        sa_artist."ARTIST_ID" AS artist_id,
        COALESCE(sa."Artist_Name", u."Username", 'Artist') AS artist_name,
        u."Username" AS username,
        u."Profile_Picture" AS profile_picture,
        u."City" AS city,
        bm."Instrument_Role" AS instrument_role,
        sa."Specialty" AS specialty,
        bm."Status" AS status,
        bm."Invited_at" AS invited_at,
        bm."Joined_at" AS joined_at
    FROM public."BAND_MEMBERS" bm
    JOIN public."USER_ACCOUNT" u ON u."ACCOUNT_ID" = bm."Member_ID"
    LEFT JOIN public."ARTIST" sa_artist ON sa_artist."ACCOUNT_ID" = bm."Member_ID" AND sa_artist."Artist_Type" = 'Solo'
    LEFT JOIN public."SOLO_ARTIST" sa ON sa."ARTIST_ID" = sa_artist."ARTIST_ID"
    WHERE bm."Band_ID" = p_band_id
      AND (
          (v_is_band_owner AND p_include_pending AND bm."Status" IN ('Accepted', 'Pending'))
          OR (bm."Status" = 'Accepted')
      )
    ORDER BY 
        CASE WHEN bm."Status" = 'Accepted' THEN 0 ELSE 1 END,
        bm."Joined_at" ASC NULLS LAST,
        bm."Invited_at" ASC;
END;
$$;


-- 4. RPC: Get Verified Solo Artists Directory
CREATE OR REPLACE FUNCTION public.get_verified_solo_artists()
RETURNS TABLE (
    account_id UUID,
    artist_id UUID,
    artist_name TEXT,
    username TEXT,
    profile_picture TEXT,
    city TEXT,
    specialty TEXT,
    is_verified BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        a."ACCOUNT_ID" AS account_id,
        a."ARTIST_ID" AS artist_id,
        COALESCE(sa."Artist_Name", u."Username", 'Artist') AS artist_name,
        u."Username" AS username,
        u."Profile_Picture" AS profile_picture,
        u."City" AS city,
        sa."Specialty" AS specialty,
        a."Is_Verified" AS is_verified
    FROM public."ARTIST" a
    JOIN public."SOLO_ARTIST" sa ON sa."ARTIST_ID" = a."ARTIST_ID"
    JOIN public."USER_ACCOUNT" u ON u."ACCOUNT_ID" = a."ACCOUNT_ID"
    WHERE a."Artist_Type" = 'Solo'
      AND a."Is_Verified" = TRUE
      AND (u."Is_Banned" IS NOT TRUE)
    ORDER BY sa."Artist_Name" ASC;
$$;


-- 5. RPC: Invite Member to Band
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
    v_is_owner BOOLEAN;
    v_normalized_role TEXT;
    v_existing_status TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Verify ownership
    SELECT EXISTS (
        SELECT 1 
        FROM public."BAND" b
        JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
        WHERE b."ARTIST_ID" = p_band_id
          AND a."ACCOUNT_ID" = v_caller_id
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Unauthorized: Only the band leader can invite members.';
    END IF;

    -- Check if target user account exists
    IF NOT EXISTS (SELECT 1 FROM public."USER_ACCOUNT" WHERE "ACCOUNT_ID" = p_member_account_id) THEN
        RAISE EXCEPTION 'Solo artist user account not found.';
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


-- 6. RPC: Remove Member or Cancel Invite
CREATE OR REPLACE FUNCTION public.remove_band_member(
    p_band_id UUID,
    p_member_account_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Caller must be either the band owner or the member themselves
    SELECT (
        v_caller_id = p_member_account_id
        OR EXISTS (
            SELECT 1 
            FROM public."BAND" b
            JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
            WHERE b."ARTIST_ID" = p_band_id
              AND a."ACCOUNT_ID" = v_caller_id
        )
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to remove this member.';
    END IF;

    DELETE FROM public."BAND_MEMBERS"
    WHERE "Band_ID" = p_band_id AND "Member_ID" = p_member_account_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'band_id', p_band_id,
        'member_id', p_member_account_id
    );
END;
$$;


-- 7. Notification Triggers (Markdown bold support for bold(invited), bold(role), bold(accepted), bold(rejected))
CREATE OR REPLACE FUNCTION public.trg_notify_band_invite()
RETURNS TRIGGER AS $$
DECLARE
    v_band_name TEXT;
    v_band_username TEXT;
    v_initials TEXT;
    v_normalized_role TEXT;
BEGIN
    SELECT b."Band_Name", u."Username" INTO v_band_name, v_band_username
    FROM public."BAND" b
    JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
    JOIN public."USER_ACCOUNT" u ON u."ACCOUNT_ID" = a."ACCOUNT_ID"
    WHERE b."ARTIST_ID" = NEW."Band_ID";

    v_initials := UPPER(SUBSTRING(COALESCE(v_band_name, 'TONO'), 1, 2));
    v_normalized_role := public.normalize_band_role(NEW."Instrument_Role");

    -- Send notification to solo artist: "Band Name **invited** you to be their **[Role]**"
    PERFORM public.send_notification(
        NEW."Member_ID",
        'band_invite',
        COALESCE(v_band_name, 'A band') || ' **invited** you to be their **' || v_normalized_role || '**.',
        'Join ' || COALESCE(v_band_name, 'the band') || ' as their ' || v_normalized_role || ' for upcoming performances.',
        '/Artistprofile?tab=members',
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
AFTER INSERT OR UPDATE OF "Status" ON public."BAND_MEMBERS"
FOR EACH ROW
WHEN (NEW."Status" = 'Pending')
EXECUTE FUNCTION public.trg_notify_band_invite();


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

DROP TRIGGER IF EXISTS trg_band_members_invite_response ON public."BAND_MEMBERS";
CREATE TRIGGER trg_band_members_invite_response
AFTER UPDATE OF "Status" ON public."BAND_MEMBERS"
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_band_invite_response();
