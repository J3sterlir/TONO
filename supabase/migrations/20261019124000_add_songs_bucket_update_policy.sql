-- =============================================================================
-- Migration: 20261019124000_add_songs_bucket_update_policy.sql
-- Description:
--   Adds UPDATE storage policy for 'songs' bucket matching portfolio/posts buckets
-- =============================================================================

DROP POLICY IF EXISTS "Artists can update own song files" ON storage.objects;
CREATE POLICY "Artists can update own song files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'songs' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'songs' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
