<template>
    <div class="min-h-screen bg-[#0E0E10] text-white p-8">
        <div class="max-w-5xl mx-auto space-y-8">

            <!-- Test Controls -->
            <div class="flex items-center gap-4 p-4 rounded-xl bg-[#1C1C1F] border border-[#3A3A3C]">
                <h1 class="font-Sora font-bold text-lg text-[#D0D4F7]">Booking UI Sandbox</h1>
                <button @click="showModal = true"
                    class="px-4 py-2 rounded-lg bg-[#D0D4F7] text-[#0E0E10] font-semibold text-sm hover:bg-white transition-all cursor-pointer">
                    Open Booking Modal
                </button>
            </div>

            <!-- Preview: Unified Bookings Tab Layout -->
            <section class="space-y-4">
                <h2 class="font-Sora text-base text-gray-400">Preview: User Bookings Filter</h2>

                <!-- Filter Pills Preview -->
                <div class="flex gap-2">
                    <button v-for="tab in ['All', 'Active', 'Pending', 'Completed', 'Cancelled']" :key="tab"
                        @click="activeFilter = tab"
                        :class="activeFilter === tab ? 'bg-[#D0D4F7] text-[#0E0E10]' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C]'"
                        class="px-4 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all">
                        {{ tab }}
                    </button>
                </div>

                <!-- Sample Cards Preview using Mock Data -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div v-for="item in mockBookings" :key="item.id"
                        class="p-5 rounded-2xl bg-[#1C1C1F]/60 border border-[#46464D]/40 space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="font-Sora font-semibold text-white">{{ item.artistName }}</span>
                            <span class="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium"
                                :class="statusBadgeClass(item.status)">
                                {{ item.status }}
                            </span>
                        </div>
                        <p class="text-xs text-gray-400">📅 {{ item.date }} • {{ item.time }}</p>
                        <p class="text-xs text-gray-300">📍 {{ item.venue }}</p>
                    </div>
                </div>
            </section>

            <!-- Mount Direct Booking Modal -->
            <DirectBookingModal :is-open="showModal" artist-name="Ahsoka" artist-type="Solo Artist"
                @close="showModal = false" @submit="handleBookingSubmit" />

            <!-- Success Notification / Submitted Payload Box -->
            <div v-if="lastSubmittedBooking"
                class="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 text-emerald-200 animate-in fade-in duration-200">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 font-Sora font-semibold text-emerald-300">
                        <Icon name="ic:round-check-circle" class="text-xl" />
                        <span>Booking Request Emitted Successfully!</span>
                    </div>
                    <button @click="lastSubmittedBooking = null"
                        class="text-xs text-gray-400 hover:text-white cursor-pointer">
                        Dismiss
                    </button>
                </div>
                <p class="text-xs text-gray-300">Here is the contract payload that would be sent to Supabase:</p>
                <pre
                    class="bg-black/60 p-3 rounded-xl text-xs font-mono text-[#D0D4F7] overflow-x-auto">{{ JSON.stringify(lastSubmittedBooking, null, 2) }}</pre>
            </div>

        </div>

        <!-- Booking Contract Creation Modal -->
        <div
            class="bg-[#131315] border border-[#2A2A2E]/60 rounded-2xl p-6 sm:p-8 max-w-5xl mx-auto mt-8 space-y-6 transition-all">
            <div class="flex">
                <!-- Status Indicator -->
                <div v-if="isContract1DraftSaving"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
                    <Icon name="ic:baseline-sync" class="animate-spin text-sm" />
                    <span>Saving draft...</span>
                </div>
                <div v-else-if="contract1LastSavedTime"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono"
                    title="Draft saved automatically to local storage">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Draft saved {{ contract1LastSavedTime }}</span>
                </div>
            </div>
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 font-Sora">
                <div class="flex flex-col gap-1">
                    <h1 class="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-none">
                        BK-121201-2026</h1><!--BK-[month-day-bookingcount]-[YEAR]-->
                    <h2 class="text-sm sm:text-[16px] text-[#D0D4F7] font-medium tracking-wide">BOOKING CONTRACT
                        CREATION
                    </h2>
                </div>

                <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start sm:self-end">
                    <button type="button" @click="saveContract1DraftManual"
                        class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-5 py-2.5 rounded-full border border-[#46464D] hover:bg-white/5 hover:border-gray-400 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                        <Icon v-if="isContract1DraftSaving" name="ic:baseline-sync"
                            class="animate-spin text-sm text-[#D0D4F7]" />
                        <span>Save Draft</span>
                    </button>
                    <button type="button" @click="resetContract1Form"
                        class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-5 py-2.5 rounded-full border border-[#46464D] hover:border-red-500/50 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer whitespace-nowrap">
                        Cancel Booking
                    </button>
                    <button type="button" @click="handleContract1Submit"
                        class="text-xs sm:text-sm font-bold text-[#131315] bg-[#D0D4F7] hover:bg-white px-6 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap shadow-sm">
                        Save Contract
                    </button>
                </div>
            </div>

            <div class="flex flex-col gap-6">
                <!-- Participants Card -->
                <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 flex flex-col gap-5">
                    <div class="flex items-center gap-3">
                        <Icon name="ic:baseline-supervisor-account" class="text-xl text-[#D0D4F7]" />
                        <h2 class="text-lg sm:text-xl font-Sora font-semibold text-white">Participants</h2>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUSINESS
                                ACCOUNT</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{ contract1Form.businessName
                                }}</p>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">REQUESTER
                                ACCOUNT</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{
                                contract1Form.requesterName }}</p>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">ARTIST
                                ACCOUNT</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{ contract1Form.artistName
                                }}</p>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB ID</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{ contract1Form.jobId }}</p>
                        </div>
                    </div>
                </div>

                <!-- Event Details Card -->
                <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 flex flex-col gap-6">
                    <div class="flex items-center gap-3">
                        <Icon name="ic:baseline-calendar-today" class="text-xl text-[#D0D4F7]" />
                        <h2 class="text-lg sm:text-xl font-Sora font-semibold text-white">Event Details</h2>
                    </div>

                    <!-- Row 1: Booking Type & Event Date -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 font-Sora">
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BOOKING
                                TYPE</span>
                            <input type="text" v-model="contract1Form.bookingType"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full"
                                placeholder="Enter Booking type" />
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">VENUE</span>
                            <input type="text" v-model="contract1Form.venueLocation"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full"
                                placeholder="Venue address" />
                        </div>

                    </div>

                    <!-- Row 2: Timing & Venue -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 font-Sora">
                        <div class="grid grid-cols-2 gap-3">
                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START DATE</span>
                                <div class="relative flex items-center">
                                    <input type="date" v-model="contract1Form.startDate"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                        <Icon name="ic:baseline-calendar-month" class="text-xl" />
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END
                                    DATE</span>
                                <div class="relative flex items-center">
                                    <input type="date" v-model="contract1Form.endDate"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                        <Icon name="ic:baseline-calendar-month" class="text-xl" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3 sm:gap-4">
                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <div class="flex items-center justify-between">
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START TIME</span>
                                    <span v-if="contract1Form.startTime" class="text-xs text-[#D0D4F7] font-medium">{{ formatTime12(contract1Form.startTime) }}</span>
                                </div>
                                <div class="relative flex items-center">
                                    <input type="time" v-model="contract1Form.startTime"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                                        <Icon name="ic:outline-access-time" class="text-lg" />
                                    </div>
                                </div>
                            </div>

                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <div class="flex items-center justify-between">
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END TIME</span>
                                    <span v-if="contract1Form.endTime" class="text-xs text-[#D0D4F7] font-medium">{{ formatTime12(contract1Form.endTime) }}</span>
                                </div>
                                <div class="relative flex items-center">
                                    <input type="time" v-model="contract1Form.endTime"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                                        <Icon name="ic:outline-access-time" class="text-lg" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Divider -->
                    <hr class="border-[#2A2A2E]/70 my-1" />

                    <!-- Row 3: Description, Lineup, Technical Setup -->
                    <div class="flex flex-col gap-4 font-Sora">
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BOOKING
                                DESCRIPTION</span>
                            <textarea v-model="contract1Form.description" rows="3"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full resize-none"
                                placeholder="Enter Gig Description"></textarea>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">EQUIPMENT &amp;
                                TECHNICAL SETUP</span>
                            <textarea v-model="contract1Form.requiredEquipment" rows="3"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full resize-none"
                                placeholder="Enter Required & Provided Equipment"></textarea>
                        </div>

                        <!-- Song Lineup Card -->
                        <div
                            class="flex flex-col gap-2.5 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                            <div class="flex items-center justify-between">
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">SONG
                                    LINEUP</span>
                                <span v-if="contract1SongLineupList.length" class="text-[11px] font-mono text-gray-400">
                                    {{ contract1SongLineupList.length }} {{ contract1SongLineupList.length === 1 ?
                                    'song' : 'songs' }}
                                </span>
                            </div>

                            <!-- Song Lineup Items -->
                            <div class="space-y-2 font-Sora">
                                <div v-for="(song, index) in contract1SongLineupList" :key="song.id"
                                    class="group flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#1B1B1E] border border-[#2D2D32]/80 hover:border-[#46464D] rounded-xl transition-all">
                                    <div class="flex items-center gap-3 flex-1 min-w-0">
                                        <!-- Vertical Accent Bar -->
                                        <div class="w-1 h-5 rounded-full bg-[#D0D4F7] shrink-0"></div>

                                        <!-- Song Title Input -->
                                        <input type="text" v-model="song.title" placeholder="Enter song title"
                                            class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-sm font-medium w-full" />
                                    </div>

                                    <!-- Duration & Remove Button -->
                                    <div class="flex items-center gap-2 shrink-0">
                                        <input type="text" v-model="song.duration" placeholder="00:00"
                                            class="bg-transparent border-0 outline-none text-gray-400 hover:text-white focus:text-white placeholder-gray-600 text-xs font-mono text-right w-14" />
                                        <button type="button" @click="removeContract1Song(index)"
                                            class="flex text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                                            title="Remove song">
                                            <Icon name="ic:round-close" class="text-base" />
                                        </button>
                                    </div>
                                </div>

                                <!-- Add song to setlist button -->
                                <button type="button" @click="addContract1Song"
                                    class="group flex items-center justify-between w-full px-3.5 py-2.5 bg-[#1B1B1E]/60 hover:bg-[#1B1B1E] border border-[#2D2D32]/60 hover:border-[#46464D] rounded-xl text-gray-400 hover:text-white text-xs sm:text-sm font-medium transition-all cursor-pointer">
                                    <span class="flex items-center gap-1.5">
                                        <span>+</span>
                                        <span>Add song to setlist</span>
                                    </span>
                                    <span class="text-base font-light text-gray-400 group-hover:text-white">+</span>
                                </button>
                            </div>

                            <!-- Preview of comma-separated string that will be sent to the database -->
                            <div v-if="formattedContract1SongLineup"
                                class="pt-1 text-[11px] text-gray-400 flex items-center gap-2 font-mono">
                                <span class="text-gray-500 shrink-0">DB Payload:</span>
                                <span class="text-[#D0D4F7]/90 truncate">"{{ formattedContract1SongLineup }}"</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Form 1 Submitted Payload Feedback -->
        <div v-if="lastSubmittedContract1"
            class="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 text-emerald-200 animate-in fade-in duration-200 max-w-5xl mx-auto mt-4 font-Sora">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 font-semibold text-emerald-300">
                    <Icon name="ic:round-check-circle" class="text-xl" />
                    <span>Contract 1 Saved &amp; Emitted Successfully!</span>
                </div>
                <button @click="lastSubmittedContract1 = null"
                    class="text-xs text-gray-400 hover:text-white cursor-pointer">
                    Dismiss
                </button>
            </div>
            <p class="text-xs text-gray-300">Payload matching BOOKING_CONTRACT table schema:</p>
            <pre
                class="bg-black/60 p-3 rounded-xl text-xs font-mono text-[#D0D4F7] overflow-x-auto">{{ JSON.stringify(lastSubmittedContract1, null, 2) }}</pre>
        </div>

        <!-- Booking Contract Artist View Modal -->
        <div class="bg-[#131315] border border-[#2A2A2E]/60 rounded-2xl p-6 sm:p-8 max-w-5xl mx-auto mt-8 space-y-6">
            <div class="flex">
                <!-- Status Indicator -->
                <div v-if="isArtistDraftSaving"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
                    <Icon name="ic:baseline-sync" class="animate-spin text-sm" />
                    <span>Saving draft...</span>
                </div>
                <div v-else-if="artistLastSavedTime"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono"
                    title="Draft saved automatically to local storage">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Draft saved {{ artistLastSavedTime }}</span>
                </div>
            </div>

            <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4 font-Sora">
                <div class="flex flex-col gap-1">
                    <h1 class="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-none">
                        BK-121201-2026</h1><!--BK-[month-day-bookingcount]-[YEAR]-->
                    <h2 class="text-sm sm:text-[16px] text-[#D0D4F7] font-medium tracking-wide">ARTIST BOOKING CONTRACT
                    </h2>
                </div>

                <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start lg:self-end">
                    <button type="button" @click="saveArtistDraftManual"
                        class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-5 py-2.5 rounded-full border border-[#46464D] hover:bg-white/5 hover:border-gray-400 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                        <Icon v-if="isArtistDraftSaving" name="ic:baseline-sync"
                            class="animate-spin text-sm text-[#D0D4F7]" />
                        <span>Save Draft</span>
                    </button>
                    <button type="button" @click="handleArtistReject"
                        class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-5 py-2.5 rounded-full border border-[#46464D] hover:border-red-500/50 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer whitespace-nowrap">
                        Reject Contract
                    </button>
                    <button type="button" @click="handleArtistAccept"
                        class="text-xs sm:text-sm font-bold text-[#131315] bg-[#D0D4F7] hover:bg-white px-6 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap shadow-sm">
                        Accept Contract
                    </button>
                </div>
            </div>

            <div class="flex flex-col gap-6">
                <div class="flex flex-col sm:flex-row gap-6">
                    <div class="bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 p-6 rounded-xl w-full">
                        <div class="flex gap-2">
                            <Icon name="ic:baseline-supervisor-account" class="text-xl text-[#D0D4F7]" />
                            <h1 class="mb-6 text-lg sm:text-xl font-Sora font-semibold text-white">Participants</h1>
                        </div>

                        <div class="flex flex-col gap-4">
                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUSINESS
                                    ACCOUNT</h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{
                                    artistContractForm.businessName }}</p>
                            </span>

                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">REQUESTER
                                    ACCOUNT</h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{
                                    artistContractForm.requesterName }}</p>
                            </span>

                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">ARTIST ACCOUNT
                                </h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{
                                    artistContractForm.artistName }}</p>
                            </span>

                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB ID</h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{
                                    artistContractForm.jobId }}</p>
                            </span>
                        </div>
                    </div>

                    <div class="bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 p-6 rounded-xl w-full">
                        <div class="flex gap-2">
                            <Icon name="ic:baseline-calendar-today" class="text-xl text-[#D0D4F7]" />
                            <h2 class="mb-6 text-lg sm:text-xl font-Sora font-semibold text-white">Event Details</h2>
                        </div>

                        <div class="flex flex-col gap-4">
                            <div class="grid grid-cols-2 gap-3">
                                <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START
                                        DATE</span>
                                    <div class="relative flex items-center">
                                        <input type="date" v-model="artistContractForm.startDate"
                                            class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                        <div
                                            class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                            <Icon name="ic:baseline-calendar-month" class="text-xl" />
                                        </div>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END
                                        DATE</span>
                                    <div class="relative flex items-center">
                                        <input type="date" v-model="artistContractForm.endDate"
                                            class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                        <div
                                            class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                            <Icon name="ic:baseline-calendar-month" class="text-xl" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-3 sm:gap-4">
                                <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                    <div class="flex items-center justify-between">
                                        <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START TIME</span>
                                        <span v-if="artistContractForm.startTime" class="text-xs text-[#D0D4F7] font-medium">{{ formatTime12(artistContractForm.startTime) }}</span>
                                    </div>
                                    <div class="relative flex items-center">
                                        <input type="time" v-model="artistContractForm.startTime"
                                            class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                        <div
                                            class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                                            <Icon name="ic:outline-access-time" class="text-lg" />
                                        </div>
                                    </div>
                                </div>

                                <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                    <div class="flex items-center justify-between">
                                        <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END TIME</span>
                                        <span v-if="artistContractForm.endTime" class="text-xs text-[#D0D4F7] font-medium">{{ formatTime12(artistContractForm.endTime) }}</span>
                                    </div>
                                    <div class="relative flex items-center">
                                        <input type="time" v-model="artistContractForm.endTime"
                                            class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                        <div
                                            class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                                            <Icon name="ic:outline-access-time" class="text-lg" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BOOKING TYPE
                                </h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{
                                    artistContractForm.bookingType }}</p>
                            </span>

                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BOOKING
                                    DESCRIPTION</h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{
                                    artistContractForm.description }}</p>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-6 sm:flex-row">
                    <div class="flex flex-col gap-2.5 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">SONG
                                LINEUP</span>
                            <span v-if="artistSongLineupList.length" class="text-[11px] font-mono text-gray-400">
                                {{ artistSongLineupList.length }} {{ artistSongLineupList.length === 1 ? 'song' :
                                'songs' }}
                            </span>
                        </div>

                        <!-- Song Lineup Items -->
                        <div class="space-y-2 font-Sora">
                            <div v-for="(song, index) in artistSongLineupList" :key="song.id"
                                class="group flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#1B1B1E] border border-[#2D2D32]/80 hover:border-[#46464D] rounded-xl transition-all">
                                <div class="flex items-center gap-3 flex-1 min-w-0">
                                    <!-- Vertical Accent Bar -->
                                    <div class="w-1 h-5 rounded-full bg-[#D0D4F7] shrink-0"></div>

                                    <!-- Song Title Input -->
                                    <input type="text" v-model="song.title" placeholder="Enter song title"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-sm font-medium w-full" />
                                </div>

                                <!-- Duration & Remove Button -->
                                <div class="flex items-center gap-2 shrink-0">
                                    <input type="text" v-model="song.duration" placeholder="00:00"
                                        class="bg-transparent border-0 outline-none text-gray-400 hover:text-white focus:text-white placeholder-gray-600 text-xs font-mono text-right w-14" />
                                    <button type="button" @click="removeArtistSong(index)"
                                        class="flex text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                                        title="Remove song">
                                        <Icon name="ic:round-close" class="text-base" />
                                    </button>
                                </div>
                            </div>

                            <!-- Add song to setlist button -->
                            <button type="button" @click="addArtistSong"
                                class="group flex items-center justify-between w-full px-3.5 py-2.5 bg-[#1B1B1E]/60 hover:bg-[#1B1B1E] border border-[#2D2D32]/60 hover:border-[#46464D] rounded-xl text-gray-400 hover:text-white text-xs sm:text-sm font-medium transition-all cursor-pointer">
                                <span class="flex items-center gap-1.5">
                                    <span>+</span>
                                    <span>Add song to setlist</span>
                                </span>
                                <span class="text-base font-light text-gray-400 group-hover:text-white">+</span>
                            </button>
                        </div>

                        <!-- Preview of comma-separated string that will be sent to the database -->
                        <div v-if="formattedArtistSongLineup"
                            class="pt-1 text-[11px] text-gray-400 flex items-center gap-2 font-mono">
                            <span class="text-gray-500 shrink-0">DB Payload:</span>
                            <span class="text-[#D0D4F7]/90 truncate">"{{ formattedArtistSongLineup }}"</span>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                        <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">EQUIPMENT &amp;
                            TECHNICAL SETUP</span>
                        <textarea v-model="artistContractForm.equipment" rows="4"
                            class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full resize-none"
                            placeholder="Enter Required & Provided Equipment"></textarea>
                    </div>
                </div>

            </div>
        </div>

        <!-- Form 2 Artist Action Feedback -->
        <div v-if="artistActionFeedback"
            class="p-5 rounded-2xl border space-y-2 animate-in fade-in duration-200 max-w-5xl mx-auto mt-4 font-Sora"
            :class="artistActionFeedback.status === 'Accepted' ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' : 'bg-red-950/30 border-red-500/40 text-red-200'">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 font-semibold"
                    :class="artistActionFeedback.status === 'Accepted' ? 'text-emerald-300' : 'text-red-300'">
                    <Icon
                        :name="artistActionFeedback.status === 'Accepted' ? 'ic:round-check-circle' : 'ic:round-cancel'"
                        class="text-xl" />
                    <span>Contract {{ artistActionFeedback.status }} by Artist!</span>
                </div>
                <button @click="artistActionFeedback = null"
                    class="text-xs text-gray-400 hover:text-white cursor-pointer">
                    Dismiss
                </button>
            </div>
            <p class="text-xs text-gray-300">Action response recorded:</p>
            <pre
                class="bg-black/60 p-3 rounded-xl text-xs font-mono text-[#D0D4F7] overflow-x-auto">{{ JSON.stringify(artistActionFeedback, null, 2) }}</pre>
        </div>

        <!-- Business Job Listing Creation Form -->
        <div class="bg-[#131315] border border-[#2A2A2E]/60 rounded-2xl p-6 sm:p-8 max-w-5xl mx-auto mt-8 space-y-6">
            <div class="flex">
                <!-- Status Indicator -->
                <div v-if="isJobDraftSaving"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
                    <Icon name="ic:baseline-sync" class="animate-spin text-sm" />
                    <span>Saving draft...</span>
                </div>
                <div v-else-if="jobLastSavedTime"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono"
                    title="Draft saved automatically to local storage">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Draft saved {{ jobLastSavedTime }}</span>
                </div>
            </div>
            <!-- Header Section with Action Buttons -->
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 font-Sora">
                <div class="flex flex-col gap-1">
                    <h1 class="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-none">
                        {{ jobListingForm.jobId }}</h1><!--JB-[month-day-jobcount]-[YEAR]-->
                    <h2 class="text-sm sm:text-[16px] text-[#D0D4F7] font-medium tracking-wide">
                        BUSINESS JOB LISTING CREATION
                    </h2>
                </div>

                <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start sm:self-end">
                    <button type="button" @click="saveJobListingDraftManual"
                        class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-5 py-2.5 rounded-full border border-[#46464D] hover:bg-white/5 hover:border-gray-400 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                        <Icon v-if="isJobDraftSaving" name="ic:baseline-sync"
                            class="animate-spin text-sm text-[#D0D4F7]" />
                        <span>Save Draft</span>
                    </button>
                    <button type="button" @click="resetJobListingForm"
                        class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-5 py-2.5 rounded-full border border-[#46464D] hover:border-red-500/50 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer whitespace-nowrap">
                        Cancel Listing
                    </button>
                    <button type="button" @click="handleJobListingSubmit"
                        class="text-xs sm:text-sm font-bold text-[#131315] bg-[#D0D4F7] hover:bg-white px-6 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap shadow-sm">
                        Post Job Listing
                    </button>
                </div>
            </div>

            <div class="flex flex-col gap-6">
                <!-- Card 1: Posting Business Information -->
                <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 flex flex-col gap-5">
                    <div class="flex items-center gap-3">
                        <Icon name="ic:baseline-storefront" class="text-xl text-[#D0D4F7]" />
                        <h2 class="text-lg sm:text-xl font-Sora font-semibold text-white">Posting Business Information
                        </h2>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 font-Sora">
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUSINESS
                                ACCOUNT</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">{{
                                jobListingForm.businessName }}</p>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">POSTED BY
                                BUSINESS ID</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4] font-mono">{{
                                jobListingForm.businessId }}</p>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB ID</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#D0D4F7] font-mono">{{
                                jobListingForm.jobId }}</p>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">LISTING
                                STATUS</span>
                            <div class="flex items-center gap-2 mt-0.5">
                                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <p class="text-base sm:text-[18px] font-medium text-emerald-400">Open</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card 2: Gig & Event Details -->
                <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 flex flex-col gap-6">
                    <div class="flex items-center gap-3">
                        <Icon name="ic:baseline-campaign" class="text-xl text-[#D0D4F7]" />
                        <h2 class="text-lg sm:text-xl font-Sora font-semibold text-white">Gig &amp; Event Details</h2>
                    </div>

                    <!-- Row 1: Event Title & Venue Location -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 font-Sora">
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">
                                EVENT TITLE <span class="text-[#D0D4F7]">*</span>
                            </span>
                            <input type="text" v-model="jobListingForm.eventTitle"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full"
                                placeholder="e.g. Friday Acoustic Night, Lounge Weekend Trio" />
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">
                                VENUE LOCATION <span class="text-[#D0D4F7]">*</span>
                            </span>
                            <input type="text" v-model="jobListingForm.location"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full"
                                placeholder="e.g. Calle Z Cafe & Restobar, Panganiban Dr, Naga City" />
                        </div>
                    </div>

                    <!-- Row 2: Timing & Schedule -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 font-Sora">
                        <!-- Gig Date -->
