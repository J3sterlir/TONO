-- =============================================================================
-- MIGRATION: 20261004120000_enhance_messaging_feature.sql
-- DESCRIPTION: Enhances MESSAGE and MESSAGE_THREAD schemas for modern real-time
--              chat (Attachments, Open Graph link previews, 10-min edit/unsend,
--              symmetric thread indexing, storage bucket, and helper RPCs).
-- =============================================================================

-- 1. ENHANCE "MESSAGE" TABLE
ALTER TABLE public."MESSAGE"
    ADD COLUMN IF NOT EXISTS "Attachments" JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "Metadata" JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "Is_Edited" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Edited_At" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "Is_Deleted" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Deleted_At" TIMESTAMPTZ;

-- 2. ENHANCE "MESSAGE_THREAD" TABLE
ALTER TABLE public."MESSAGE_THREAD"
    ADD COLUMN IF NOT EXISTS "Last_Message_Snippet" TEXT,
    ADD COLUMN IF NOT EXISTS "Last_Message_Sender_ID" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "Last_Message_At" TIMESTAMPTZ DEFAULT NOW();

-- Create symmetric unique index to prevent duplicate threads between the same two users
CREATE UNIQUE INDEX IF NOT EXISTS unique_thread_participants_symmetric
ON public."MESSAGE_THREAD" (
    LEAST("Participant_1_ID", "Participant_2_ID"),
    GREATEST("Participant_1_ID", "Participant_2_ID")
);

-- Index for sorting threads by most recent activity
CREATE INDEX IF NOT EXISTS idx_thread_last_message_at 
ON public."MESSAGE_THREAD"("Last_Message_At" DESC NULLS LAST);

-- 3. TRIGGER TO AUTOMATICALLY UPDATE THREAD ACTIVITY ON NEW/EDITED MESSAGES
CREATE OR REPLACE FUNCTION public.fn_sync_thread_on_message()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_snippet TEXT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW."Is_Deleted" = TRUE THEN
            v_snippet := 'This message was unsent';
        ELSIF jsonb_array_length(COALESCE(NEW."Attachments", '[]'::jsonb)) > 0 AND (NEW."Content" IS NULL OR NEW."Content" = '') THEN
            v_snippet := 'Sent an attachment';
        ELSE
            v_snippet := LEFT(NEW."Content", 120);
        END IF;

        UPDATE public."MESSAGE_THREAD"
        SET "Last_Message_Snippet" = v_snippet,
            "Last_Message_Sender_ID" = NEW."Sender_ID",
            "Last_Message_At" = NEW."Created_at",
            "Last_Updated" = NEW."Created_at"
        WHERE "Thread_ID" = NEW."Thread_ID";

    ELSIF (TG_OP = 'UPDATE') THEN
        IF NEW."Is_Deleted" = TRUE AND (OLD."Is_Deleted" IS FALSE OR OLD."Is_Deleted" IS NULL) THEN
            -- Check if this was the latest message and roll back to previous non-deleted message
            DECLARE
                v_prev RECORD;
                v_prev_snippet TEXT;
            BEGIN
                SELECT * INTO v_prev
                FROM public."MESSAGE"
                WHERE "Thread_ID" = NEW."Thread_ID"
                  AND "Is_Deleted" = FALSE
                  AND "Message_ID" <> NEW."Message_ID"
                ORDER BY "Created_at" DESC
                LIMIT 1;

                IF FOUND THEN
                    IF jsonb_array_length(COALESCE(v_prev."Attachments", '[]'::jsonb)) > 0 AND (v_prev."Content" IS NULL OR v_prev."Content" = '') THEN
                        v_prev_snippet := 'Sent an attachment';
                    ELSE
                        v_prev_snippet := LEFT(v_prev."Content", 120);
                    END IF;

                    UPDATE public."MESSAGE_THREAD"
                    SET "Last_Message_Snippet" = v_prev_snippet,
                        "Last_Message_Sender_ID" = v_prev."Sender_ID",
                        "Last_Message_At" = v_prev."Created_at",
                        "Last_Updated" = NOW()
                    WHERE "Thread_ID" = NEW."Thread_ID";
                ELSE
                    UPDATE public."MESSAGE_THREAD"
                    SET "Last_Message_Snippet" = 'No messages yet',
                        "Last_Message_Sender_ID" = NULL,
                        "Last_Updated" = NOW()
                    WHERE "Thread_ID" = NEW."Thread_ID";
                END IF;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_thread_on_message ON public."MESSAGE";
CREATE TRIGGER trg_sync_thread_on_message
AFTER INSERT OR UPDATE OF "Is_Deleted", "Content" ON public."MESSAGE"
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_thread_on_message();

-- 4. REALTIME PUBLICATION & REPLICA IDENTITY
ALTER TABLE public."MESSAGE" REPLICA IDENTITY FULL;
ALTER TABLE public."MESSAGE_THREAD" REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'MESSAGE'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public."MESSAGE";
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'MESSAGE_THREAD'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public."MESSAGE_THREAD";
        END IF;
    END IF;
END $$;

-- 5. RPC FUNCTIONS

