-- =============================================================================
-- Migration: 20261016041111_add_feedback_review_constraints.sql
-- Description:
--   1. Adds Is_Public flag to JOB_LISTING for event broadcast filtering.
--   2. Enforces unique constraints and auto-target triggers on FEEDBACK_REVIEW.
--   3. Creates dynamic rating calculation views (profile_ratings, artist_ratings, business_ratings)
--      incorporating Penalty_Rating_Deduction from USER_ACCOUNT clamped [1.0, 5.0].
--   4. Creates mark_job_completed RPC and cascade completion triggers.
--   5. Deploys database-level time-slot concurrency lock trigger on BOOKING_CONTRACT.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENHANCE JOB_LISTING TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE public."JOB_LISTING"
    ADD COLUMN IF NOT EXISTS "Is_Public" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_job_listing_public ON public."JOB_LISTING"("Is_Public", "Status");


-- -----------------------------------------------------------------------------
-- 2. ENHANCE FEEDBACK_REVIEW CONSTRAINTS & TRIGGERS
-- -----------------------------------------------------------------------------
-- Ensure Booking_ID has an index and unique constraint per reviewer
CREATE INDEX IF NOT EXISTS idx_feedback_review_booking ON public."FEEDBACK_REVIEW"("Booking_ID");

ALTER TABLE public."FEEDBACK_REVIEW"
    DROP CONSTRAINT IF EXISTS uq_feedback_booking_reviewer;

ALTER TABLE public."FEEDBACK_REVIEW"
    ADD CONSTRAINT uq_feedback_booking_reviewer UNIQUE ("Booking_ID", "Reviewer_Account_ID");

-- Auto-resolve Target_Account_ID if only Target_Artist_ID or Target_Business_ID is supplied
CREATE OR REPLACE FUNCTION public.resolve_feedback_target_account()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."Target_Account_ID" IS NULL THEN
        IF NEW."Target_Artist_ID" IS NOT NULL THEN
            SELECT a."ACCOUNT_ID" INTO NEW."Target_Account_ID"
            FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = NEW."Target_Artist_ID";
        ELSIF NEW."Target_Business_ID" IS NOT NULL THEN
            SELECT b."ACCOUNT_ID" INTO NEW."Target_Account_ID"
            FROM public."BUSINESS_PROFILE" b
            WHERE b."BUSINESS_ID" = NEW."Target_Business_ID";
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_resolve_feedback_target_account ON public."FEEDBACK_REVIEW";
CREATE TRIGGER trg_resolve_feedback_target_account
BEFORE INSERT ON public."FEEDBACK_REVIEW"
FOR EACH ROW
EXECUTE FUNCTION public.resolve_feedback_target_account();


-- -----------------------------------------------------------------------------
-- 3. DYNAMIC PROFILE RATINGS VIEWS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profile_ratings AS
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

CREATE OR REPLACE VIEW public.artist_ratings AS
SELECT 
    a."ARTIST_ID",
    a."ACCOUNT_ID",
    pr.total_reviews,
    pr.raw_avg_rating,
    pr.final_rating,
    pr."Penalty_Rating_Deduction"
FROM public."ARTIST" a
JOIN public.profile_ratings pr ON pr."ACCOUNT_ID" = a."ACCOUNT_ID";

CREATE OR REPLACE VIEW public.business_ratings AS
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
-- 4. RLS POLICIES FOR FEEDBACK_REVIEW
-- -----------------------------------------------------------------------------
ALTER TABLE public."FEEDBACK_REVIEW" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view feedback reviews" ON public."FEEDBACK_REVIEW";
CREATE POLICY "Public can view feedback reviews"
ON public."FEEDBACK_REVIEW"
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Authorized users can insert feedback review" ON public."FEEDBACK_REVIEW";
CREATE POLICY "Authorized users can insert feedback review"
ON public."FEEDBACK_REVIEW"
FOR INSERT
WITH CHECK (
    auth.uid() = "Reviewer_Account_ID"
    AND (
        "Booking_ID" IS NULL OR
        EXISTS (
            SELECT 1 FROM public."BOOKING_CONTRACT" bc
            WHERE bc."Booking_ID" = "FEEDBACK_REVIEW"."Booking_ID"
              AND bc."Status" = 'Completed'
              AND (
                  bc."Requester_Account_ID" = auth.uid()
                  OR EXISTS (SELECT 1 FROM public."ARTIST" a WHERE a."ARTIST_ID" = bc."Provider_Artist_ID" AND a."ACCOUNT_ID" = auth.uid())
                  OR EXISTS (SELECT 1 FROM public."BUSINESS_PROFILE" bp WHERE bp."BUSINESS_ID" = bc."Provider_Business_ID" AND bp."ACCOUNT_ID" = auth.uid())
              )
        )
    )
);


