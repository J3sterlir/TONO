-- =============================================================================
-- Migration: Ensure SONG_LIKES RLS Policies and Conflict Resolution
-- =============================================================================

ALTER TABLE public."SONG_LIKES" ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can view song likes
DROP POLICY IF EXISTS "Anyone can view song likes" ON public."SONG_LIKES";
CREATE POLICY "Anyone can view song likes"
    ON public."SONG_LIKES" FOR SELECT
    USING (true);

-- 2. Authenticated users can insert song likes for their own account
DROP POLICY IF EXISTS "Authenticated users can like songs" ON public."SONG_LIKES";
CREATE POLICY "Authenticated users can like songs"
    ON public."SONG_LIKES" FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = "ACCOUNT_ID");

-- 3. Authenticated users can update song likes for their own account (supports upsert)
DROP POLICY IF EXISTS "Authenticated users can update song likes" ON public."SONG_LIKES";
CREATE POLICY "Authenticated users can update song likes"
    ON public."SONG_LIKES" FOR UPDATE
    TO authenticated
    USING (auth.uid() = "ACCOUNT_ID")
    WITH CHECK (auth.uid() = "ACCOUNT_ID");

-- 4. Authenticated users can delete song likes for their own account
DROP POLICY IF EXISTS "Authenticated users can unlike songs" ON public."SONG_LIKES";
CREATE POLICY "Authenticated users can unlike songs"
    ON public."SONG_LIKES" FOR DELETE
    TO authenticated
    USING (auth.uid() = "ACCOUNT_ID");

-- 5. Grant permissions to authenticated and anon
GRANT SELECT ON public."SONG_LIKES" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public."SONG_LIKES" TO authenticated;
