-- =============================================================================
-- Migration: Fix Security Definer Views & Add Storage Stats RPC
-- Description:
-- 1. Updates public.profile_ratings, public.artist_ratings, and public.business_ratings
--    to WITH (security_invoker = true) resolving Supabase Security Advisor Critical warnings.
-- 2. Creates get_storage_bucket_stats() RPC for fast server aggregation of storage objects.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECURITY DEFINER VIEW FIX
-- -----------------------------------------------------------------------------
ALTER VIEW IF EXISTS public.profile_ratings SET (security_invoker = true);
ALTER VIEW IF EXISTS public.artist_ratings SET (security_invoker = true);
ALTER VIEW IF EXISTS public.business_ratings SET (security_invoker = true);

-- Recreate with explicit WITH (security_invoker = true) to ensure persistence
CREATE OR REPLACE VIEW public.profile_ratings WITH (security_invoker = true) AS
SELECT
    ua."ACCOUNT_ID",
    ua."Username",
    ua."Penalty_Rating_Deduction",
    COUNT(fr."Review_ID") AS total_reviews,
    ROUND(AVG(fr."Rating_Score"), 1) AS raw_avg_rating,
    CASE
        WHEN COUNT(fr."Review_ID") > 0 THEN
            ROUND(GREATEST(1.0, LEAST(5.0, AVG(fr."Rating_Score") - COALESCE(ua."Penalty_Rating_Deduction", 0.0))), 1)
        ELSE NULL
    END AS final_rating
FROM public."USER_ACCOUNT" ua
LEFT JOIN public."FEEDBACK_REVIEW" fr ON fr."Target_Account_ID" = ua."ACCOUNT_ID"
GROUP BY ua."ACCOUNT_ID", ua."Username", ua."Penalty_Rating_Deduction";

CREATE OR REPLACE VIEW public.artist_ratings WITH (security_invoker = true) AS
SELECT 
    a."ARTIST_ID",
    a."ACCOUNT_ID",
    pr.total_reviews,
    pr.raw_avg_rating,
    pr.final_rating,
    pr."Penalty_Rating_Deduction"
FROM public."ARTIST" a
JOIN public.profile_ratings pr ON pr."ACCOUNT_ID" = a."ACCOUNT_ID";

CREATE OR REPLACE VIEW public.business_ratings WITH (security_invoker = true) AS
SELECT
    b."BUSINESS_ID",
    b."ACCOUNT_ID",
    pr.total_reviews,
    pr.raw_avg_rating,
    pr.final_rating,
    pr."Penalty_Rating_Deduction"
FROM public."BUSINESS_PROFILE" b
JOIN public.profile_ratings pr ON pr."ACCOUNT_ID" = b."ACCOUNT_ID";

-- -----------------------------------------------------------------------------
-- 2. STORAGE AGGREGATION RPC FUNCTION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_storage_bucket_stats()
RETURNS TABLE (
    bucket_id text,
    file_count bigint,
    total_bytes numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.bucket_id::text,
        COUNT(o.id)::bigint AS file_count,
        COALESCE(SUM((o.metadata->>'size')::numeric), 0) AS total_bytes
    FROM storage.objects o
    GROUP BY o.bucket_id;
END;
$$;

-- Secure the function so only service_role (server backend) can execute it
REVOKE ALL ON FUNCTION public.get_storage_bucket_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storage_bucket_stats() TO service_role;
