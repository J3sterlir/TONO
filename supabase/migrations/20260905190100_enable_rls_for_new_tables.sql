-- =============================================================================
-- Migration: 20260905190100_enable_rls_for_new_tables.sql
-- Description: Enables Row Level Security (RLS) and configures policies for 
--              regular users, artists, businesses, and platform administrators.
-- =============================================================================

-- =============================================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL 15 NEW TABLES
-- =============================================================================
ALTER TABLE public."BAND_MEMBERS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PORTFOLIO" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PORTFOLIO_MEDIA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PORTFOLIO_LINK" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."JOB_LISTING" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BOOKING_CONTRACT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FEEDBACK_REVIEW" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."USER_REPORT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SANCTION_LOG" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NOTIFICATION" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MESSAGE_THREAD" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MESSAGE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."POST" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."POST_COMMENTS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."POST_LIKES" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. PLATFORM ADMINISTRATOR POLICIES (public.is_admin())
-- =============================================================================
CREATE POLICY "Admins full access to BAND_MEMBERS" ON public."BAND_MEMBERS"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to PORTFOLIO" ON public."PORTFOLIO"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to PORTFOLIO_MEDIA" ON public."PORTFOLIO_MEDIA"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to PORTFOLIO_LINK" ON public."PORTFOLIO_LINK"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to JOB_LISTING" ON public."JOB_LISTING"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to BOOKING_CONTRACT" ON public."BOOKING_CONTRACT"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to FEEDBACK_REVIEW" ON public."FEEDBACK_REVIEW"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to USER_REPORT" ON public."USER_REPORT"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to SANCTION_LOG" ON public."SANCTION_LOG"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to NOTIFICATION" ON public."NOTIFICATION"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to MESSAGE_THREAD" ON public."MESSAGE_THREAD"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to MESSAGE" ON public."MESSAGE"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to POST" ON public."POST"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to POST_COMMENTS" ON public."POST_COMMENTS"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to POST_LIKES" ON public."POST_LIKES"
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- 3. BAND_MEMBERS POLICIES
-- =============================================================================
CREATE POLICY "Public can view accepted band members" ON public."BAND_MEMBERS"
    FOR SELECT USING ("Status" = 'Accepted');

