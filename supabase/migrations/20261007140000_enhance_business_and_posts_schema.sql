-- =============================================================================
-- Migration: 20261007140000_enhance_business_and_posts_schema.sql
-- Description:
--   1. Adds Cover_Picture and Links columns to BUSINESS_PROFILE.
--   2. Enhances POST table to allow business posts (makes ARTIST_ID nullable,
--      adds BUSINESS_ID foreign key, adds check constraint).
--   3. Configures RLS policies for businesses on POST table (insert, update, delete).
--   4. Updates realtime notification triggers for post likes and comments to
--      support both artist and business post owners.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENHANCE BUSINESS_PROFILE
-- -----------------------------------------------------------------------------
ALTER TABLE public."BUSINESS_PROFILE" 
ADD COLUMN IF NOT EXISTS "Cover_Picture" TEXT,
ADD COLUMN IF NOT EXISTS "Links" JSONB DEFAULT '[]'::jsonb;

-- Ensure RLS allows business owners to update their own business profile
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'BUSINESS_PROFILE' 
        AND policyname = 'Users can update own business profile'
    ) THEN
        CREATE POLICY "Users can update own business profile"
        ON public."BUSINESS_PROFILE"
        FOR UPDATE
        USING (auth.uid() = "ACCOUNT_ID")
        WITH CHECK (auth.uid() = "ACCOUNT_ID");
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. ENHANCE POST TABLE FOR BUSINESS POSTS
-- -----------------------------------------------------------------------------
ALTER TABLE public."POST" 
ALTER COLUMN "ARTIST_ID" DROP NOT NULL;

ALTER TABLE public."POST" 
ADD COLUMN IF NOT EXISTS "BUSINESS_ID" UUID 
REFERENCES public."BUSINESS_PROFILE"("BUSINESS_ID") ON DELETE CASCADE;

