-- =============================================================================
-- Migration: 20261021183000_fix_post_likes_and_comments_notification_triggers.sql
-- Description:
--   Fixes column names in fn_notify_post_liked and fn_notify_post_commented.
--   Previous migration (20261007140000) attempted to insert into non-existent
--   columns ("Message", "Action_Url", "Action_Label", "Created_at") on NOTIFICATION,
--   causing Postgres error 42703 (undefined_column: column "Message" does not exist)
--   whenever a user or artist liked or commented on another account's post.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FIX fn_notify_post_liked
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_post_liked()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_account_id UUID;
    v_liker_username TEXT;
    v_is_business BOOLEAN := FALSE;
    v_business_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Resolve post owner (either artist or business)
        SELECT 
            COALESCE(a."ACCOUNT_ID", bp."ACCOUNT_ID"),
            (p."BUSINESS_ID" IS NOT NULL),
            p."BUSINESS_ID"
        INTO v_owner_account_id, v_is_business, v_business_id
        FROM public."POST" p
        LEFT JOIN public."ARTIST" a ON p."ARTIST_ID" = a."ARTIST_ID"
        LEFT JOIN public."BUSINESS_PROFILE" bp ON p."BUSINESS_ID" = bp."BUSINESS_ID"
        WHERE p."POST_ID" = NEW."POST_ID";

        -- Do not notify if owner liked their own post or owner not resolved
        IF v_owner_account_id IS NOT NULL AND v_owner_account_id != NEW."ACCOUNT_ID" THEN
            SELECT "Username" INTO v_liker_username
            FROM public."USER_ACCOUNT"
            WHERE "ACCOUNT_ID" = NEW."ACCOUNT_ID";

            IF v_liker_username IS NULL THEN
                v_liker_username := 'Someone';
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
                "Entity_ID",
                "Entity_Type",
                "Metadata",
                "Is_Read",
                "Created_At"
            ) VALUES (
                v_owner_account_id,
                NEW."ACCOUNT_ID",
                'post_liked',
                'New Like',
                v_liker_username || ' **liked** your post.',
                CASE WHEN v_is_business THEN '/business/' || v_business_id || '?postId=' || NEW."POST_ID"
                     ELSE '/Artistprofile?postId=' || NEW."POST_ID" END,
                'post_liked',
                COALESCE(UPPER(LEFT(v_liker_username, 4)), 'TONO'),
                'View Post',
                NEW."POST_ID",
                'POST',
                jsonb_build_object(
                    'post_id', NEW."POST_ID",
                    'liker_account_id', NEW."ACCOUNT_ID",
                    'action', 'open_post_modal'
                ),
                FALSE,
                NOW()
            );
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- If user unlikes, remove unread like notification to prevent clutter
        DELETE FROM public."NOTIFICATION"
        WHERE "Entity_ID" = OLD."POST_ID"
          AND "Sender_Account_ID" = OLD."ACCOUNT_ID"
          AND "Type" = 'post_liked'
          AND "Is_Read" = FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for POST_LIKES
DROP TRIGGER IF EXISTS trg_post_liked ON public."POST_LIKES";
CREATE TRIGGER trg_post_liked
AFTER INSERT OR DELETE ON public."POST_LIKES"
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_post_liked();

-- -----------------------------------------------------------------------------
-- 2. FIX fn_notify_post_commented
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_post_commented()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_account_id UUID;
    v_commenter_username TEXT;
    v_comment_snippet TEXT;
    v_is_business BOOLEAN := FALSE;
    v_business_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Resolve post owner (either artist or business)
        SELECT 
            COALESCE(a."ACCOUNT_ID", bp."ACCOUNT_ID"),
            (p."BUSINESS_ID" IS NOT NULL),
            p."BUSINESS_ID"
        INTO v_owner_account_id, v_is_business, v_business_id
        FROM public."POST" p
        LEFT JOIN public."ARTIST" a ON p."ARTIST_ID" = a."ARTIST_ID"
        LEFT JOIN public."BUSINESS_PROFILE" bp ON p."BUSINESS_ID" = bp."BUSINESS_ID"
        WHERE p."POST_ID" = NEW."POST_ID";

        -- Do not notify if owner commented on their own post
        IF v_owner_account_id IS NOT NULL AND v_owner_account_id != NEW."ACCOUNT_ID" THEN
            SELECT "Username" INTO v_commenter_username
            FROM public."USER_ACCOUNT"
            WHERE "ACCOUNT_ID" = NEW."ACCOUNT_ID";

            IF v_commenter_username IS NULL THEN
                v_commenter_username := 'Someone';
            END IF;

            IF length(NEW."Content") > 50 THEN
                v_comment_snippet := substring(NEW."Content" from 1 for 47) || '...';
            ELSE
                v_comment_snippet := NEW."Content";
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
                "Entity_ID",
                "Entity_Type",
                "Metadata",
                "Is_Read",
                "Created_At"
            ) VALUES (
                v_owner_account_id,
                NEW."ACCOUNT_ID",
                'post_commented',
                'New Comment',
                v_commenter_username || ' **commented** on your post: "' || v_comment_snippet || '"',
                CASE WHEN v_is_business THEN '/business/' || v_business_id || '?postId=' || NEW."POST_ID"
                     ELSE '/Artistprofile?postId=' || NEW."POST_ID" END,
                'post_commented',
                COALESCE(UPPER(LEFT(v_commenter_username, 4)), 'TONO'),
                'View Post',
                NEW."POST_ID",
                'POST',
                jsonb_build_object(
                    'post_id', NEW."POST_ID",
                    'comment_id', NEW."Comment_ID",
                    'action', 'open_post_modal'
                ),
                FALSE,
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for POST_COMMENTS
DROP TRIGGER IF EXISTS trg_post_commented ON public."POST_COMMENTS";
CREATE TRIGGER trg_post_commented
AFTER INSERT ON public."POST_COMMENTS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_post_commented();