<div class="grid grid-cols-2 gap-3">
                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START DATE</span>
                                <div class="relative flex items-center">
                                    <input type="date" v-model="contract1Form.startDate"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                        <Icon name="ic:baseline-calendar-month" class="text-xl" />
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END
                                    DATE</span>
                                <div class="relative flex items-center">
                                    <input type="date" v-model="contract1Form.endDate"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                        <Icon name="ic:baseline-calendar-month" class="text-xl" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Start Time & End Time -->
                        <div class="grid grid-cols-2 gap-3 sm:gap-4">
                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <div class="flex items-center justify-between">
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START TIME</span>
                                    <span v-if="jobListingForm.startTime" class="text-xs text-[#D0D4F7] font-medium">{{ formatTime12(jobListingForm.startTime) }}</span>
                                </div>
                                <div class="relative flex items-center">
                                    <input type="time" v-model="jobListingForm.startTime"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                                        <Icon name="ic:outline-access-time" class="text-lg" />
                                    </div>
                                </div>
                            </div>

                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <div class="flex items-center justify-between">
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END TIME</span>
                                    <span v-if="jobListingForm.endTime" class="text-xs text-[#D0D4F7] font-medium">{{ formatTime12(jobListingForm.endTime) }}</span>
                                </div>
                                <div class="relative flex items-center">
                                    <input type="time" v-model="jobListingForm.endTime"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                                        <Icon name="ic:outline-access-time" class="text-lg" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Divider -->
                    <hr class="border-[#2A2A2E]/70 my-1" />

                    <!-- Row 3: Description, Compensation & Requirements -->
                    <div class="flex flex-col gap-4 font-Sora">
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">
                                GIG DESCRIPTION &amp; REQUIREMENTS
                            </span>
                            <textarea v-model="jobListingForm.description" rows="4"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full resize-none"
                                placeholder="Enter gig details, required genre, compensation/budget, number of sets, equipment provided, perks (e.g. food/drinks), etc."></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Payload Preview Box for Testing -->
            <div v-if="lastSubmittedJobListing"
                class="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 text-emerald-200 animate-in fade-in duration-200 font-Sora">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 font-semibold text-emerald-300">
                        <Icon name="ic:round-check-circle" class="text-xl" />
                        <span>Job Listing Created &amp; Emitted Successfully!</span>
                    </div>
                    <button @click="lastSubmittedJobListing = null"
                        class="text-xs text-gray-400 hover:text-white cursor-pointer">
                        Dismiss
                    </button>
                </div>
                <p class="text-xs text-gray-300">Payload matching JOB_LISTING table schema:</p>
                <pre
                    class="bg-black/60 p-3 rounded-xl text-xs font-mono text-[#D0D4F7] overflow-x-auto">{{ JSON.stringify(lastSubmittedJobListing, null, 2) }}</pre>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import DirectBookingModal from '~/components/DirectBookingModal.vue'