CREATE POLICY "Members and band owners can view all memberships" ON public."BAND_MEMBERS"
    FOR SELECT TO authenticated
    USING (
        "Member_ID" = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public."BAND" b
            JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
            WHERE b."ARTIST_ID" = "BAND_MEMBERS"."Band_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Band owners can invite members" ON public."BAND_MEMBERS"
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."BAND" b
            JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
            WHERE b."ARTIST_ID" = "BAND_MEMBERS"."Band_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Members and band owners can update membership" ON public."BAND_MEMBERS"
    FOR UPDATE TO authenticated
    USING (
        "Member_ID" = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public."BAND" b
            JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
            WHERE b."ARTIST_ID" = "BAND_MEMBERS"."Band_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Members and band owners can delete membership" ON public."BAND_MEMBERS"
    FOR DELETE TO authenticated
    USING (
        "Member_ID" = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public."BAND" b
            JOIN public."ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
            WHERE b."ARTIST_ID" = "BAND_MEMBERS"."Band_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

-- =============================================================================
-- 4. PORTFOLIO POLICIES
-- =============================================================================
CREATE POLICY "Public can view portfolios" ON public."PORTFOLIO"
    FOR SELECT USING (true);

CREATE POLICY "Artists can insert own portfolio" ON public."PORTFOLIO"
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "PORTFOLIO"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Artists can update own portfolio" ON public."PORTFOLIO"
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "PORTFOLIO"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Artists can delete own portfolio" ON public."PORTFOLIO"
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "PORTFOLIO"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

-- =============================================================================
-- 5. PORTFOLIO_MEDIA POLICIES
-- =============================================================================
CREATE POLICY "Public can view portfolio media" ON public."PORTFOLIO_MEDIA"
    FOR SELECT USING (true);

CREATE POLICY "Artists can insert own portfolio media" ON public."PORTFOLIO_MEDIA"
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "PORTFOLIO_MEDIA"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Artists can update own portfolio media" ON public."PORTFOLIO_MEDIA"
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "PORTFOLIO_MEDIA"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Artists can delete own portfolio media" ON public."PORTFOLIO_MEDIA"
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "PORTFOLIO_MEDIA"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

-- =============================================================================
-- 6. PORTFOLIO_LINK POLICIES
-- =============================================================================
CREATE POLICY "Public can view portfolio links" ON public."PORTFOLIO_LINK"
    FOR SELECT USING (true);

CREATE POLICY "Artists can insert own portfolio links" ON public."PORTFOLIO_LINK"
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "PORTFOLIO_LINK"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Artists can update own portfolio links" ON public."PORTFOLIO_LINK"
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "PORTFOLIO_LINK"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Artists can delete own portfolio links" ON public."PORTFOLIO_LINK"
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "PORTFOLIO_LINK"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

-- =============================================================================
-- 7. JOB_LISTING POLICIES
-- =============================================================================
CREATE POLICY "Public can view active job listings" ON public."JOB_LISTING"
    FOR SELECT USING (
        "Status" = 'Open' OR
        EXISTS (
            SELECT 1 FROM public."BUSINESS_PROFILE" b
            WHERE b."BUSINESS_ID" = "JOB_LISTING"."Posted_By_BUSINESS_ID"
              AND b."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Business owners can insert own job listings" ON public."JOB_LISTING"
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."BUSINESS_PROFILE" b
            WHERE b."BUSINESS_ID" = "JOB_LISTING"."Posted_By_BUSINESS_ID"
              AND b."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Business owners can update own job listings" ON public."JOB_LISTING"
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."BUSINESS_PROFILE" b
            WHERE b."BUSINESS_ID" = "JOB_LISTING"."Posted_By_BUSINESS_ID"
              AND b."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Business owners can delete own job listings" ON public."JOB_LISTING"
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."BUSINESS_PROFILE" b
            WHERE b."BUSINESS_ID" = "JOB_LISTING"."Posted_By_BUSINESS_ID"
              AND b."ACCOUNT_ID" = auth.uid()
        )
    );

-- =============================================================================
-- 8. BOOKING_CONTRACT POLICIES
-- =============================================================================
CREATE POLICY "Parties can view bookings" ON public."BOOKING_CONTRACT"
    FOR SELECT TO authenticated
    USING (
        auth.uid() = "Requester_Account_ID" OR
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "BOOKING_CONTRACT"."Provider_Artist_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public."BUSINESS_PROFILE" b
            WHERE b."BUSINESS_ID" = "BOOKING_CONTRACT"."Provider_Business_ID"
              AND b."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Requesters can create bookings" ON public."BOOKING_CONTRACT"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = "Requester_Account_ID");

CREATE POLICY "Parties can update bookings" ON public."BOOKING_CONTRACT"
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = "Requester_Account_ID" OR
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "BOOKING_CONTRACT"."Provider_Artist_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public."BUSINESS_PROFILE" b
            WHERE b."BUSINESS_ID" = "BOOKING_CONTRACT"."Provider_Business_ID"
              AND b."ACCOUNT_ID" = auth.uid()
        )
    );

-- =============================================================================
-- 9. FEEDBACK_REVIEW POLICIES
-- =============================================================================
CREATE POLICY "Public can view feedback reviews" ON public."FEEDBACK_REVIEW"
    FOR SELECT USING (true);

CREATE POLICY "Reviewers can insert feedback review" ON public."FEEDBACK_REVIEW"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = "Reviewer_Account_ID");

CREATE POLICY "Reviewers can update own feedback review" ON public."FEEDBACK_REVIEW"
    FOR UPDATE TO authenticated
    USING (auth.uid() = "Reviewer_Account_ID");

CREATE POLICY "Reviewers can delete own feedback review" ON public."FEEDBACK_REVIEW"
    FOR DELETE TO authenticated
    USING (auth.uid() = "Reviewer_Account_ID");

-- =============================================================================
-- 10. USER_REPORT POLICIES
-- =============================================================================
CREATE POLICY "Reporters can view own reports" ON public."USER_REPORT"
    FOR SELECT TO authenticated
    USING (auth.uid() = "Reporter_Account_ID");

CREATE POLICY "Users can submit reports" ON public."USER_REPORT"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = "Reporter_Account_ID");

