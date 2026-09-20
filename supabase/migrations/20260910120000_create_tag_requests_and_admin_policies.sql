-- ==============================================================================
-- Migration: Create TAG_REQUEST table and add Admin Policies for TAG_GENRE / TAG_INSTRUMENT
-- ==============================================================================

-- 1. Create TAG_REQUEST table for community-submitted tags
CREATE TABLE IF NOT EXISTS public."TAG_REQUEST" (
    "Request_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tag_Name" TEXT NOT NULL,
    "Type" TEXT NOT NULL CHECK ("Type" IN ('Genre', 'Instrument')),
    "ACCOUNT_ID" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Status" TEXT NOT NULL DEFAULT 'Pending' CHECK ("Status" IN ('Pending', 'Accepted', 'Rejected')),
    "Created_at" TIMESTAMPTZ DEFAULT NOW(),
    "Reviewed_at" TIMESTAMPTZ,
    "Reviewed_by" UUID REFERENCES public."ADMIN"("ADMIN_ID")
);

-- Enable RLS on TAG_REQUEST
ALTER TABLE public."TAG_REQUEST" ENABLE ROW LEVEL SECURITY;

-- 2. Policies for TAG_REQUEST
-- Authenticated users can insert their own tag requests
CREATE POLICY "Users can insert own tag requests"
ON public."TAG_REQUEST"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = "ACCOUNT_ID");

-- Authenticated users can view their own tag requests
CREATE POLICY "Users can read own tag requests"
ON public."TAG_REQUEST"
FOR SELECT
TO authenticated
USING (auth.uid() = "ACCOUNT_ID");

-- Admins can view all tag requests
CREATE POLICY "Admins can view all tag requests"
ON public."TAG_REQUEST"
FOR SELECT
TO authenticated
USING (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

-- Admins can update tag requests (Accept / Reject)
CREATE POLICY "Admins can update tag requests"
ON public."TAG_REQUEST"
FOR UPDATE
TO authenticated
USING (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()))
WITH CHECK (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

-- Admins can delete tag requests if needed
CREATE POLICY "Admins can delete tag requests"
ON public."TAG_REQUEST"
FOR DELETE
TO authenticated
USING (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));


-- 3. Admin Policies for TAG_GENRE
-- Allow admins to view all tags (active or inactive)
CREATE POLICY "Admins can view all TAG_GENRE"
ON public."TAG_GENRE"
FOR SELECT
TO authenticated
USING (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

-- Allow admins to update tags (name and active state)
CREATE POLICY "Admins can update TAG_GENRE"
ON public."TAG_GENRE"
FOR UPDATE
TO authenticated
USING (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()))
WITH CHECK (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

-- Allow admins to delete tags
CREATE POLICY "Admins can delete TAG_GENRE"
ON public."TAG_GENRE"
FOR DELETE
TO authenticated
USING (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));


-- 4. Admin Policies for TAG_INSTRUMENT
-- Allow admins to view all instrument tags (active or inactive)
CREATE POLICY "Admins can view all TAG_INSTRUMENT"
ON public."TAG_INSTRUMENT"
FOR SELECT
TO authenticated
USING (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

-- Allow admins to update instrument tags (name and active state)
CREATE POLICY "Admins can update TAG_INSTRUMENT"
ON public."TAG_INSTRUMENT"
FOR UPDATE
TO authenticated
USING (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()))
WITH CHECK (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

-- Allow admins to delete instrument tags
CREATE POLICY "Admins can delete TAG_INSTRUMENT"
ON public."TAG_INSTRUMENT"
FOR DELETE
TO authenticated
USING (exists(select 1 from public."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));
