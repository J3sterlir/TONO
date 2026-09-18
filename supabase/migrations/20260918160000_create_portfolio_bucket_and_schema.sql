-- ============================================================================
-- 1. Create 'portfolio' Storage Bucket & Policies
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio', 
  'portfolio', 
  true, 
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies for 'portfolio' bucket
DROP POLICY IF EXISTS "Public read access for portfolio" ON storage.objects;
CREATE POLICY "Public read access for portfolio"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio');

DROP POLICY IF EXISTS "Artists can upload own portfolio assets" ON storage.objects;
CREATE POLICY "Artists can upload own portfolio assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portfolio' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Artists can update own portfolio assets" ON storage.objects;
CREATE POLICY "Artists can update own portfolio assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portfolio' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'portfolio' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Artists can delete own portfolio assets" ON storage.objects;
CREATE POLICY "Artists can delete own portfolio assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'portfolio' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- 2. Schema Enhancements on Database Tables
-- ============================================================================
-- Enhancements to PORTFOLIO_MEDIA (for Milestones & Promotional Posters)
ALTER TABLE public."PORTFOLIO_MEDIA"
  ADD COLUMN IF NOT EXISTS "Title" TEXT,
  ADD COLUMN IF NOT EXISTS "Event_Date" TEXT,
  ADD COLUMN IF NOT EXISTS "Display_Order" INT DEFAULT 0;

-- Enhancements to PORTFOLIO_LINK (for Media and Audio Embeds)
ALTER TABLE public."PORTFOLIO_LINK"
  ADD COLUMN IF NOT EXISTS "Title" TEXT,
  ADD COLUMN IF NOT EXISTS "Display_Order" INT DEFAULT 0;

-- Composite Indices for Fast Profile Querying
CREATE INDEX IF NOT EXISTS idx_portfolio_media_category 
  ON public."PORTFOLIO_MEDIA"("ARTIST_ID", "Category");

CREATE INDEX IF NOT EXISTS idx_portfolio_link_category 
  ON public."PORTFOLIO_LINK"("ARTIST_ID", "Category");