-- -----------------------------------------------------------------------------
-- 5. JOB COMPLETION CASCADE & RPC
-- -----------------------------------------------------------------------------
-- When a job listing is completed, automatically complete tied active contracts
CREATE OR REPLACE FUNCTION public.sync_job_listing_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."Status" = 'Completed' AND (OLD."Status" IS DISTINCT FROM 'Completed') THEN
        UPDATE public."BOOKING_CONTRACT"
        SET "Status" = 'Completed'
        WHERE "Job_ID" = NEW."Job_ID"
          AND "Status" IN ('Confirmed', 'Active');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_job_listing_completion ON public."JOB_LISTING";
CREATE TRIGGER trg_sync_job_listing_completion
AFTER UPDATE OF "Status" ON public."JOB_LISTING"
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_listing_completion();

-- Manual completion RPC for Job Listing
CREATE OR REPLACE FUNCTION public.mark_job_completed(p_job_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_job RECORD;
    v_business RECORD;
BEGIN
    SELECT * INTO v_job FROM public."JOB_LISTING" WHERE "Job_ID" = p_job_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job listing not found');
    END IF;

    -- Verify ownership
    SELECT * INTO v_business FROM public."BUSINESS_PROFILE" WHERE "BUSINESS_ID" = v_job."Posted_By_BUSINESS_ID";
    IF v_business."ACCOUNT_ID" <> auth.uid() THEN
        IF NOT EXISTS (SELECT 1 FROM public."ADMIN" WHERE "ADMIN_ID" = auth.uid()) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to complete this job');
        END IF;
    END IF;

    UPDATE public."JOB_LISTING"
    SET "Status" = 'Completed'
    WHERE "Job_ID" = p_job_id;

    UPDATE public."BOOKING_CONTRACT"
    SET "Status" = 'Completed'
    WHERE "Job_ID" = p_job_id
      AND "Status" IN ('Confirmed', 'Active');

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_job_completed(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 6. TIME-SLOT CONCURRENCY LOCK TRIGGER ON BOOKING_CONTRACT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_booking_no_time_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_overlap_count INT;
BEGIN
    IF NEW."Provider_Artist_ID" IS NOT NULL 
       AND NEW."Status" IN ('Confirmed', 'Active', 'Pending_Artist_Approval')
       AND NEW."Start_Date" IS NOT NULL
       AND NEW."Start_Time" IS NOT NULL
       AND NEW."End_Time" IS NOT NULL THEN
        
        SELECT COUNT(*) INTO v_overlap_count
        FROM public."BOOKING_CONTRACT" bc
        WHERE bc."Provider_Artist_ID" = NEW."Provider_Artist_ID"
          AND bc."Booking_ID" <> COALESCE(NEW."Booking_ID", '00000000-0000-0000-0000-000000000000'::uuid)
          AND bc."Start_Date" = NEW."Start_Date"
          AND bc."Status" IN ('Confirmed', 'Active', 'Pending_Artist_Approval')
          AND (NEW."Start_Time" < bc."End_Time" AND NEW."End_Time" > bc."Start_Time");

        IF v_overlap_count > 0 THEN
            RAISE EXCEPTION 'Artist already has an active booking or pending request during this time slot (1st come, 1st served).';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_booking_no_time_overlap ON public."BOOKING_CONTRACT";
CREATE TRIGGER trg_enforce_booking_no_time_overlap
BEFORE INSERT OR UPDATE OF "Start_Date", "Start_Time", "End_Time", "Status" ON public."BOOKING_CONTRACT"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_no_time_overlap();
