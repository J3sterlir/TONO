-- ============================================================================
-- Migration: Enhance Moderation Reports, Evidence Snapshots, Strike System,
--            Platform Bug/Feedback Reporting, and Follow Enhancements
-- Timestamp: 20261019150000
-- ============================================================================

-- 1. Enhance USER_ACCOUNT with moderation, strike, and suspension fields
ALTER TABLE public."USER_ACCOUNT"
    ADD COLUMN IF NOT EXISTS "Strike_Count" INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "Is_Suspended" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Suspended_Until" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "Suspension_Reason" TEXT,
    ADD COLUMN IF NOT EXISTS "Ban_Reason" TEXT,
    ADD COLUMN IF NOT EXISTS "Ban_Contested" BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "Contest_Message" TEXT,
    ADD COLUMN IF NOT EXISTS "Contested_At" TIMESTAMPTZ;

-- 2. Enhance USER_REPORT with granular report targets and evidence snapshots
ALTER TABLE public."USER_REPORT"
    ADD COLUMN IF NOT EXISTS "Report_Type" TEXT NOT NULL DEFAULT 'Profile',
    ADD COLUMN IF NOT EXISTS "Target_Post_ID" UUID REFERENCES public."POST"("POST_ID") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "Target_Comment_ID" UUID REFERENCES public."POST_COMMENTS"("Comment_ID") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "Target_Message_ID" UUID REFERENCES public."MESSAGE"("Message_ID") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "Target_Booking_ID" UUID REFERENCES public."BOOKING_CONTRACT"("Booking_ID") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "Evidence_Snapshot" JSONB,
    ADD COLUMN IF NOT EXISTS "Action_Taken" TEXT DEFAULT 'None',
    ADD COLUMN IF NOT EXISTS "Admin_Notes" TEXT,
    ADD COLUMN IF NOT EXISTS "Resolved_At" TIMESTAMPTZ;

-- Make Reporter_Account_ID nullable for guest bug reports / platform feedback if needed
ALTER TABLE public."USER_REPORT"
    ALTER COLUMN "Reporter_Account_ID" DROP NOT NULL;

-- Update check constraint on USER_REPORT to accommodate platform bugs, feedback, and all targets
ALTER TABLE public."USER_REPORT" DROP CONSTRAINT IF EXISTS chk_report_has_target;
ALTER TABLE public."USER_REPORT" ADD CONSTRAINT chk_report_has_target CHECK (
    "Report_Type" IN ('Bug', 'Feedback', 'Appeal') OR
    "Target_Account_ID" IS NOT NULL OR
    "Target_Business_ID" IS NOT NULL OR
    "Target_Artist_ID" IS NOT NULL OR
    "Target_Job_ID" IS NOT NULL OR
    "Target_Post_ID" IS NOT NULL OR
    "Target_Comment_ID" IS NOT NULL OR
    "Target_Message_ID" IS NOT NULL OR
    "Target_Booking_ID" IS NOT NULL
);

-- 3. Enhance SANCTION_LOG for audit trail of strikes, active penalties, and lifting
ALTER TABLE public."SANCTION_LOG"
    ADD COLUMN IF NOT EXISTS "Report_ID" UUID REFERENCES public."USER_REPORT"("Report_ID") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "Issued_By_Admin_ID" UUID REFERENCES public."ADMIN"("ADMIN_ID") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "Strike_Number" INT,
    ADD COLUMN IF NOT EXISTS "Penalty_Score" NUMERIC,
    ADD COLUMN IF NOT EXISTS "Is_Active" BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS "Lifting_Reason" TEXT,
    ADD COLUMN IF NOT EXISTS "Lifted_At" TIMESTAMPTZ;

-- Update Sanction_Type constraint on SANCTION_LOG if present
ALTER TABLE public."SANCTION_LOG" DROP CONSTRAINT IF EXISTS "SANCTION_LOG_Sanction_Type_check";
ALTER TABLE public."SANCTION_LOG" ADD CONSTRAINT "SANCTION_LOG_Sanction_Type_check" CHECK (
    "Sanction_Type" IN ('Warning', 'Penalty_Deduction', 'Suspension', 'Ban', 'Lifted')
);

-- 4. Row-Level Security (RLS) Policies on USER_REPORT
ALTER TABLE public."USER_REPORT" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporters can view own reports" ON public."USER_REPORT";
CREATE POLICY "Reporters can view own reports" ON public."USER_REPORT"
    FOR SELECT TO authenticated
    USING (auth.uid() = "Reporter_Account_ID");

DROP POLICY IF EXISTS "Users can submit reports" ON public."USER_REPORT";
CREATE POLICY "Users can submit reports" ON public."USER_REPORT"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = "Reporter_Account_ID" OR "Reporter_Account_ID" IS NULL);

DROP POLICY IF EXISTS "Admins full access to USER_REPORT" ON public."USER_REPORT";
CREATE POLICY "Admins full access to USER_REPORT" ON public."USER_REPORT"
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5. Row-Level Security on MESSAGE for Admin Review
DROP POLICY IF EXISTS "Admins full access to MESSAGE" ON public."MESSAGE";
CREATE POLICY "Admins full access to MESSAGE" ON public."MESSAGE"
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_report_type ON public."USER_REPORT"("Report_Type");
CREATE INDEX IF NOT EXISTS idx_user_report_target_post ON public."USER_REPORT"("Target_Post_ID");
CREATE INDEX IF NOT EXISTS idx_user_report_target_comment ON public."USER_REPORT"("Target_Comment_ID");
CREATE INDEX IF NOT EXISTS idx_user_report_target_message ON public."USER_REPORT"("Target_Message_ID");
CREATE INDEX IF NOT EXISTS idx_user_report_target_booking ON public."USER_REPORT"("Target_Booking_ID");
CREATE INDEX IF NOT EXISTS idx_user_account_strikes ON public."USER_ACCOUNT"("Strike_Count");
CREATE INDEX IF NOT EXISTS idx_user_account_suspended ON public."USER_ACCOUNT"("Is_Suspended");