// ====================================================
// Top Sandbox State
// ====================================================
const showModal = ref(false)
const activeFilter = ref('All')
const lastSubmittedBooking = ref<any>(null)

interface SongItem {
    id: string
    title: string
    duration: string
}

const mockBookings = ref([
    { id: '1', artistName: 'The Juans (Band)', status: 'Confirmed', date: '2026-10-15', time: '19:00 - 22:00', venue: 'Avenue Plaza Hotel' },
    { id: '2', artistName: 'Ahsoka (Solo)', status: 'Pending', date: '2026-09-28', time: '20:00 - 21:30', venue: 'Private Residence, Naga' },
    { id: '3', artistName: 'Sunset Trio', status: 'Cancelled', date: '2026-09-10', time: '18:00 - 20:00', venue: 'Calle Z Restobar' }
])

const handleBookingSubmit = (payload: any) => {
    lastSubmittedBooking.value = payload
    mockBookings.value.unshift({
        id: String(Date.now()),
        artistName: 'Ahsoka (Solo)',
        status: 'Pending',
        date: payload.eventDate,
        time: `${payload.startTime} - ${payload.endTime}`,
        venue: payload.venueLocation
    })
}

const statusBadgeClass = (status: string) => {
    switch (status) {
        case 'Confirmed': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        case 'Pending': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        case 'Cancelled': return 'bg-red-500/10 text-red-400 border border-red-500/20'
        default: return 'bg-gray-500/10 text-gray-400'
    }
}

