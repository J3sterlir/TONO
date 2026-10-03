-- =============================================================================
-- Migration: 20261002010000_setup_posts_likes_comments_and_notifications.sql
-- Description:
--   1. Adds Location column to POST and ensures Media & File_URL are nullable.
--   2. Creates 'posts' storage bucket with RLS policies for uploads/deletes.
--   3. Enables Supabase Realtime CDC on POST, POST_LIKES, and POST_COMMENTS.
--   4. Adds triggers on POST_LIKES and POST_COMMENTS to dispatch realtime
--      notifications to artists with bold markdown text and deep-link actions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENHANCE POST TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE public."POST" ADD COLUMN IF NOT EXISTS "Location" TEXT;
ALTER TABLE public."POST" ALTER COLUMN "Media" DROP NOT NULL;
ALTER TABLE public."POST" ALTER COLUMN "File_URL" DROP NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. CREATE 'posts' STORAGE BUCKET & RLS POLICIES
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts', 
  'posts', 
  true, 
  15728640, -- 15MB limit before optimization
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies for 'posts' bucket
DROP POLICY IF EXISTS "Public read access for posts" ON storage.objects;
CREATE POLICY "Public read access for posts"
ON storage.objects FOR SELECT
USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "Artists can upload own post assets" ON storage.objects;
CREATE POLICY "Artists can upload own post assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Artists can update own post assets" ON storage.objects;
CREATE POLICY "Artists can update own post assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Artists can delete own post assets" ON storage.objects;
CREATE POLICY "Artists can delete own post assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- -----------------------------------------------------------------------------
-- 3. ENABLE SUPABASE REALTIME REPLICATION (CDC)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."POST";
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."POST_LIKES";
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."POST_COMMENTS";
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

ALTER TABLE public."POST" REPLICA IDENTITY FULL;
ALTER TABLE public."POST_LIKES" REPLICA IDENTITY FULL;
ALTER TABLE public."POST_COMMENTS" REPLICA IDENTITY FULL;

-- -----------------------------------------------------------------------------
-- 4. REALTIME NOTIFICATION TRIGGER: POST_LIKES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_post_liked()
RETURNS TRIGGER AS $$
DECLARE
    v_artist_account_id UUID;
    v_liker_username TEXT;
BEGIN
    -- Only trigger on INSERT
    IF TG_OP = 'INSERT' THEN
        -- Find the artist account ID who owns this post
        SELECT a."ACCOUNT_ID" INTO v_artist_account_id
        FROM public."POST" p
        JOIN public."ARTIST" a ON p."ARTIST_ID" = a."ARTIST_ID"
        WHERE p."POST_ID" = NEW."POST_ID";

        -- Do not notify if the artist liked their own post or if artist not found
        IF v_artist_account_id IS NOT NULL AND v_artist_account_id != NEW."ACCOUNT_ID" THEN
            -- Fetch liker's username
            SELECT "Username"
            INTO v_liker_username
            FROM public."USER_ACCOUNT"
            WHERE "ACCOUNT_ID" = NEW."ACCOUNT_ID";

            IF v_liker_username IS NULL THEN
                v_liker_username := 'Someone';
            END IF;

            -- Insert notification for the artist
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
                v_artist_account_id,
                NEW."ACCOUNT_ID",
                'post_liked',
                'New Like',
                v_liker_username || ' **liked** your post',
                '/Artistprofile?postId=' || NEW."POST_ID",
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

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_liked ON public."POST_LIKES";
CREATE TRIGGER trg_post_liked
AFTER INSERT OR DELETE ON public."POST_LIKES"
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_post_liked();

-- -----------------------------------------------------------------------------
-- 5. REALTIME NOTIFICATION TRIGGER: POST_COMMENTS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_post_commented()
RETURNS TRIGGER AS $$
DECLARE
    v_artist_account_id UUID;
    v_commenter_username TEXT;
    v_comment_snippet TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Find artist account ID
        SELECT a."ACCOUNT_ID" INTO v_artist_account_id
        FROM public."POST" p
        JOIN public."ARTIST" a ON p."ARTIST_ID" = a."ARTIST_ID"
        WHERE p."POST_ID" = NEW."POST_ID";

        -- Do not notify if artist commented on their own post
        IF v_artist_account_id IS NOT NULL AND v_artist_account_id != NEW."ACCOUNT_ID" THEN
            SELECT "Username"
            INTO v_commenter_username
            FROM public."USER_ACCOUNT"
            WHERE "ACCOUNT_ID" = NEW."ACCOUNT_ID";

            IF v_commenter_username IS NULL THEN
                v_commenter_username := 'Someone';
            END IF;

            v_comment_snippet := LEFT(TRIM(NEW."Content"), 40);
            IF LENGTH(TRIM(NEW."Content")) > 40 THEN
                v_comment_snippet := v_comment_snippet || '...';
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
                v_artist_account_id,
                NEW."ACCOUNT_ID",
                'post_commented',
                'New Comment',
                v_commenter_username || ' **commented** on your post: "' || v_comment_snippet || '"',
                '/Artistprofile?postId=' || NEW."POST_ID",
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

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_commented ON public."POST_COMMENTS";
CREATE TRIGGER trg_post_commented
AFTER INSERT ON public."POST_COMMENTS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_post_commented();
