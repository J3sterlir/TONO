# TONO
A Web and Mobile Responsive Gig Management, Collaboration, and Promotions Platforms for Independent Artists in Naga City and Camarines Sur.


--- 
## Current Updates: September 20, 2026

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