// ====================================================
// FORM 1: Booking Contract Creation State & Auto-Save
// ====================================================
const CONTRACT1_DRAFT_KEY = 'tono_draft_booking_contract_creation'
const isContract1DraftSaving = ref(false)
const contract1LastSavedTime = ref('')
const lastSubmittedContract1 = ref<any>(null)

const contract1Form = ref({
    contractId: 'BK-121201-2026',
    businessName: 'Business Name',
    requesterName: 'User Account Name',
    artistName: 'Artist Name',
    jobId: 'FORM ID',
    bookingType: 'Direct Booking',
    venueLocation: '',
    startDate: '',
    endDate: '',
    startTime: '19:00',
    endTime: '22:00',
    description: '',
    requiredEquipment: ''
})

const contract1SongLineupList = ref<SongItem[]>([])

const addContract1Song = () => {
    contract1SongLineupList.value.push({
        id: String(Date.now()),
        title: '',
        duration: ''
    })
}

const removeContract1Song = (index: number) => {
    contract1SongLineupList.value.splice(index, 1)
}

const formattedContract1SongLineup = computed(() => {
    return contract1SongLineupList.value
        .map(song => {
            const title = song.title.trim()
            if (!title) return ''
            const duration = song.duration?.trim()
            return duration ? `${title} (${duration})` : title
        })
        .filter(Boolean)
        .join(', ')
})

