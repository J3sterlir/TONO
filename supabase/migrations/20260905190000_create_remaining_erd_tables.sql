-- 1. BAND_MEMBERS
CREATE TABLE IF NOT EXISTS public."BAND_MEMBERS" (
    "Band_ID" UUID NOT NULL REFERENCES public."BAND"("ARTIST_ID") ON DELETE CASCADE,
    "Member_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Instrument_Role" TEXT,
    "Status" TEXT NOT NULL DEFAULT 'Pending' CHECK ("Status" IN ('Pending', 'Accepted', 'Declined', 'Left')),
    "Invited_at" TIMESTAMPTZ DEFAULT NOW(),
    "Joined_at" TIMESTAMPTZ,
    PRIMARY KEY ("Band_ID", "Member_ID")
);
CREATE INDEX IF NOT EXISTS idx_band_members_member ON public."BAND_MEMBERS"("Member_ID");
CREATE INDEX IF NOT EXISTS idx_band_members_status ON public."BAND_MEMBERS"("Status");

-- 2. PORTFOLIO
CREATE TABLE IF NOT EXISTS public."PORTFOLIO" (
    "PORTFOLIO_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ARTIST_ID" UUID UNIQUE NOT NULL REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Links" JSONB DEFAULT '[]'::jsonb,
    "Media_ID" UUID,
    "Last_Updated" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_artist ON public."PORTFOLIO"("ARTIST_ID");

-- 3. PORTFOLIO_MEDIA
CREATE TABLE IF NOT EXISTS public."PORTFOLIO_MEDIA" (
    "MEDIA_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ARTIST_ID" UUID NOT NULL REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "PORTFOLIO_ID" UUID REFERENCES public."PORTFOLIO"("PORTFOLIO_ID") ON DELETE CASCADE,
    "Category" TEXT,
    "Description" TEXT,
    "Media_Type" TEXT NOT NULL,
    "File_URL" TEXT NOT NULL,
    "Uploaded_At" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_media_artist ON public."PORTFOLIO_MEDIA"("ARTIST_ID");
CREATE INDEX IF NOT EXISTS idx_portfolio_media_portfolio ON public."PORTFOLIO_MEDIA"("PORTFOLIO_ID");

-- Connect optional featured media constraint on PORTFOLIO
ALTER TABLE public."PORTFOLIO"
    DROP CONSTRAINT IF EXISTS fk_portfolio_featured_media,
    ADD CONSTRAINT fk_portfolio_featured_media
    FOREIGN KEY ("Media_ID") REFERENCES public."PORTFOLIO_MEDIA"("MEDIA_ID") ON DELETE SET NULL;

-- 4. PORTFOLIO_LINK
CREATE TABLE IF NOT EXISTS public."PORTFOLIO_LINK" (
    "LINK_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ARTIST_ID" UUID NOT NULL REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "PORTFOLIO_ID" UUID REFERENCES public."PORTFOLIO"("PORTFOLIO_ID") ON DELETE CASCADE,
    "Category" TEXT,
    "Platform" TEXT,
    "Display_Text" TEXT,
    "URL" TEXT NOT NULL,
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_link_artist ON public."PORTFOLIO_LINK"("ARTIST_ID");
CREATE INDEX IF NOT EXISTS idx_portfolio_link_portfolio ON public."PORTFOLIO_LINK"("PORTFOLIO_ID");

-- 5. JOB_LISTING
CREATE TABLE IF NOT EXISTS public."JOB_LISTING" (
    "Job_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Posted_By_BUSINESS_ID" UUID NOT NULL REFERENCES public."BUSINESS_PROFILE"("BUSINESS_ID") ON DELETE CASCADE,
    "Event_Title" TEXT NOT NULL,
    "Date" DATE,
    "Time" TEXT,
    "Location" TEXT,
    "Description" TEXT,
    "Status" TEXT NOT NULL DEFAULT 'Open' CHECK ("Status" IN ('Open', 'Closed', 'Filled', 'Cancelled')),
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_listing_business ON public."JOB_LISTING"("Posted_By_BUSINESS_ID");
CREATE INDEX IF NOT EXISTS idx_job_listing_status ON public."JOB_LISTING"("Status");

-- 6. BOOKING_CONTRACT
CREATE TABLE IF NOT EXISTS public."BOOKING_CONTRACT" (
    "Booking_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Provider_Business_ID" UUID REFERENCES public."BUSINESS_PROFILE"("BUSINESS_ID") ON DELETE SET NULL,
    "Requester_Account_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Provider_Artist_ID" UUID REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE SET NULL,
    "Job_ID" UUID REFERENCES public."JOB_LISTING"("Job_ID") ON DELETE SET NULL,
    "Booking_Type" TEXT NOT NULL DEFAULT 'Direct',
    "Event_Date" DATE,
    "Start_Time" TEXT,
    "End_Time" TEXT,
    "Song_Lineup" TEXT,
    "Required_Equipment" TEXT,
    "Status" TEXT NOT NULL DEFAULT 'Pending' CHECK ("Status" IN ('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Declined')),
    "Created_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_booking_provider CHECK ("Provider_Business_ID" IS NOT NULL OR "Provider_Artist_ID" IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_booking_requester ON public."BOOKING_CONTRACT"("Requester_Account_ID");
CREATE INDEX IF NOT EXISTS idx_booking_provider_artist ON public."BOOKING_CONTRACT"("Provider_Artist_ID");
CREATE INDEX IF NOT EXISTS idx_booking_provider_business ON public."BOOKING_CONTRACT"("Provider_Business_ID");
CREATE INDEX IF NOT EXISTS idx_booking_job ON public."BOOKING_CONTRACT"("Job_ID");
CREATE INDEX IF NOT EXISTS idx_booking_status ON public."BOOKING_CONTRACT"("Status");

-- 7. FEEDBACK_REVIEW
CREATE TABLE IF NOT EXISTS public."FEEDBACK_REVIEW" (
    "Review_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Reviewer_Account_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Target_Artist_ID" UUID REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Target_Business_ID" UUID REFERENCES public."BUSINESS_PROFILE"("BUSINESS_ID") ON DELETE CASCADE,
    "Target_Account_ID" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Booking_ID" UUID REFERENCES public."BOOKING_CONTRACT"("Booking_ID") ON DELETE CASCADE,
    "Rating_Score" NUMERIC(2, 1) NOT NULL CHECK ("Rating_Score" >= 1.0 AND "Rating_Score" <= 5.0),
    "Written_Feedback" TEXT,
    "Created_At" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_review_has_target CHECK (
        "Target_Artist_ID" IS NOT NULL OR
        "Target_Business_ID" IS NOT NULL OR
        "Target_Account_ID" IS NOT NULL
    )
);
CREATE INDEX IF NOT EXISTS idx_feedback_reviewer ON public."FEEDBACK_REVIEW"("Reviewer_Account_ID");
CREATE INDEX IF NOT EXISTS idx_feedback_target_artist ON public."FEEDBACK_REVIEW"("Target_Artist_ID");
CREATE INDEX IF NOT EXISTS idx_feedback_target_business ON public."FEEDBACK_REVIEW"("Target_Business_ID");
CREATE INDEX IF NOT EXISTS idx_feedback_target_account ON public."FEEDBACK_REVIEW"("Target_Account_ID");
CREATE INDEX IF NOT EXISTS idx_feedback_booking ON public."FEEDBACK_REVIEW"("Booking_ID");

-- 8. USER_REPORT
CREATE TABLE IF NOT EXISTS public."USER_REPORT" (
    "Report_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Reporter_Account_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Target_Account_ID" UUID REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE SET NULL,
    "Target_Business_ID" UUID REFERENCES public."BUSINESS_PROFILE"("BUSINESS_ID") ON DELETE SET NULL,
    "Target_Artist_ID" UUID REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE SET NULL,
    "Target_Job_ID" UUID REFERENCES public."JOB_LISTING"("Job_ID") ON DELETE SET NULL,
    "Resolved_By_Admin_ID" UUID REFERENCES public."ADMIN"("ADMIN_ID") ON DELETE SET NULL,
    "Category" TEXT NOT NULL,
    "Description" TEXT NOT NULL,
    "Created_At" TIMESTAMPTZ DEFAULT NOW(),
    "Is_Resolved" BOOLEAN DEFAULT FALSE,
    CONSTRAINT chk_report_has_target CHECK (
        "Target_Account_ID" IS NOT NULL OR
        "Target_Business_ID" IS NOT NULL OR
        "Target_Artist_ID" IS NOT NULL OR
        "Target_Job_ID" IS NOT NULL
    )
);
CREATE INDEX IF NOT EXISTS idx_user_report_reporter ON public."USER_REPORT"("Reporter_Account_ID");
CREATE INDEX IF NOT EXISTS idx_user_report_resolved ON public."USER_REPORT"("Is_Resolved");
CREATE INDEX IF NOT EXISTS idx_user_report_target_account ON public."USER_REPORT"("Target_Account_ID");
CREATE INDEX IF NOT EXISTS idx_user_report_target_artist ON public."USER_REPORT"("Target_Artist_ID");
CREATE INDEX IF NOT EXISTS idx_user_report_target_business ON public."USER_REPORT"("Target_Business_ID");
CREATE INDEX IF NOT EXISTS idx_user_report_target_job ON public."USER_REPORT"("Target_Job_ID");

-- 9. SANCTION_LOG
CREATE TABLE IF NOT EXISTS public."SANCTION_LOG" (
    "Sanction_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Account_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Sanction_Type" TEXT NOT NULL CHECK ("Sanction_Type" IN ('Warning', 'Penalty_Deduction', 'Suspension', 'Ban')),
    "Reason" TEXT NOT NULL,
    "Created_At" TIMESTAMPTZ DEFAULT NOW(),
    "Expires_At" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sanction_account ON public."SANCTION_LOG"("Account_ID");
CREATE INDEX IF NOT EXISTS idx_sanction_type ON public."SANCTION_LOG"("Sanction_Type");

-- 10. NOTIFICATION
CREATE TABLE IF NOT EXISTS public."NOTIFICATION" (
    "Notification_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Account_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Type" TEXT NOT NULL,
    "Content" TEXT NOT NULL,
    "Action_Link" TEXT,
    "Is_Read" BOOLEAN DEFAULT FALSE,
    "Created_At" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_account ON public."NOTIFICATION"("Account_ID");
CREATE INDEX IF NOT EXISTS idx_notification_unread ON public."NOTIFICATION"("Account_ID", "Is_Read");

-- 11. MESSAGE_THREAD
CREATE TABLE IF NOT EXISTS public."MESSAGE_THREAD" (
    "Thread_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Participant_1_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Participant_2_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Last_Updated" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_distinct_participants CHECK ("Participant_1_ID" <> "Participant_2_ID"),
    CONSTRAINT unique_thread_participants UNIQUE ("Participant_1_ID", "Participant_2_ID")
);
CREATE INDEX IF NOT EXISTS idx_thread_p1 ON public."MESSAGE_THREAD"("Participant_1_ID");
CREATE INDEX IF NOT EXISTS idx_thread_p2 ON public."MESSAGE_THREAD"("Participant_2_ID");
CREATE INDEX IF NOT EXISTS idx_thread_last_updated ON public."MESSAGE_THREAD"("Last_Updated" DESC);

-- 12. MESSAGE
CREATE TABLE IF NOT EXISTS public."MESSAGE" (
    "Message_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Thread_ID" UUID NOT NULL REFERENCES public."MESSAGE_THREAD"("Thread_ID") ON DELETE CASCADE,
    "Sender_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Content" TEXT NOT NULL,
    "Is_Read" BOOLEAN DEFAULT FALSE,
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_thread ON public."MESSAGE"("Thread_ID");
CREATE INDEX IF NOT EXISTS idx_message_sender ON public."MESSAGE"("Sender_ID");
CREATE INDEX IF NOT EXISTS idx_message_created ON public."MESSAGE"("Thread_ID", "Created_at" ASC);

-- 13. POST
CREATE TABLE IF NOT EXISTS public."POST" (
    "POST_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ARTIST_ID" UUID NOT NULL REFERENCES public."ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Media" TEXT,
    "File_URL" TEXT,
    "Caption" TEXT,
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_artist ON public."POST"("ARTIST_ID");
CREATE INDEX IF NOT EXISTS idx_post_created ON public."POST"("Created_at" DESC);

-- 14. POST_COMMENTS
CREATE TABLE IF NOT EXISTS public."POST_COMMENTS" (
    "Comment_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "POST_ID" UUID NOT NULL REFERENCES public."POST"("POST_ID") ON DELETE CASCADE,
    "ACCOUNT_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Content" TEXT NOT NULL,
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public."POST_COMMENTS"("POST_ID");
CREATE INDEX IF NOT EXISTS idx_post_comments_account ON public."POST_COMMENTS"("ACCOUNT_ID");

-- 15. POST_LIKES
CREATE TABLE IF NOT EXISTS public."POST_LIKES" (
    "Like_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "POST_ID" UUID NOT NULL REFERENCES public."POST"("POST_ID") ON DELETE CASCADE,
    "ACCOUNT_ID" UUID NOT NULL REFERENCES public."USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Created_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_post_user_like UNIQUE ("POST_ID", "ACCOUNT_ID")
);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public."POST_LIKES"("POST_ID");
CREATE INDEX IF NOT EXISTS idx_post_likes_account ON public."POST_LIKES"("ACCOUNT_ID");
