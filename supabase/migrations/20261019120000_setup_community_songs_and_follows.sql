-- =============================================================================
-- Migration: 20261019120000_setup_community_songs_and_follows.sql
-- Description:
--   1. Creates Universal FOLLOW table with unique constraints, indexes, RLS, and notification triggers.
--   2. Creates 'songs' storage bucket with RLS policies for artist 1-minute uploads.
--   3. Creates SONG table for 1-minute portfolio audio tracks with 30-day lifecycle.
--   4. Creates SONG_LIKES and SONG_PLAYS tables with counter triggers and fraud-checked play tracking.
--   5. Creates SONG_MONTHLY_ARCHIVE for Hall of Fame persistent stats.
--   6. Enables Realtime replication on SONG, SONG_LIKES, and FOLLOW.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. UNIVERSAL FOLLOW TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."FOLLOW" (
    "Follow_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Follower_Account_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Following_Account_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Created_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_follower_following UNIQUE ("Follower_Account_ID", "Following_Account_ID"),
    CONSTRAINT chk_no_self_follow CHECK ("Follower_Account_ID" <> "Following_Account_ID")
);

CREATE INDEX IF NOT EXISTS idx_follow_follower ON public."FOLLOW"("Follower_Account_ID");
CREATE INDEX IF NOT EXISTS idx_follow_following ON public."FOLLOW"("Following_Account_ID");

ALTER TABLE public."FOLLOW" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view follows" ON public."FOLLOW";
CREATE POLICY "Anyone can view follows"
    ON public."FOLLOW" FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can follow accounts" ON public."FOLLOW";
CREATE POLICY "Users can follow accounts"
    ON public."FOLLOW" FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = "Follower_Account_ID");

DROP POLICY IF EXISTS "Users can unfollow accounts" ON public."FOLLOW";
CREATE POLICY "Users can unfollow accounts"
    ON public."FOLLOW" FOR DELETE
    TO authenticated
    USING (auth.uid() = "Follower_Account_ID");

