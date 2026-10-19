-- =============================================================================
-- Migration: 20261020010000_create_artist_custom_schedule.sql
-- Description: 
--   1. Creates table public."ARTIST_CUSTOM_SCHEDULE" for artist personal events/activities.
--   2. Enables RLS: artists can CRUD their own entries; authenticated users can read for slot conflict checks.
--   3. Updates enforce_booking_no_time_overlap trigger on BOOKING_CONTRACT to block bookings
--      during active custom schedule periods.
--   4. Adds ARTIST_CUSTOM_SCHEDULE to supabase_realtime publication.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CREATE ARTIST_CUSTOM_SCHEDULE TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."ARTIST_CUSTOM_SCHEDULE" (
    "Schedule_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Artist_ID" UUID NOT NULL REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Title" TEXT NOT NULL,
    "Start_Date" DATE NOT NULL,
    "End_Date" DATE NOT NULL,
    "Start_Time" TEXT NOT NULL DEFAULT '00:00',
    "End_Time" TEXT NOT NULL DEFAULT '23:59',
    "Description" TEXT,
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_custom_schedule_artist ON public."ARTIST_CUSTOM_SCHEDULE"("Artist_ID");
CREATE INDEX IF NOT EXISTS idx_artist_custom_schedule_dates ON public."ARTIST_CUSTOM_SCHEDULE"("Start_Date", "End_Date");

-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public."ARTIST_CUSTOM_SCHEDULE" ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated users can view custom schedule slots (used for booking availability checks)
DROP POLICY IF EXISTS "Authenticated users can view artist custom schedules" ON public."ARTIST_CUSTOM_SCHEDULE";
CREATE POLICY "Authenticated users can view artist custom schedules"
    ON public."ARTIST_CUSTOM_SCHEDULE" FOR SELECT
    TO authenticated
    USING (true);

-- Policy 2: Artists can insert their own custom schedule activities
DROP POLICY IF EXISTS "Artists can insert own custom schedule" ON public."ARTIST_CUSTOM_SCHEDULE";
CREATE POLICY "Artists can insert own custom schedule"
    ON public."ARTIST_CUSTOM_SCHEDULE" FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "ARTIST_CUSTOM_SCHEDULE"."Artist_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

-- Policy 3: Artists can update their own custom schedule activities
DROP POLICY IF EXISTS "Artists can update own custom schedule" ON public."ARTIST_CUSTOM_SCHEDULE";
CREATE POLICY "Artists can update own custom schedule"
    ON public."ARTIST_CUSTOM_SCHEDULE" FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "ARTIST_CUSTOM_SCHEDULE"."Artist_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "ARTIST_CUSTOM_SCHEDULE"."Artist_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

-- Policy 4: Artists can delete their own custom schedule activities
DROP POLICY IF EXISTS "Artists can delete own custom schedule" ON public."ARTIST_CUSTOM_SCHEDULE";
CREATE POLICY "Artists can delete own custom schedule"
    ON public."ARTIST_CUSTOM_SCHEDULE" FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "ARTIST_CUSTOM_SCHEDULE"."Artist_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 3. UPDATE TIME-SLOT CONCURRENCY LOCK TRIGGER ON BOOKING_CONTRACT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_booking_no_time_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_overlap_count INT;
    v_custom_schedule_count INT;
BEGIN
    IF NEW."Provider_Artist_ID" IS NOT NULL 
       AND NEW."Status" IN ('Confirmed', 'Active', 'Pending_Artist_Approval')
       AND NEW."Start_Date" IS NOT NULL
       AND NEW."Start_Time" IS NOT NULL
       AND NEW."End_Time" IS NOT NULL THEN
        
        -- 1. Check for overlapping booking contracts
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

        -- 2. Check for overlapping artist custom activities / schedule blockers
        SELECT COUNT(*) INTO v_custom_schedule_count
        FROM public."ARTIST_CUSTOM_SCHEDULE" acs
        WHERE acs."Artist_ID" = NEW."Provider_Artist_ID"
          AND NEW."Start_Date" >= acs."Start_Date"
          AND NEW."Start_Date" <= acs."End_Date"
          AND (NEW."Start_Time" < acs."End_Time" AND NEW."End_Time" > acs."Start_Time");

        IF v_custom_schedule_count > 0 THEN
            RAISE EXCEPTION 'Artist is unavailable during this time slot due to a scheduled personal activity or gig.';
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

-- -----------------------------------------------------------------------------
-- 4. REALTIME PUBLICATION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public."ARTIST_CUSTOM_SCHEDULE";
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;
