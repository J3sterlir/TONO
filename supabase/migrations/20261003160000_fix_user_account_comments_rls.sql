-- =============================================================================
-- Migration: 20261003160000_fix_user_account_comments_rls.sql
-- Description:
--   1. Restores public read policy on USER_ACCOUNT for non-banned users so that
--      commenters, likers, and booked clients display their real Username and Profile_Picture.
--   2. Creates a dedicated SECURITY DEFINER RPC public.get_post_comments(UUID)
--      that safely returns post comments along with author username and avatar,
--      prioritizing artist stage names if the commenter is an artist.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. USER_ACCOUNT RLS: Allow reading non-banned user profiles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active artist accounts" ON public."USER_ACCOUNT";
DROP POLICY IF EXISTS "Public can read public user accounts" ON public."USER_ACCOUNT";

CREATE POLICY "Public can read public user accounts"
ON public."USER_ACCOUNT"
FOR SELECT
USING ("Is_Banned" IS NOT TRUE);

-- -----------------------------------------------------------------------------
-- 2. RPC: get_post_comments (SECURITY DEFINER for robust comment fetching)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_post_comments(p_post_id UUID)
RETURNS TABLE (
    "Comment_ID" UUID,
    "POST_ID" UUID,
    "ACCOUNT_ID" UUID,
    "Content" TEXT,
    "Created_at" TIMESTAMPTZ,
    "Username" TEXT,
    "Profile_Picture" TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c."Comment_ID",
        c."POST_ID",
        c."ACCOUNT_ID",
        c."Content",
        c."Created_at",
        COALESCE(
            sa."Artist_Name",
            b."Band_Name",
            u."Username",
            'User'
        ) AS "Username",
        u."Profile_Picture"
    FROM public."POST_COMMENTS" c
    LEFT JOIN public."USER_ACCOUNT" u ON u."ACCOUNT_ID" = c."ACCOUNT_ID"
    LEFT JOIN public."ARTIST" a ON a."ACCOUNT_ID" = c."ACCOUNT_ID"
    LEFT JOIN public."SOLO_ARTIST" sa ON sa."ARTIST_ID" = a."ARTIST_ID"
    LEFT JOIN public."BAND" b ON b."ARTIST_ID" = a."ARTIST_ID"
    WHERE c."POST_ID" = p_post_id
    ORDER BY c."Created_at" ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_comments(UUID) TO anon, authenticated;