-- A. get_or_create_thread(target_user_id)
CREATE OR REPLACE FUNCTION public.get_or_create_thread(target_user_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id UUID;
    v_thread_id UUID;
    v_p1 UUID;
    v_p2 UUID;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_current_user_id = target_user_id THEN
        RAISE EXCEPTION 'Cannot start a conversation with yourself';
    END IF;

    -- Normalize ordering so p1 < p2
    IF v_current_user_id < target_user_id THEN
        v_p1 := v_current_user_id;
        v_p2 := target_user_id;
    ELSE
        v_p1 := target_user_id;
        v_p2 := v_current_user_id;
    END IF;

    -- Look up existing thread
    SELECT "Thread_ID" INTO v_thread_id
    FROM public."MESSAGE_THREAD"
    WHERE ("Participant_1_ID" = v_p1 AND "Participant_2_ID" = v_p2)
       OR ("Participant_1_ID" = v_p2 AND "Participant_2_ID" = v_p1)
    LIMIT 1;

    -- Create new thread if not found
    IF v_thread_id IS NULL THEN
        INSERT INTO public."MESSAGE_THREAD" ("Participant_1_ID", "Participant_2_ID", "Last_Updated", "Last_Message_At")
        VALUES (v_p1, v_p2, NOW(), NOW())
        RETURNING "Thread_ID" INTO v_thread_id;
    END IF;

    RETURN v_thread_id;
END;
$$;

-- B. mark_thread_messages_as_read(target_thread_id)
CREATE OR REPLACE FUNCTION public.mark_thread_messages_as_read(target_thread_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id UUID;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN;
    END IF;

    -- Verify user is a participant
    IF NOT EXISTS (
        SELECT 1 FROM public."MESSAGE_THREAD"
        WHERE "Thread_ID" = target_thread_id
          AND ("Participant_1_ID" = v_current_user_id OR "Participant_2_ID" = v_current_user_id)
    ) THEN
        RAISE EXCEPTION 'Not a participant in this thread';
    END IF;

    UPDATE public."MESSAGE"
    SET "Is_Read" = TRUE
    WHERE "Thread_ID" = target_thread_id
      AND "Sender_ID" <> v_current_user_id
      AND "Is_Read" = FALSE;
END;
$$;

-- C. edit_message(target_message_id, new_content) - 10 MINUTE LIMIT
CREATE OR REPLACE FUNCTION public.edit_message(target_message_id UUID, new_content TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id UUID;
    v_msg RECORD;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_msg
    FROM public."MESSAGE"
    WHERE "Message_ID" = target_message_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found';
    END IF;

    IF v_msg."Sender_ID" <> v_current_user_id THEN
        RAISE EXCEPTION 'You can only edit your own messages';
    END IF;

    IF v_msg."Is_Deleted" = TRUE THEN
        RAISE EXCEPTION 'Cannot edit a deleted message';
    END IF;

    -- 10-Minute timer enforcement
    IF NOW() - v_msg."Created_at" > INTERVAL '10 minutes' THEN
        RAISE EXCEPTION 'Edit window expired (10 minutes limit)';
    END IF;

    UPDATE public."MESSAGE"
    SET "Content" = new_content,
        "Is_Edited" = TRUE,
        "Edited_At" = NOW()
    WHERE "Message_ID" = target_message_id;

    RETURN TRUE;
END;
$$;

-- D. unsend_message(target_message_id) - 10 MINUTE LIMIT
CREATE OR REPLACE FUNCTION public.unsend_message(target_message_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id UUID;
    v_msg RECORD;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_msg
    FROM public."MESSAGE"
    WHERE "Message_ID" = target_message_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found';
    END IF;

    IF v_msg."Sender_ID" <> v_current_user_id THEN
        RAISE EXCEPTION 'You can only unsend your own messages';
    END IF;

    IF v_msg."Is_Deleted" = TRUE THEN
        RETURN TRUE; -- already unsent
    END IF;

    -- 10-Minute timer enforcement
    IF NOW() - v_msg."Created_at" > INTERVAL '10 minutes' THEN
        RAISE EXCEPTION 'Unsend window expired (10 minutes limit)';
    END IF;

    UPDATE public."MESSAGE"
    SET "Content" = 'This message was unsent',
        "Attachments" = '[]'::jsonb,
        "Metadata" = '{}'::jsonb,
        "Is_Deleted" = TRUE,
        "Deleted_At" = NOW()
    WHERE "Message_ID" = target_message_id;

    RETURN TRUE;
END;
$$;

-- 6. STORAGE BUCKET FOR CHAT ATTACHMENTS (10MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat_attachments',
    'chat_attachments',
    true,
    10485760, -- 10MB limit
    ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'application/zip', 'audio/mpeg', 'audio/wav', 'audio/ogg'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat_attachments');

DROP POLICY IF EXISTS "Public or participants can view chat attachments" ON storage.objects;
CREATE POLICY "Public or participants can view chat attachments"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'chat_attachments');

DROP POLICY IF EXISTS "Users can delete their own chat attachments" ON storage.objects;
CREATE POLICY "Users can delete their own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat_attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Grant execute permissions on RPCs
GRANT EXECUTE ON FUNCTION public.get_or_create_thread(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_thread_messages_as_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unsend_message(UUID) TO authenticated;