let contract1SaveTimeout: ReturnType<typeof setTimeout> | null = null

const triggerContract1AutoSave = (immediate = false) => {
    isContract1DraftSaving.value = true
    if (contract1SaveTimeout) clearTimeout(contract1SaveTimeout)

    const performSave = () => {
        try {
            if (typeof window !== 'undefined') {
                const draft = {
                    ...contract1Form.value,
                    songLineupList: contract1SongLineupList.value,
                    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
                localStorage.setItem(CONTRACT1_DRAFT_KEY, JSON.stringify(draft))
                contract1LastSavedTime.value = draft.savedAt
            }
        } catch (e) {
            console.error('Failed to auto-save Form 1 draft:', e)
        } finally {
            isContract1DraftSaving.value = false
        }
    }

    if (immediate) {
        performSave()
    } else {
        contract1SaveTimeout = setTimeout(performSave, 600)
    }
}

const saveContract1DraftManual = () => {
    triggerContract1AutoSave(true)
}

const loadContract1Draft = () => {
    if (typeof window === 'undefined') return
    try {
        const raw = localStorage.getItem(CONTRACT1_DRAFT_KEY)
        if (raw) {
            const data = JSON.parse(raw)
            if (data.bookingType) contract1Form.value.bookingType = data.bookingType
            if (data.venueLocation) contract1Form.value.venueLocation = data.venueLocation
            if (data.startDate) contract1Form.value.startDate = data.startDate
            if (data.endDate) contract1Form.value.endDate = data.endDate
            if (data.startTime) contract1Form.value.startTime = data.startTime
            if (data.endTime) contract1Form.value.endTime = data.endTime
            if (data.description) contract1Form.value.description = data.description
            if (data.requiredEquipment) contract1Form.value.requiredEquipment = data.requiredEquipment
            if (Array.isArray(data.songLineupList)) contract1SongLineupList.value = data.songLineupList
            if (data.savedAt) contract1LastSavedTime.value = data.savedAt
        }
    } catch (e) {
        console.error('Failed to load Form 1 draft:', e)
    }
}

const resetContract1Form = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(CONTRACT1_DRAFT_KEY)
    }
    contract1LastSavedTime.value = ''
    contract1Form.value.venueLocation = ''
    contract1Form.value.startDate = ''
    contract1Form.value.endDate = ''
    contract1Form.value.startTime = '19:00'
    contract1Form.value.endTime = '22:00'
    contract1Form.value.description = ''
    contract1Form.value.requiredEquipment = ''
    contract1SongLineupList.value = []
    lastSubmittedContract1.value = null
}

