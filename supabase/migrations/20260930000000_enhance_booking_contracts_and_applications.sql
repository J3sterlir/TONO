-- =============================================================================
-- Migration: 20260930000000_enhance_booking_contracts_and_applications.sql
-- Description: Adds Start_Date, End_Date, codes, 5-day rush/cancellation flags to 
--              JOB_LISTING and BOOKING_CONTRACT, deploys APPLICATION table with RLS,
--              cascade cancellation trigger, and unified view_deduplicated_events.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENHANCE JOB_LISTING TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE public."JOB_LISTING"
    ADD COLUMN IF NOT EXISTS "Job_Code" TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS "Start_Date" DATE,
    ADD COLUMN IF NOT EXISTS "End_Date" DATE,
    ADD COLUMN IF NOT EXISTS "Start_Time" TEXT,
    ADD COLUMN IF NOT EXISTS "End_Time" TEXT,
    ADD COLUMN IF NOT EXISTS "Requested_Song_Lineup" JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "Compensation_Fee" NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS "Is_Rush_Booking" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Is_Late_Cancellation" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Is_Late_Modification" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Cancellation_Reason" TEXT,
    ADD COLUMN IF NOT EXISTS "Cancelled_By" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID");

-- Backfill Start_Date and End_Date from legacy Date column if present
UPDATE public."JOB_LISTING"
SET "Start_Date" = COALESCE("Start_Date", "Date", CURRENT_DATE),
    "End_Date" = COALESCE("End_Date", "Date", CURRENT_DATE),
    "Start_Time" = COALESCE("Start_Time", "Time", '19:00')
WHERE "Start_Date" IS NULL;

-- Update Status constraint on JOB_LISTING
ALTER TABLE public."JOB_LISTING" 
    DROP CONSTRAINT IF EXISTS "JOB_LISTING_Status_check",
    DROP CONSTRAINT IF EXISTS "job_listing_status_check",
    DROP CONSTRAINT IF EXISTS job_listing_status_check;

ALTER TABLE public."JOB_LISTING" 
    ADD CONSTRAINT "JOB_LISTING_Status_check" 
    CHECK ("Status" IN ('Draft', 'Pending', 'Open', 'Filled', 'Completed', 'Cancelled', 'Closed'));

CREATE INDEX IF NOT EXISTS idx_job_listing_code ON public."JOB_LISTING"("Job_Code");
CREATE INDEX IF NOT EXISTS idx_job_listing_dates ON public."JOB_LISTING"("Start_Date", "End_Date");


-- -----------------------------------------------------------------------------
-- 2. ENHANCE BOOKING_CONTRACT TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE public."BOOKING_CONTRACT"
    ADD COLUMN IF NOT EXISTS "Contract_Code" TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS "Start_Date" DATE,
    ADD COLUMN IF NOT EXISTS "End_Date" DATE,
    ADD COLUMN IF NOT EXISTS "Venue_Location" TEXT,
    ADD COLUMN IF NOT EXISTS "Agreed_Fee" NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS "Song_Lineup_JSON" JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "Is_Rush_Booking" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Is_Late_Cancellation" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Is_Late_Modification" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Cancellation_Reason" TEXT,
    ADD COLUMN IF NOT EXISTS "Cancelled_By" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID");

-- Backfill Start_Date and End_Date from legacy Event_Date column if present
UPDATE public."BOOKING_CONTRACT"
SET "Start_Date" = COALESCE("Start_Date", "Event_Date", CURRENT_DATE),
    "End_Date" = COALESCE("End_Date", "Event_Date", CURRENT_DATE)
WHERE "Start_Date" IS NULL;

-- Update Status constraint on BOOKING_CONTRACT
ALTER TABLE public."BOOKING_CONTRACT" 
    DROP CONSTRAINT IF EXISTS "BOOKING_CONTRACT_Status_check",
    DROP CONSTRAINT IF EXISTS "booking_contract_status_check",
    DROP CONSTRAINT IF EXISTS booking_contract_status_check;

ALTER TABLE public."BOOKING_CONTRACT" 
    ADD CONSTRAINT "BOOKING_CONTRACT_Status_check" 
    CHECK ("Status" IN ('Draft', 'Pending', 'Pending_Artist_Approval', 'Active', 'Confirmed', 'Completed', 'Cancelled', 'Declined'));

CREATE INDEX IF NOT EXISTS idx_booking_contract_code ON public."BOOKING_CONTRACT"("Contract_Code");
CREATE INDEX IF NOT EXISTS idx_booking_contract_dates ON public."BOOKING_CONTRACT"("Start_Date", "End_Date");
CREATE INDEX IF NOT EXISTS idx_booking_contract_job ON public."BOOKING_CONTRACT"("Job_ID");

