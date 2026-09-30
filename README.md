# TONO
A Web and Mobile Responsive Gig Management, Collaboration, and Promotions Platforms for Independent Artists in Naga City and Camarines Sur.


---
## Current Updates: October 01, 2026

### Key Features & Changes:

### 1. Booking Contract System & Formal Agreements
- **Full Contract Lifecycle (`BOOKING_CONTRACT`)**: End-to-end agreement workflows across statuses (`Pending_Artist_Approval`, `Confirmed`, `Active`, `Completed`, `Cancelled`, `Declined`).
- **Artist Contract Review & Setlist Customization (`ArtistContractModal.vue`)**: Form 2 contract review modal featuring a dual-rule setlist engine (host-requested songs locked with amber accent; artist-customized songs editable with real-time auto-saving setlist drafts).
- **Mobile-Responsive Modal Architecture**: Adaptive viewport containment (`max-h-[92dvh]`), pinned status/action headers, and unclipped scrollable content for seamless mobile contract management.
- **Business Contracts Dashboard (`BusinessContracts.vue`)**: Dedicated host dashboard tracking active commitments, pending artist approvals, and contract history with zero-refresh Supabase realtime synchronization.
- **Proximity Cancellation Protection (`SanctionWarningModal.vue`)**: 5-day proximity sanction protection that warns users about cancellation penalties when modifying or withdrawing confirmed bookings.

### 2. Automated Notification Engine & Realtime Feed
- **Universal Notification Architecture**: Dedicated `NOTIFICATION` infrastructure with RLS security policies, `Sender_Account_ID` attribution, and entity-level tracking (`JOB_LISTING`, `BOOKING_CONTRACT`, `APPLICATION`, `BAND_MEMBERS`).
- **Rich Before-and-After Change Diffs**: Automated PostgreSQL triggers (`trg_notify_job_schedule_update`, `trg_notify_contract_schedule_update`) capturing exact field modifications (e.g., `Time changed from **12:00 PM - 02:00 PM** to **12:00 PM - 02:30 PM**`, venue, pay, date, title) with bold markdown highlights.
- **Standard 12-Hour Clock Formatting**: Database-level `format_time_12h` helper standardizing 24-hour inputs into 12-hour representations (`12:00 PM - 02:30 PM`, `06:30:45 PM`).
- **Interactive Notification Center (`NotificationDropdown.vue`, `NotificationFeedContent.vue`)**: Floating live toast alerts, desktop popover and full-screen mobile drawer, markdown bold parsing with XSS sanitization, read/unread filters, and deep-link navigation.
- **Trigger-Based Automation**: Instant notifications dispatched upon gig schedule adjustments, cancellations, application submissions, contract offers, and band member invitations/responses with 10-second deduplication guards.

### 3. Job Listings & Performer Application Workflows
- **Job Listing Management (`BusinessJobList.vue`)**: Host tooling for posting, drafting, updating, and cancelling gig listings with automated performer contract synchronization.
- **Slot Capacity Automation**: Automated status transitions setting gigs to `Filled` or `Closed` upon contract acceptance, and automatically restoring open slots if bookings are cancelled.
- **Application Flow (`JobDetailsModal.vue`, `BusinessJobApp.vue`)**: Performer proposal submissions with custom pitch messaging and fee proposals, alongside business applicant review queues.

### 4. Band Collaboration & Member Onboarding
- **Role-Based Band Invites**: Direct musician invitation workflows with specific instrument and role assignments.
- **In-Feed Action Guard Rails**: One-click confirmation and decline prompts with guard-rail protection directly inside the notification drawer.

---

## Verification & Testing (October 01, 2026)
- [x] Full booking contract lifecycle verified (`Pending_Artist_Approval` -> `Confirmed` / `Declined`).
- [x] Setlist editing verified with business songs locked and artist additions auto-saving.
- [x] Mobile responsiveness of `ArtistContractModal.vue` verified with unclipped scrollable layout and `Confirmed & Bound` status badge.
- [x] Automated notification triggers verified for gig schedule changes, cancellations, contract status changes, applications, and band invites.
- [x] Notification content formatting verified with standard 12-hour clock (`format_time_12h`) and before/after bold markdown diffs (`formatSubtitle`).
- [x] Deduplication verified across booking contracts and applications ensuring each artist account receives exactly one notification per gig update.

--- 
## Previous Updates: September 20, 2026

### Key Features & Changes:

### 1. Public Artist Profile View & SSR Open Graph Previews
- **Public Profile Route (`/artist/:username`)**: Clean, read-only artist profile matching the layout of the artist dashboard without editing controls.
- **SSR Open Graph Meta Tags**: Dynamic social preview cards for Discord, Messenger, WhatsApp, etc., generating `og:title`, `og:description`, `og:image`, and Twitter card metadata.
- **Deep Linking in Feeds**: Artist cards across `userhome.vue` and `Artisthome.vue` now link directly to `/artist/:username`.
- **Smart Navigation**: Contextual "Back to Discovery" routing based on user type (`/Artisthome` vs `/userhome`) and an "Edit Profile" shortcut for profile owners.
- **Responsive Layout**: Aligned grid and flex containers ensuring empty states and media showcases stretch evenly.

### 2. Artist Portfolio & Rich Media Showcase
- **Media Embeds**: Support for YouTube, Spotify, and SoundCloud embeds (`MediaEmbed.vue`, `embedHelper.ts`).
- **Portfolio Modals**: Modals for uploading/managing featured videos, released audio tracks, milestones/achievements, and promotional posters.
- **Media Cropper & Optimization**: Client-side image cropping and compression (`MediaCropperModal.vue`, `imageOptimizer.ts`).
- **State Management**: Dedicated `useArtistPortfolio.ts` and `useMediaUpload.ts` composables.

### 3. Tag Matching Recommendation Engine
- **Algorithmic Matching**: Supabase RPC `tono_match_recommendations` computing similarity scores based on genres, instruments, specialties, and location.
- **RPC Enhancement**: Added `username` to recommendation candidates to facilitate direct profile links from discovery feeds.
- **Frontend Integration**: `useTonoMatching.ts` composable powering high, medium, and low match sections.

### 4. Admin Suite & Moderation Tools
- **Admin Dashboard (`/admin/*`)**: Complete management suite protected by `useAdminAuth.ts` and route middleware.
- **User Moderation**: Manage users, assign penalties, ban accounts, or perform safe deletions via backend API.
- **Artist Verifications**: Verification queue for pending artist badge applications (`verifications.vue`).
- **Tag Management**: Administrative review and approval workflow for custom genre and instrument tags (`tags.vue`).

### 5. Database Schema, Storage & Security (RLS)
- **Public Read Access**: RLS policies allowing public viewers to fetch artist accounts, bios, genres, and instruments.
- **Storage Buckets**: Configured Supabase storage buckets for `profile_pictures`, `cover_pictures`, and `portfolio` assets with upload limits.
- **Admin & Matching RPCs**: Secure database functions handling matching calculations and admin privileges.

---

## Verification & Testing
- [x] Public artist profiles render correctly at `/artist/:username` with all tabs (About, Portfolio, Reviews, Events).
- [x] Open Graph meta tags validated for social preview scrapers.
- [x] Artist cards in discovery feeds navigate seamlessly to public profiles.
- [x] RLS policies tested for public reading while maintaining strict owner-only write permissions.
- [x] Media embeds (YouTube, Spotify, SoundCloud) display and play responsively.
- [x] Admin dashboard actions (verification, tagging, user moderation) verified.