-- Ensure each post has either an ARTIST_ID or a BUSINESS_ID
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'post_owner_check'
    ) THEN
        ALTER TABLE public."POST" 
        ADD CONSTRAINT post_owner_check 
        CHECK ("ARTIST_ID" IS NOT NULL OR "BUSINESS_ID" IS NOT NULL);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. RLS POLICIES ON POST FOR BUSINESSES
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'POST' 
        AND policyname = 'Businesses can insert own posts'
    ) THEN
        CREATE POLICY "Businesses can insert own posts" ON public."POST"
            FOR INSERT TO authenticated
            WITH CHECK (
                "BUSINESS_ID" IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM public."BUSINESS_PROFILE" b
                    WHERE b."BUSINESS_ID" = "POST"."BUSINESS_ID"
                      AND b."ACCOUNT_ID" = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'POST' 
        AND policyname = 'Businesses can update own posts'
    ) THEN
        CREATE POLICY "Businesses can update own posts" ON public."POST"
            FOR UPDATE TO authenticated
            USING (
                "BUSINESS_ID" IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM public."BUSINESS_PROFILE" b
                    WHERE b."BUSINESS_ID" = "POST"."BUSINESS_ID"
                      AND b."ACCOUNT_ID" = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'POST' 
        AND policyname = 'Businesses can delete own posts'
    ) THEN
        CREATE POLICY "Businesses can delete own posts" ON public."POST"
            FOR DELETE TO authenticated
            USING (
                "BUSINESS_ID" IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM public."BUSINESS_PROFILE" b
                    WHERE b."BUSINESS_ID" = "POST"."BUSINESS_ID"
                      AND b."ACCOUNT_ID" = auth.uid()
                )
            );
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. REALTIME NOTIFICATION TRIGGER ENHANCEMENT (fn_notify_post_liked & fn_notify_post_commented)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_post_liked()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_account_id UUID;
    v_liker_username TEXT;
    v_post_snippet TEXT;
    v_is_business BOOLEAN := FALSE;
    v_business_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT 
            COALESCE(a."ACCOUNT_ID", bp."ACCOUNT_ID"),
            COALESCE(p."Caption", 'a post'),
            (p."BUSINESS_ID" IS NOT NULL),
            p."BUSINESS_ID"
        INTO v_owner_account_id, v_post_snippet, v_is_business, v_business_id
        FROM public."POST" p
        LEFT JOIN public."ARTIST" a ON p."ARTIST_ID" = a."ARTIST_ID"
        LEFT JOIN public."BUSINESS_PROFILE" bp ON p."BUSINESS_ID" = bp."BUSINESS_ID"
        WHERE p."POST_ID" = NEW."POST_ID";

        IF v_owner_account_id IS NOT NULL AND v_owner_account_id != NEW."ACCOUNT_ID" THEN
            SELECT "Username" INTO v_liker_username
            FROM public."USER_ACCOUNT"
            WHERE "ACCOUNT_ID" = NEW."ACCOUNT_ID";

            INSERT INTO public."NOTIFICATION" (
                "Account_ID", "Sender_Account_ID", "Title", "Message",
                "Action_Url", "Type", "Category", "Action_Label", "Entity_ID",
                "Entity_Type", "Metadata", "Is_Read", "Created_at"
            ) VALUES (
                v_owner_account_id,
                NEW."ACCOUNT_ID",
                'New Like',
                COALESCE(v_liker_username, 'Someone') || ' **liked** your post.',
                CASE WHEN v_is_business THEN '/business/' || v_business_id || '?postId=' || NEW."POST_ID"
                     ELSE '/Artistprofile?postId=' || NEW."POST_ID" END,
                'post_liked',
                COALESCE(UPPER(LEFT(v_liker_username, 4)), 'TONO'),
                'View Post',
                NEW."POST_ID",
                'POST',
                jsonb_build_object('post_id', NEW."POST_ID", 'liker_account_id', NEW."ACCOUNT_ID", 'action', 'open_post_modal'),
                FALSE,
                NOW()
            );
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public."NOTIFICATION"
        WHERE "Entity_ID" = OLD."POST_ID"
          AND "Sender_Account_ID" = OLD."ACCOUNT_ID"
          AND "Type" = 'post_liked'
          AND "Is_Read" = FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
        SELECT 
            COALESCE(a."ACCOUNT_ID", bp."ACCOUNT_ID"),
            (p."BUSINESS_ID" IS NOT NULL),
            p."BUSINESS_ID"
        INTO v_owner_account_id, v_is_business, v_business_id
        FROM public."POST" p
        LEFT JOIN public."ARTIST" a ON p."ARTIST_ID" = a."ARTIST_ID"
        LEFT JOIN public."BUSINESS_PROFILE" bp ON p."BUSINESS_ID" = bp."BUSINESS_ID"
        WHERE p."POST_ID" = NEW."POST_ID";

        IF v_owner_account_id IS NOT NULL AND v_owner_account_id != NEW."ACCOUNT_ID" THEN
            SELECT "Username" INTO v_commenter_username
            FROM public."USER_ACCOUNT"
            WHERE "ACCOUNT_ID" = NEW."ACCOUNT_ID";

            IF length(NEW."Content") > 50 THEN
                v_comment_snippet := substring(NEW."Content" from 1 for 47) || '...';
            ELSE
                v_comment_snippet := NEW."Content";
            END IF;

            INSERT INTO public."NOTIFICATION" (
                "Account_ID", "Sender_Account_ID", "Title", "Message",
                "Action_Url", "Type", "Category", "Action_Label", "Entity_ID",
                "Entity_Type", "Metadata", "Is_Read", "Created_at"
            ) VALUES (
                v_owner_account_id,
                NEW."ACCOUNT_ID",
                'New Comment',
                COALESCE(v_commenter_username, 'Someone') || ' **commented** on your post: "' || v_comment_snippet || '"',
                CASE WHEN v_is_business THEN '/business/' || v_business_id || '?postId=' || NEW."POST_ID"
                     ELSE '/Artistprofile?postId=' || NEW."POST_ID" END,
                'post_commented',
                COALESCE(UPPER(LEFT(v_commenter_username, 4)), 'TONO'),
                'View Post',
                NEW."POST_ID",
                'POST',
                jsonb_build_object('post_id', NEW."POST_ID", 'comment_id', NEW."Comment_ID", 'action', 'open_post_modal'),
                FALSE,
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