-- Allow public reading of confirmed bookings for the public artist profile calendar
DROP POLICY IF EXISTS "Public can view confirmed bookings" ON public."BOOKING_CONTRACT";
CREATE POLICY "Public can view confirmed bookings"
ON public."BOOKING_CONTRACT"
FOR SELECT
USING ("Status" IN ('Confirmed', 'Completed'));


-- -----------------------------------------------------------------------------
-- 3. CREATE APPLICATION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."APPLICATION" (
    "Application_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Job_ID" UUID NOT NULL REFERENCES public."JOB_LISTING"("Job_ID") ON DELETE CASCADE,
    "Artist_ID" UUID NOT NULL REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Status" TEXT NOT NULL DEFAULT 'Pending' CHECK ("Status" IN ('Pending', 'Shortlisted', 'Accepted', 'Declined', 'Withdrawn')),
    "Pitch_Message" TEXT,
    "Proposed_Fee" NUMERIC(10, 2),
    "Notes" TEXT,
    "Applied_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_artist_job_application UNIQUE ("Job_ID", "Artist_ID")
);

-- Ensure columns exist if table was already created
ALTER TABLE public."APPLICATION"
    ADD COLUMN IF NOT EXISTS "Pitch_Message" TEXT,
    ADD COLUMN IF NOT EXISTS "Proposed_Fee" NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS "Notes" TEXT;

CREATE INDEX IF NOT EXISTS idx_application_job ON public."APPLICATION"("Job_ID");
CREATE INDEX IF NOT EXISTS idx_application_artist ON public."APPLICATION"("Artist_ID");
CREATE INDEX IF NOT EXISTS idx_application_status ON public."APPLICATION"("Status");

-- Enable RLS on APPLICATION
ALTER TABLE public."APPLICATION" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Artists can view their own applications" ON public."APPLICATION";
CREATE POLICY "Artists can view their own applications"
ON public."APPLICATION"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."ARTIST" a
        WHERE a."ARTIST_ID" = "APPLICATION"."Artist_ID"
          AND a."ACCOUNT_ID" = auth.uid()
    )
);

DROP POLICY IF EXISTS "Businesses can view applications for their jobs" ON public."APPLICATION";
CREATE POLICY "Businesses can view applications for their jobs"
ON public."APPLICATION"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."JOB_LISTING" j
        JOIN public."BUSINESS_PROFILE" b ON b."BUSINESS_ID" = j."Posted_By_BUSINESS_ID"
        WHERE j."Job_ID" = "APPLICATION"."Job_ID"
          AND b."ACCOUNT_ID" = auth.uid()
    )
);

DROP POLICY IF EXISTS "Artists can apply for open jobs" ON public."APPLICATION";
CREATE POLICY "Artists can apply for open jobs"
ON public."APPLICATION"
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public."ARTIST" a
        WHERE a."ARTIST_ID" = "APPLICATION"."Artist_ID"
          AND a."ACCOUNT_ID" = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public."JOB_LISTING" j
        WHERE j."Job_ID" = "APPLICATION"."Job_ID"
          AND j."Status" = 'Open'
    )
);

DROP POLICY IF EXISTS "Businesses can update application status" ON public."APPLICATION";
CREATE POLICY "Businesses can update application status"
ON public."APPLICATION"
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."JOB_LISTING" j
        JOIN public."BUSINESS_PROFILE" b ON b."BUSINESS_ID" = j."Posted_By_BUSINESS_ID"
        WHERE j."Job_ID" = "APPLICATION"."Job_ID"
          AND b."ACCOUNT_ID" = auth.uid()
    )
);

DROP POLICY IF EXISTS "Artists can withdraw own application" ON public."APPLICATION";
DROP POLICY IF EXISTS "Artists can update own application" ON public."APPLICATION";
CREATE POLICY "Artists can update own application"
ON public."APPLICATION"
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."ARTIST" a
        WHERE a."ARTIST_ID" = "APPLICATION"."Artist_ID"
          AND a."ACCOUNT_ID" = auth.uid()
    )
);