-- =============================================================================
-- 11. SANCTION_LOG POLICIES
-- =============================================================================
CREATE POLICY "Users can view own sanctions" ON public."SANCTION_LOG"
    FOR SELECT TO authenticated
    USING (auth.uid() = "Account_ID");

-- =============================================================================
-- 12. NOTIFICATION POLICIES
-- =============================================================================
CREATE POLICY "Users can view own notifications" ON public."NOTIFICATION"
    FOR SELECT TO authenticated
    USING (auth.uid() = "Account_ID");

CREATE POLICY "Users can update own notifications" ON public."NOTIFICATION"
    FOR UPDATE TO authenticated
    USING (auth.uid() = "Account_ID");

CREATE POLICY "Users can delete own notifications" ON public."NOTIFICATION"
    FOR DELETE TO authenticated
    USING (auth.uid() = "Account_ID");

CREATE POLICY "Authenticated users can insert notifications" ON public."NOTIFICATION"
    FOR INSERT TO authenticated
    WITH CHECK (auth.role() = 'authenticated');

-- =============================================================================
-- 13. MESSAGE_THREAD POLICIES
-- =============================================================================
CREATE POLICY "Participants can view message threads" ON public."MESSAGE_THREAD"
    FOR SELECT TO authenticated
    USING (auth.uid() = "Participant_1_ID" OR auth.uid() = "Participant_2_ID");

CREATE POLICY "Users can start message threads" ON public."MESSAGE_THREAD"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = "Participant_1_ID" OR auth.uid() = "Participant_2_ID");

CREATE POLICY "Participants can update message threads" ON public."MESSAGE_THREAD"
    FOR UPDATE TO authenticated
    USING (auth.uid() = "Participant_1_ID" OR auth.uid() = "Participant_2_ID");

-- =============================================================================
-- 14. MESSAGE POLICIES
-- =============================================================================
CREATE POLICY "Participants can view messages" ON public."MESSAGE"
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."MESSAGE_THREAD" t
            WHERE t."Thread_ID" = "MESSAGE"."Thread_ID"
              AND (auth.uid() = t."Participant_1_ID" OR auth.uid() = t."Participant_2_ID")
        )
    );

CREATE POLICY "Participants can send messages" ON public."MESSAGE"
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = "Sender_ID" AND
        EXISTS (
            SELECT 1 FROM public."MESSAGE_THREAD" t
            WHERE t."Thread_ID" = "MESSAGE"."Thread_ID"
              AND (auth.uid() = t."Participant_1_ID" OR auth.uid() = t."Participant_2_ID")
        )
    );

CREATE POLICY "Participants can mark messages read" ON public."MESSAGE"
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."MESSAGE_THREAD" t
            WHERE t."Thread_ID" = "MESSAGE"."Thread_ID"
              AND (auth.uid() = t."Participant_1_ID" OR auth.uid() = t."Participant_2_ID")
        )
    );

-- =============================================================================
-- 15. POST, COMMENTS, AND LIKES POLICIES
-- =============================================================================
CREATE POLICY "Public can view posts" ON public."POST"
    FOR SELECT USING (true);

CREATE POLICY "Artists can insert own posts" ON public."POST"
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "POST"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Artists can update own posts" ON public."POST"
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "POST"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Artists can delete own posts" ON public."POST"
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."ARTIST" a
            WHERE a."ARTIST_ID" = "POST"."ARTIST_ID"
              AND a."ACCOUNT_ID" = auth.uid()
        )
    );

CREATE POLICY "Public can view post comments" ON public."POST_COMMENTS"
    FOR SELECT USING (true);

CREATE POLICY "Users can insert comments" ON public."POST_COMMENTS"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can update own comments" ON public."POST_COMMENTS"
    FOR UPDATE TO authenticated
    USING (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can delete own comments" ON public."POST_COMMENTS"
    FOR DELETE TO authenticated
    USING (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Public can view post likes" ON public."POST_LIKES"
    FOR SELECT USING (true);

CREATE POLICY "Users can insert likes" ON public."POST_LIKES"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can delete likes" ON public."POST_LIKES"
    FOR DELETE TO authenticated
    USING (auth.uid() = "ACCOUNT_ID");