const handleContract1Submit = () => {
    if (!contract1Form.value.venueLocation.trim()) {
        alert('Please enter a Venue address')
        return
    }

    const payload = {
        Contract_ID: contract1Form.value.contractId,
        Booking_Type: contract1Form.value.bookingType,
        Venue_Location: contract1Form.value.venueLocation.trim(),
        Start_Date: contract1Form.value.startDate || null,
        End_Date: contract1Form.value.endDate || null,
        Start_Time: contract1Form.value.startTime,
        End_Time: contract1Form.value.endTime,
        Description: contract1Form.value.description?.trim() || null,
        Equipment_Required: contract1Form.value.requiredEquipment?.trim() || null,
        Song_Lineup: formattedContract1SongLineup.value,
        Status: 'Pending',
        Created_at: new Date().toISOString()
    }

    lastSubmittedContract1.value = payload

    if (typeof window !== 'undefined') {
        localStorage.removeItem(CONTRACT1_DRAFT_KEY)
    }
    contract1LastSavedTime.value = ''
}

watch(
    [contract1Form, contract1SongLineupList],
    () => {
        triggerContract1AutoSave()
    },
    { deep: true }
)

// ====================================================
// FORM 2: Booking Contract Artist View State & Auto-Save
// ====================================================
const ARTIST_DRAFT_KEY = 'tono_draft_artist_contract_view'
const isArtistDraftSaving = ref(false)
const artistLastSavedTime = ref('')
const artistActionFeedback = ref<any>(null)

