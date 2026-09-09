-- Enable RLS
ALTER TABLE public."APPLICATION" ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- ARTIST POLICIES
-- ============================================================

-- Artists can submit applications for themselves
CREATE POLICY "Artists can submit own applications"
ON public."APPLICATION"
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public."ARTIST" a
        WHERE a."ARTIST_ID" = "APPLICATION"."Artist_ID"
          AND a."ACCOUNT_ID" = auth.uid()
    )
);


-- Artists can view their own applications
CREATE POLICY "Artists can view own applications"
ON public."APPLICATION"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public."ARTIST" a
        WHERE a."ARTIST_ID" = "APPLICATION"."Artist_ID"
          AND a."ACCOUNT_ID" = auth.uid()
    )
);


-- ============================================================
-- BUSINESS POLICIES
-- ============================================================

-- Businesses can view applications submitted to their listings
CREATE POLICY "Businesses can view applications for own listings"
ON public."APPLICATION"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public."JOB_LISTING" j
        JOIN public."BUSINESS_PROFILE" b
            ON b."BUSINESS_ID" = j."Posted_By_BUSINESS_ID"
        WHERE j."Job_ID" = "APPLICATION"."Job_ID"
          AND b."ACCOUNT_ID" = auth.uid()
    )
);


-- Businesses can update application status
-- only for their own job listings
CREATE POLICY "Businesses can update applications for own listings"
ON public."APPLICATION"
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public."JOB_LISTING" j
        JOIN public."BUSINESS_PROFILE" b
            ON b."BUSINESS_ID" = j."Posted_By_BUSINESS_ID"
        WHERE j."Job_ID" = "APPLICATION"."Job_ID"
          AND b."ACCOUNT_ID" = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public."JOB_LISTING" j
        JOIN public."BUSINESS_PROFILE" b
            ON b."BUSINESS_ID" = j."Posted_By_BUSINESS_ID"
        WHERE j."Job_ID" = "APPLICATION"."Job_ID"
          AND b."ACCOUNT_ID" = auth.uid()
    )
);


-- ============================================================
-- ADMIN POLICY
-- ============================================================

CREATE POLICY "Admins full access to APPLICATION"
ON public."APPLICATION"
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());