-- -----------------------------------------------------------------------------
-- 4. CASCADE CANCELLATION & SLOT MANAGEMENT TRIGGERS
-- -----------------------------------------------------------------------------
-- When a job listing is cancelled, cascade cancel pending contracts and decline applications
CREATE OR REPLACE FUNCTION public.cascade_job_listing_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."Status" = 'Cancelled' AND (OLD."Status" IS DISTINCT FROM 'Cancelled') THEN
        -- Cascade cancel any linked booking contract that is not yet completed
        UPDATE public."BOOKING_CONTRACT"
        SET "Status" = 'Cancelled',
            "Cancellation_Reason" = 'Parent Job Listing cancelled by Business Host',
            "Cancelled_By" = NEW."Cancelled_By",
            "Is_Late_Cancellation" = NEW."Is_Late_Cancellation"
        WHERE "Job_ID" = NEW."Job_ID" 
          AND "Status" NOT IN ('Completed', 'Cancelled');

        -- Cascade decline any pending applications
        UPDATE public."APPLICATION"
        SET "Status" = 'Declined'
        WHERE "Job_ID" = NEW."Job_ID" 
          AND "Status" = 'Pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cascade_job_listing_cancellation ON public."JOB_LISTING";
CREATE TRIGGER trg_cascade_job_listing_cancellation
AFTER UPDATE OF "Status" ON public."JOB_LISTING"
FOR EACH ROW
EXECUTE FUNCTION public.cascade_job_listing_cancellation();

-- When a booking contract tied to Job_ID is created or set to active, mark Job Listing as Closed
CREATE OR REPLACE FUNCTION public.close_job_listing_on_contract_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."Job_ID" IS NOT NULL AND NEW."Status" NOT IN ('Cancelled', 'Declined') THEN
        UPDATE public."JOB_LISTING"
        SET "Status" = 'Closed'
        WHERE "Job_ID" = NEW."Job_ID"
          AND "Status" = 'Open';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_close_job_listing_on_contract_assignment ON public."BOOKING_CONTRACT";
CREATE TRIGGER trg_close_job_listing_on_contract_assignment
AFTER INSERT OR UPDATE OF "Status" ON public."BOOKING_CONTRACT"
FOR EACH ROW
EXECUTE FUNCTION public.close_job_listing_on_contract_assignment();

-- When a contract tied to Job_ID is cancelled or declined, check if slots can be freed
CREATE OR REPLACE FUNCTION public.free_job_slot_on_contract_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."Job_ID" IS NOT NULL AND NEW."Status" IN ('Cancelled', 'Declined') AND (OLD."Status" NOT IN ('Cancelled', 'Declined')) THEN
        -- Check if any other active contracts remain for this job
        IF NOT EXISTS (
            SELECT 1 FROM public."BOOKING_CONTRACT"
            WHERE "Job_ID" = NEW."Job_ID"
              AND "Booking_ID" != NEW."Booking_ID"
              AND "Status" NOT IN ('Cancelled', 'Declined')
        ) THEN
            UPDATE public."JOB_LISTING"
            SET "Status" = 'Open'
            WHERE "Job_ID" = NEW."Job_ID"
              AND "Status" IN ('Filled', 'Closed');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_free_job_slot_on_contract_cancellation ON public."BOOKING_CONTRACT";
CREATE TRIGGER trg_free_job_slot_on_contract_cancellation
AFTER UPDATE OF "Status" ON public."BOOKING_CONTRACT"
FOR EACH ROW
EXECUTE FUNCTION public.free_job_slot_on_contract_cancellation();


-- -----------------------------------------------------------------------------
-- 5. UNIFIED VIEW: DEDUPLICATED EVENTS VIEW
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_deduplicated_events AS
SELECT 
    c."Booking_ID" AS "Contract_ID",
    c."Contract_Code",
    c."Status" AS "Contract_Status",
    c."Provider_Artist_ID" AS "Artist_ID",
    c."Requester_Account_ID",
    c."Provider_Business_ID",
    j."Job_ID",
    j."Job_Code",
    CASE 
        WHEN j."Job_ID" IS NOT NULL THEN j."Event_Title"
        ELSE 'Direct Booking'
    END AS "Display_Title",
    CASE 
        WHEN j."Job_ID" IS NOT NULL THEN 'JOB_LISTING'
        ELSE 'DIRECT_CONTRACT'
    END AS "Event_Source_Type",
    COALESCE(j."Start_Date", c."Start_Date", c."Event_Date") AS "Start_Date",
    COALESCE(j."End_Date", c."End_Date", c."Event_Date") AS "End_Date",
    COALESCE(j."Start_Time", c."Start_Time") AS "Start_Time",
    COALESCE(j."End_Time", c."End_Time") AS "End_Time",
    COALESCE(j."Location", c."Venue_Location") AS "Display_Location",
    c."Agreed_Fee",
    c."Is_Rush_Booking"
FROM public."BOOKING_CONTRACT" c
LEFT JOIN public."JOB_LISTING" j ON c."Job_ID" = j."Job_ID"
WHERE c."Status" IN ('Confirmed', 'Active');