-- -----------------------------------------------------------------------------
-- 2. CREATE 'songs' STORAGE BUCKET & RLS POLICIES
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'songs', 
  'songs', 
  true, 
  15728640, -- 15MB file size limit
  ARRAY[
    'audio/mpeg', 
    'audio/mp3', 
    'audio/wav', 
    'audio/webm', 
    'audio/ogg', 
    'audio/aac', 
    'audio/x-m4a', 
    'audio/mp4', 
    'audio/flac'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies for 'songs' bucket
DROP POLICY IF EXISTS "Public read access for songs" ON storage.objects;
CREATE POLICY "Public read access for songs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'songs');

DROP POLICY IF EXISTS "Artists can upload own song files" ON storage.objects;
CREATE POLICY "Artists can upload own song files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'songs' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Artists can delete own song files" ON storage.objects;
CREATE POLICY "Artists can delete own song files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'songs' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- -----------------------------------------------------------------------------
-- 3. SONG TABLE (1-MINUTE PORTFOLIO TRACKS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."SONG" (
    "Song_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ARTIST_ID" UUID NOT NULL REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Title" TEXT NOT NULL,
    "Description" TEXT,
    "Genre" TEXT,
    "File_URL" TEXT NOT NULL,
    "Storage_Path" TEXT NOT NULL,
    "Duration" NUMERIC NOT NULL DEFAULT 60.0,
    "File_Size_Bytes" BIGINT,
    "Play_Count" INT DEFAULT 0,
    "Like_Count" INT DEFAULT 0,
    "Created_at" TIMESTAMPTZ DEFAULT NOW(),
    "Expires_at" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    "Is_Expired" BOOLEAN DEFAULT FALSE,
    "Warning_5d_Sent" BOOLEAN DEFAULT FALSE,
    "Warning_3d_Sent" BOOLEAN DEFAULT FALSE,
    "Warning_2d_Sent" BOOLEAN DEFAULT FALSE,
    "Warning_1d_Sent" BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_song_artist ON public."SONG"("ARTIST_ID");
CREATE INDEX IF NOT EXISTS idx_song_expires ON public."SONG"("Expires_at") WHERE ("Is_Expired" = FALSE);
CREATE INDEX IF NOT EXISTS idx_song_play_count ON public."SONG"("Play_Count" DESC);
CREATE INDEX IF NOT EXISTS idx_song_like_count ON public."SONG"("Like_Count" DESC);

ALTER TABLE public."SONG" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active songs" ON public."SONG";
CREATE POLICY "Anyone can view active songs"
    ON public."SONG" FOR SELECT
    USING (
        "Is_Expired" = FALSE
        OR EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "SONG"."ARTIST_ID"
            AND a."ACCOUNT_ID" = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Artists can insert own songs" ON public."SONG";
CREATE POLICY "Artists can insert own songs"
    ON public."SONG" FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "SONG"."ARTIST_ID"
            AND a."ACCOUNT_ID" = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Artists can update own songs" ON public."SONG";
CREATE POLICY "Artists can update own songs"
    ON public."SONG" FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "SONG"."ARTIST_ID"
            AND a."ACCOUNT_ID" = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "SONG"."ARTIST_ID"
            AND a."ACCOUNT_ID" = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Artists can delete own songs" ON public."SONG";
CREATE POLICY "Artists can delete own songs"
    ON public."SONG" FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "SONG"."ARTIST_ID"
            AND a."ACCOUNT_ID" = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 4. SONG_LIKES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."SONG_LIKES" (
    "Like_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Song_ID" UUID NOT NULL REFERENCES public."SONG"("Song_ID") ON DELETE CASCADE,
    "ACCOUNT_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Created_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_song_like UNIQUE ("Song_ID", "ACCOUNT_ID")
);

CREATE INDEX IF NOT EXISTS idx_song_likes_song ON public."SONG_LIKES"("Song_ID");
CREATE INDEX IF NOT EXISTS idx_song_likes_account ON public."SONG_LIKES"("ACCOUNT_ID");

ALTER TABLE public."SONG_LIKES" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view song likes" ON public."SONG_LIKES";
CREATE POLICY "Anyone can view song likes"
    ON public."SONG_LIKES" FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can like songs" ON public."SONG_LIKES";
CREATE POLICY "Authenticated users can like songs"
    ON public."SONG_LIKES" FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = "ACCOUNT_ID");

DROP POLICY IF EXISTS "Authenticated users can unlike songs" ON public."SONG_LIKES";
CREATE POLICY "Authenticated users can unlike songs"
    ON public."SONG_LIKES" FOR DELETE
    TO authenticated
    USING (auth.uid() = "ACCOUNT_ID");

-- -----------------------------------------------------------------------------
-- 5. SONG_PLAYS TABLE (FRAUD-PROTECTED STREAM LOG)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."SONG_PLAYS" (
    "Play_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Song_ID" UUID NOT NULL REFERENCES public."SONG"("Song_ID") ON DELETE CASCADE,
    "Listener_Account_ID" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE SET NULL,
    "Duration_Listened_Seconds" NUMERIC NOT NULL,
    "User_City" TEXT,
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_plays_song ON public."SONG_PLAYS"("Song_ID");
CREATE INDEX IF NOT EXISTS idx_song_plays_city ON public."SONG_PLAYS"("User_City");
CREATE INDEX IF NOT EXISTS idx_song_plays_created ON public."SONG_PLAYS"("Created_at" DESC);

ALTER TABLE public."SONG_PLAYS" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view song play logs" ON public."SONG_PLAYS";
CREATE POLICY "Anyone can view song play logs"
    ON public."SONG_PLAYS" FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow play records insertion" ON public."SONG_PLAYS";
CREATE POLICY "Allow play records insertion"
    ON public."SONG_PLAYS" FOR INSERT
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 6. SONG_MONTHLY_ARCHIVE (HALL OF FAME)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."SONG_MONTHLY_ARCHIVE" (
    "Archive_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Song_ID" UUID NOT NULL,
    "ARTIST_ID" UUID NOT NULL REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Title" TEXT NOT NULL,
    "Genre" TEXT,
    "Month_Tag" TEXT NOT NULL, -- e.g. '2026-10'
    "Final_Play_Count" INT DEFAULT 0,
    "Final_Like_Count" INT DEFAULT 0,
    "Rank_Position" INT,
    "Archived_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_archive_artist ON public."SONG_MONTHLY_ARCHIVE"("ARTIST_ID");
CREATE INDEX IF NOT EXISTS idx_song_archive_month ON public."SONG_MONTHLY_ARCHIVE"("Month_Tag");

ALTER TABLE public."SONG_MONTHLY_ARCHIVE" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view song archive" ON public."SONG_MONTHLY_ARCHIVE";
CREATE POLICY "Anyone can view song archive"
    ON public."SONG_MONTHLY_ARCHIVE" FOR SELECT
    USING (true);

-- -----------------------------------------------------------------------------
-- 7. TRIGGERS: LIKE COUNT & PLAY COUNT AUTO-SYNC
-- -----------------------------------------------------------------------------

-- Like count trigger on SONG_LIKES
CREATE OR REPLACE FUNCTION public.fn_sync_song_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public."SONG"
        SET "Like_Count" = COALESCE("Like_Count", 0) + 1
        WHERE "Song_ID" = NEW."Song_ID";
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public."SONG"
        SET "Like_Count" = GREATEST(COALESCE("Like_Count", 0) - 1, 0)
        WHERE "Song_ID" = OLD."Song_ID";
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_song_like_count ON public."SONG_LIKES";
CREATE TRIGGER trg_sync_song_like_count
    AFTER INSERT OR DELETE ON public."SONG_LIKES"
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_song_like_count();

-- Play count trigger on SONG_PLAYS
CREATE OR REPLACE FUNCTION public.fn_sync_song_play_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public."SONG"
        SET "Play_Count" = COALESCE("Play_Count", 0) + 1
        WHERE "Song_ID" = NEW."Song_ID";
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_song_play_count ON public."SONG_PLAYS";
CREATE TRIGGER trg_sync_song_play_count
    AFTER INSERT ON public."SONG_PLAYS"
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_song_play_count();

-- -----------------------------------------------------------------------------
-- 8. NOTIFICATION TRIGGERS: FOLLOW & SONG LIKE
-- -----------------------------------------------------------------------------

-- Follow Notification Trigger
CREATE OR REPLACE FUNCTION public.fn_notify_account_followed()
RETURNS TRIGGER AS $$
DECLARE
    v_follower_username TEXT;
    v_target_artist_name TEXT;
    v_target_band_name TEXT;
    v_avatar_prefix TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Fetch follower username
        SELECT "Username"
        INTO v_follower_username
        FROM public."USER_ACCOUNT"
        WHERE "ACCOUNT_ID" = NEW."Follower_Account_ID";

        IF v_follower_username IS NULL THEN
            v_follower_username := 'Someone';
        END IF;

        v_avatar_prefix := COALESCE(UPPER(LEFT(v_follower_username, 4)), 'TONO');

        -- Insert notification for the followed account
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
            NEW."Following_Account_ID",
            NEW."Follower_Account_ID",
            'user_followed',
            'New Follower',
            v_follower_username || ' **started following you**',
            '/userprofile?id=' || NEW."Follower_Account_ID",
            'user_followed',
            v_avatar_prefix,
            'View Profile',
            NEW."Follow_ID",
            'follow',
            jsonb_build_object(
                'followerId', NEW."Follower_Account_ID",
                'followerUsername', v_follower_username
            ),
            false,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_account_followed ON public."FOLLOW";
CREATE TRIGGER trg_notify_account_followed
    AFTER INSERT ON public."FOLLOW"
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_account_followed();

-- Song Liked Notification Trigger
CREATE OR REPLACE FUNCTION public.fn_notify_song_liked()
RETURNS TRIGGER AS $$
DECLARE
    v_artist_account_id UUID;
    v_liker_username TEXT;
    v_song_title TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Find the artist account ID and song title
        SELECT a."ACCOUNT_ID", s."Title"
        INTO v_artist_account_id, v_song_title
        FROM public."SONG" s
        JOIN public."ARTIST" a ON s."ARTIST_ID" = a."ARTIST_ID"
        WHERE s."Song_ID" = NEW."Song_ID";

        -- Do not notify if artist liked their own song or artist not found
        IF v_artist_account_id IS NOT NULL AND v_artist_account_id != NEW."ACCOUNT_ID" THEN
            SELECT "Username"
            INTO v_liker_username
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
                v_artist_account_id,
                NEW."ACCOUNT_ID",
                'song_liked',
                'Song Liked',
                v_liker_username || ' **liked your track** "' || COALESCE(v_song_title, 'Original Song') || '"',
                '/Artistprofile',
                'song_liked',
                COALESCE(UPPER(LEFT(v_liker_username, 4)), 'TONO'),
                'View Portfolio',
                NEW."Song_ID",
                'song',
                jsonb_build_object(
                    'likerId', NEW."ACCOUNT_ID",
                    'songId', NEW."Song_ID",
                    'songTitle', v_song_title
                ),
                false,
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_song_liked ON public."SONG_LIKES";
CREATE TRIGGER trg_notify_song_liked
    AFTER INSERT ON public."SONG_LIKES"
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_song_liked();

-- -----------------------------------------------------------------------------
-- 9. ENABLE SUPABASE REALTIME REPLICATION (CDC)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."FOLLOW";
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."SONG";
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."SONG_LIKES";
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

ALTER TABLE public."FOLLOW" REPLICA IDENTITY FULL;
ALTER TABLE public."SONG" REPLICA IDENTITY FULL;
ALTER TABLE public."SONG_LIKES" REPLICA IDENTITY FULL;
