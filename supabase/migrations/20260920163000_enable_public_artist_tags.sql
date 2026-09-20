-- =============================================================================
-- Migration: 20260920163000_enable_public_artist_tags.sql
-- Description: Enable public read access for artist and account tags
-- =============================================================================

DO $$
BEGIN
    -- 1. SOLO_GENRES
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'SOLO_GENRES' 
        AND policyname = 'Public can view solo genres'
    ) THEN
        CREATE POLICY "Public can view solo genres" 
        ON public."SOLO_GENRES" 
        FOR SELECT 
        USING (true);
    END IF;

    -- 2. SOLO_INSTRUMENTS
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'SOLO_INSTRUMENTS' 
        AND policyname = 'Public can view solo instruments'
    ) THEN
        CREATE POLICY "Public can view solo instruments" 
        ON public."SOLO_INSTRUMENTS" 
        FOR SELECT 
        USING (true);
    END IF;

    -- 3. BAND_GENRES
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'BAND_GENRES' 
        AND policyname = 'Public can view band genres'
    ) THEN
        CREATE POLICY "Public can view band genres" 
        ON public."BAND_GENRES" 
        FOR SELECT 
        USING (true);
    END IF;

    -- 4. ACCOUNT_PREF_GENRE (Fallback for tags set during registration)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ACCOUNT_PREF_GENRE' 
        AND policyname = 'Public can view account pref genres'
    ) THEN
        CREATE POLICY "Public can view account pref genres" 
        ON public."ACCOUNT_PREF_GENRE" 
        FOR SELECT 
        USING (true);
    END IF;

    -- 5. ACCOUNT_PREF_INSTRUMENTS (Fallback for tags set during registration)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ACCOUNT_PREF_INSTRUMENTS' 
        AND policyname = 'Public can view account pref instruments'
    ) THEN
        CREATE POLICY "Public can view account pref instruments" 
        ON public."ACCOUNT_PREF_INSTRUMENTS" 
        FOR SELECT 
        USING (true);
    END IF;
END $$;