const artistContractForm = ref({
    contractId: 'BK-121201-2026',
    businessName: 'Business Name',
    requesterName: 'User Account Name',
    artistName: 'Artist Name',
    jobId: 'FORM ID',
    startDate: '2026-10-15',
    endDate: '2026-10-15',
    startTime: '19:00',
    endTime: '22:00',
    bookingType: 'Direct Booking',
    description: 'Live acoustic performance for private corporate event',
    equipment: '2 Microphones, Direct Box, Stage Monitor'
})

const artistSongLineupList = ref<SongItem[]>([
    { id: '1', title: 'Kathang Isip', duration: '04:12' },
    { id: '2', title: 'Leaves', duration: '03:45' }
])

const addArtistSong = () => {
    artistSongLineupList.value.push({
        id: String(Date.now()),
        title: '',
        duration: ''
    })
}

const removeArtistSong = (index: number) => {
    artistSongLineupList.value.splice(index, 1)
}

const formattedArtistSongLineup = computed(() => {
    return artistSongLineupList.value
        .map(song => {
            const title = song.title.trim()
            if (!title) return ''
            const duration = song.duration?.trim()
            return duration ? `${title} (${duration})` : title
        })
        .filter(Boolean)
        .join(', ')
})

let artistSaveTimeout: ReturnType<typeof setTimeout> | null = null

