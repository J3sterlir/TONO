-- =============================================================================
-- Migration: 20260928110000_consolidate_rls_security_fixes.sql
-- Description: Consolidates and tightens RLS policies across ADMIN, USER_ACCOUNT,
--              preferences, reviews, notifications, and matching RPC.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADMIN TABLE: Enable RLS & Self-Read Policy
-- -----------------------------------------------------------------------------
ALTER TABLE public."ADMIN" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their own record" ON public."ADMIN";
CREATE POLICY "Admins can view their own record"
ON public."ADMIN"
FOR SELECT
TO authenticated
USING (auth.uid() = "ADMIN_ID");


-- -----------------------------------------------------------------------------
-- 2. USER_ACCOUNT TABLE: Scope Public Reading to Active Artists Only
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read public user accounts" ON public."USER_ACCOUNT";
DROP POLICY IF EXISTS "Public can view active artist accounts" ON public."USER_ACCOUNT";

CREATE POLICY "Public can view active artist accounts"
ON public."USER_ACCOUNT"
FOR SELECT
USING (
    "Is_Banned" IS NOT TRUE
    AND (
        (auth.uid() IS NOT NULL AND auth.uid() = "ACCOUNT_ID")
        OR EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ACCOUNT_ID" = "USER_ACCOUNT"."ACCOUNT_ID"
              AND (a."Status" = 'Active' OR a."Status" IS NULL)
        )
    )
);


-- -----------------------------------------------------------------------------
-- 3. PREFERENCE TABLES: Scope Public Reading to Active Artists
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view account pref genres" ON public."ACCOUNT_PREF_GENRE";
DROP POLICY IF EXISTS "Public can view active artist pref genres" ON public."ACCOUNT_PREF_GENRE";

CREATE POLICY "Public can view active artist pref genres"
ON public."ACCOUNT_PREF_GENRE"
FOR SELECT
USING (
    (auth.uid() IS NOT NULL AND auth.uid() = "ACCOUNT_ID")
    OR EXISTS (
        SELECT 1 FROM public."ARTIST" a
        WHERE a."ACCOUNT_ID" = "ACCOUNT_PREF_GENRE"."ACCOUNT_ID"
          AND (a."Status" = 'Active' OR a."Status" IS NULL)
    )
);

DROP POLICY IF EXISTS "Public can view account pref instruments" ON public."ACCOUNT_PREF_INSTRUMENTS";
DROP POLICY IF EXISTS "Public can view active artist pref instruments" ON public."ACCOUNT_PREF_INSTRUMENTS";

CREATE POLICY "Public can view active artist pref instruments"
ON public."ACCOUNT_PREF_INSTRUMENTS"
FOR SELECT
USING (
    (auth.uid() IS NOT NULL AND auth.uid() = "ACCOUNT_ID")
    OR EXISTS (
        SELECT 1 FROM public."ARTIST" a
        WHERE a."ACCOUNT_ID" = "ACCOUNT_PREF_INSTRUMENTS"."ACCOUNT_ID"
          AND (a."Status" = 'Active' OR a."Status" IS NULL)
    )
);


-- -----------------------------------------------------------------------------
-- 4. TAG MODERATION: Require Admin Privileges for Direct Tag Inserts
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert genre tags" ON public."TAG_GENRE";
DROP POLICY IF EXISTS "Authenticated users can insert instrument tags" ON public."TAG_INSTRUMENT";
DROP POLICY IF EXISTS "Admins can insert genre tags" ON public."TAG_GENRE";
DROP POLICY IF EXISTS "Admins can insert instrument tags" ON public."TAG_INSTRUMENT";

CREATE POLICY "Admins can insert genre tags"
ON public."TAG_GENRE"
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public."ADMIN"
        WHERE "ADMIN_ID" = auth.uid()
    )
);

CREATE POLICY "Admins can insert instrument tags"
ON public."TAG_INSTRUMENT"
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public."ADMIN"
        WHERE "ADMIN_ID" = auth.uid()
    )
);


-- -----------------------------------------------------------------------------
-- 5. FEEDBACK_REVIEW: Scope Public Reading to Active Targets
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view feedback reviews" ON public."FEEDBACK_REVIEW";
DROP POLICY IF EXISTS "Public can view feedback reviews for active artists and businesses" ON public."FEEDBACK_REVIEW";

CREATE POLICY "Public can view feedback reviews for active artists and businesses"
ON public."FEEDBACK_REVIEW"
FOR SELECT
USING (
    (auth.uid() IS NOT NULL AND auth.uid() = "Reviewer_Account_ID")
    OR ("Target_Artist_ID" IS NOT NULL AND EXISTS (
        SELECT 1 FROM public."ARTIST" a
        WHERE a."ARTIST_ID" = "FEEDBACK_REVIEW"."Target_Artist_ID"
          AND (a."Status" = 'Active' OR a."Status" IS NULL)
    ))
    OR ("Target_Business_ID" IS NOT NULL AND EXISTS (
        SELECT 1 FROM public."BUSINESS_PROFILE" b
        WHERE b."BUSINESS_ID" = "FEEDBACK_REVIEW"."Target_Business_ID"
    ))
);


-- -----------------------------------------------------------------------------
-- 6. NOTIFICATION: Restrict Client Inserts to Prevent Notification Spoofing
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public."NOTIFICATION";
DROP POLICY IF EXISTS "Users can insert own notifications" ON public."NOTIFICATION";

CREATE POLICY "Users can insert own notifications"
ON public."NOTIFICATION"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = "Account_ID");
