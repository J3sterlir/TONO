-- Migration: Add missing DELETE policies for SOLO_GENRES, SOLO_INSTRUMENTS, and BAND_GENRES
-- Enables artists to update and re-sync their tags without RLS rejection

-- 1. SOLO_GENRES DELETE Policy
DROP POLICY IF EXISTS "Users can delete own solo genre tags" ON "SOLO_GENRES";
CREATE POLICY "Users can delete own solo genre tags"
ON "SOLO_GENRES"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "SOLO_ARTIST" sa
    JOIN "ARTIST" a ON a."ARTIST_ID" = sa."ARTIST_ID"
    WHERE sa."ARTIST_ID" = "SOLO_GENRES"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

-- 2. SOLO_INSTRUMENTS DELETE Policy
DROP POLICY IF EXISTS "Users can delete own solo instrument tags" ON "SOLO_INSTRUMENTS";
CREATE POLICY "Users can delete own solo instrument tags"
ON "SOLO_INSTRUMENTS"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "SOLO_ARTIST" sa
    JOIN "ARTIST" a ON a."ARTIST_ID" = sa."ARTIST_ID"
    WHERE sa."ARTIST_ID" = "SOLO_INSTRUMENTS"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

-- 3. BAND_GENRES DELETE Policy
DROP POLICY IF EXISTS "Users can delete own band genre tags" ON "BAND_GENRES";
CREATE POLICY "Users can delete own band genre tags"
ON "BAND_GENRES"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "BAND" b
    JOIN "ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
    WHERE b."ARTIST_ID" = "BAND_GENRES"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);