const triggerArtistAutoSave = (immediate = false) => {
    isArtistDraftSaving.value = true
    if (artistSaveTimeout) clearTimeout(artistSaveTimeout)

    const performSave = () => {
        try {
            if (typeof window !== 'undefined') {
                const draft = {
                    ...artistContractForm.value,
                    songLineupList: artistSongLineupList.value,
                    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
                localStorage.setItem(ARTIST_DRAFT_KEY, JSON.stringify(draft))
                artistLastSavedTime.value = draft.savedAt
            }
        } catch (e) {
            console.error('Failed to auto-save Form 2 draft:', e)
        } finally {
            isArtistDraftSaving.value = false
        }
    }

    if (immediate) {
        performSave()
    } else {
        artistSaveTimeout = setTimeout(performSave, 600)
    }
}

const saveArtistDraftManual = () => {
    triggerArtistAutoSave(true)
}

const loadArtistDraft = () => {
    if (typeof window === 'undefined') return
    try {
        const raw = localStorage.getItem(ARTIST_DRAFT_KEY)
        if (raw) {
            const data = JSON.parse(raw)
            if (data.startDate) artistContractForm.value.startDate = data.startDate
            if (data.endDate) artistContractForm.value.endDate = data.endDate
            if (data.startTime) artistContractForm.value.startTime = data.startTime
            if (data.endTime) artistContractForm.value.endTime = data.endTime
            if (data.equipment) artistContractForm.value.equipment = data.equipment
            if (Array.isArray(data.songLineupList)) artistSongLineupList.value = data.songLineupList
            if (data.savedAt) artistLastSavedTime.value = data.savedAt
        }
    } catch (e) {
        console.error('Failed to load Form 2 draft:', e)
    }
}

const handleArtistAccept = () => {
    artistActionFeedback.value = {
        status: 'Accepted',
        contractId: artistContractForm.value.contractId,
        startDate: artistContractForm.value.startDate,
        endDate: artistContractForm.value.endDate,
        time: `${artistContractForm.value.startTime} - ${artistContractForm.value.endTime}`,
        equipment: artistContractForm.value.equipment,
        songLineup: formattedArtistSongLineup.value,
        timestamp: new Date().toISOString()
    }
    if (typeof window !== 'undefined') {
        localStorage.removeItem(ARTIST_DRAFT_KEY)
    }
    artistLastSavedTime.value = ''
}

const handleArtistReject = () => {
    artistActionFeedback.value = {
        status: 'Rejected',
        contractId: artistContractForm.value.contractId,
        reason: 'Contract rejected by artist',
        timestamp: new Date().toISOString()
    }
    if (typeof window !== 'undefined') {
        localStorage.removeItem(ARTIST_DRAFT_KEY)
    }
    artistLastSavedTime.value = ''
}

watch(
    [artistContractForm, artistSongLineupList],
    () => {
        triggerArtistAutoSave()
    },
    { deep: true }
)

// ====================================================
// FORM 3: Business Job Listing Form State & Auto-Save
// ====================================================
const JOB_DRAFT_KEY = 'tono_draft_business_job_listing'
const isJobDraftSaving = ref(false)
const jobLastSavedTime = ref('')
const lastSubmittedJobListing = ref<any>(null)

// Format current date for job ID e.g. JB-092901-2026 (JB-[month-day-jobcount]-[YEAR])
const generateJobId = () => {
    const d = new Date()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const year = d.getFullYear()
    return `JB-${month}${day}01-${year}`
}

const jobListingForm = ref({
    jobId: generateJobId(),
    businessName: 'Calle Z Cafe & Restobar',
    businessId: 'BUS-092901-2026',
    eventTitle: '',
    location: '',
    date: '',
    startTime: '19:00',
    endTime: '22:00',
    description: ''
})

let jobSaveTimeout: ReturnType<typeof setTimeout> | null = null

const triggerJobAutoSave = (immediate = false) => {
    isJobDraftSaving.value = true
    if (jobSaveTimeout) clearTimeout(jobSaveTimeout)

    const performSave = () => {
        try {
            if (typeof window !== 'undefined') {
                const draft = {
                    ...jobListingForm.value,
                    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
                localStorage.setItem(JOB_DRAFT_KEY, JSON.stringify(draft))
                jobLastSavedTime.value = draft.savedAt
            }
        } catch (e) {
            console.error('Failed to auto-save Form 3 draft:', e)
        } finally {
            isJobDraftSaving.value = false
        }
    }

    if (immediate) {
        performSave()
    } else {
        jobSaveTimeout = setTimeout(performSave, 600)
    }
}

const saveJobListingDraftManual = () => {
    triggerJobAutoSave(true)
}

const loadJobDraft = () => {
    if (typeof window === 'undefined') return
    try {
        const raw = localStorage.getItem(JOB_DRAFT_KEY)
        if (raw) {
            const data = JSON.parse(raw)
            if (data.eventTitle) jobListingForm.value.eventTitle = data.eventTitle
            if (data.location) jobListingForm.value.location = data.location
            if (data.date) jobListingForm.value.date = data.date
            if (data.startTime) jobListingForm.value.startTime = data.startTime
            if (data.endTime) jobListingForm.value.endTime = data.endTime
            if (data.description) jobListingForm.value.description = data.description
            if (data.savedAt) jobLastSavedTime.value = data.savedAt
        }
    } catch (e) {
        console.error('Failed to load Form 3 draft:', e)
    }
}

const resetJobListingForm = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(JOB_DRAFT_KEY)
    }
    jobLastSavedTime.value = ''
    jobListingForm.value.eventTitle = ''
    jobListingForm.value.location = ''
    jobListingForm.value.date = ''
    jobListingForm.value.startTime = '19:00'
    jobListingForm.value.endTime = '22:00'
    jobListingForm.value.description = ''
    lastSubmittedJobListing.value = null
}

const handleJobListingSubmit = () => {
    if (!jobListingForm.value.eventTitle.trim()) {
        alert('Please enter an Event Title')
        return
    }
    if (!jobListingForm.value.location.trim()) {
        alert('Please enter a Venue Location')
        return
    }

    const payload = {
        Job_ID: jobListingForm.value.jobId,
        Posted_By_BUSINESS_ID: jobListingForm.value.businessId,
        Event_Title: jobListingForm.value.eventTitle.trim(),
        Date: jobListingForm.value.date || null,
        Time: (jobListingForm.value.startTime && jobListingForm.value.endTime)
            ? `${jobListingForm.value.startTime} - ${jobListingForm.value.endTime}`
            : jobListingForm.value.startTime || null,
        Location: jobListingForm.value.location.trim(),
        Description: jobListingForm.value.description?.trim() || null,
        Status: 'Open',
        Created_at: new Date().toISOString()
    }

    lastSubmittedJobListing.value = payload

    if (typeof window !== 'undefined') {
        localStorage.removeItem(JOB_DRAFT_KEY)
    }
    jobLastSavedTime.value = ''
}

watch(
    jobListingForm,
    () => {
        triggerJobAutoSave()
    },
    { deep: true }
)

// ====================================================
// Client Mount Lifecycle - Restore all drafts
// ====================================================
onMounted(() => {
    loadContract1Draft()
    loadArtistDraft()
    loadJobDraft()
})
</script>