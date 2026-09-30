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
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START
                                    DATE</span>
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
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START
                                        TIME</span>
                                    <span v-if="contract1Form.startTime" class="text-xs text-[#D0D4F7] font-medium">{{
                                        formatTime12(contract1Form.startTime) }}</span>
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
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END
                                        TIME</span>
                                    <span v-if="contract1Form.endTime" class="text-xs text-[#D0D4F7] font-medium">{{
                                        formatTime12(contract1Form.endTime) }}</span>
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
                                        <span
                                            class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START
                                            TIME</span>
                                        <span v-if="artistContractForm.startTime"
                                            class="text-xs text-[#D0D4F7] font-medium">{{
                                            formatTime12(artistContractForm.startTime) }}</span>
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
                                        <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END
                                            TIME</span>
                                        <span v-if="artistContractForm.endTime"
                                            class="text-xs text-[#D0D4F7] font-medium">{{
                                            formatTime12(artistContractForm.endTime) }}</span>
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
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START
                                    DATE</span>
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
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START
                                        TIME</span>
                                    <span v-if="jobListingForm.startTime" class="text-xs text-[#D0D4F7] font-medium">{{
                                        formatTime12(jobListingForm.startTime) }}</span>
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
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END
                                        TIME</span>
                                    <span v-if="jobListingForm.endTime" class="text-xs text-[#D0D4F7] font-medium">{{
                                        formatTime12(jobListingForm.endTime) }}</span>
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

            
            <!-- ==================================================== -->
            <!-- Notifications Panel Sandbox Component                -->
            <!-- ==================================================== -->
            <div class="w-full max-w-105 bg-[#1C1C1F] border border-[#2A2A2E] rounded-3xl shadow-2xl overflow-hidden font-Sora flex flex-col transition-all">
                <!-- Panel Header -->
                <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#2A2A2E]/60">
                    <div class="flex items-center gap-2.5">
                        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
                            Notifications
                        </h2>
                        <span v-if="unreadCount > 0" class="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#D0D4F7]/15 text-[#D0D4F7] border border-[#D0D4F7]/30">
                            {{ unreadCount }} new
                        </span>
                    </div>
                    <button
                        type="button"
                        @click="markAllAsRead"
                        class="text-xs font-medium text-[#D0D4F7] hover:text-white hover:underline transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        :disabled="unreadCount === 0">
                        Mark all as read
                    </button>
                </div>

                <!-- Filter Tabs: All vs Unread -->
                <div class="flex items-center gap-2 px-5 py-3 border-b border-[#2A2A2E]/40">
                    <button
                        type="button"
                        @click="notificationFilter = 'All'"
                        class="px-4 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5"
                        :class="notificationFilter === 'All' 
                            ? 'bg-[#D0D4F7]/20 border-[#D0D4F7]/50 text-[#D0D4F7] font-semibold shadow-sm' 
                            : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5'">
                        <span>All</span>
                        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10">{{ notificationsList.length }}</span>
                    </button>
                    <button
                        type="button"
                        @click="notificationFilter = 'Unread'"
                        class="px-4 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5"
                        :class="notificationFilter === 'Unread' 
                            ? 'bg-[#D0D4F7]/20 border-[#D0D4F7]/50 text-[#D0D4F7] font-semibold shadow-sm' 
                            : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5'">
                        <span>Unread</span>
                        <span v-if="unreadCount > 0" class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#D0D4F7]/30 text-[#D0D4F7] font-bold">{{ unreadCount }}</span>
                    </button>
                </div>

                <!-- Notifications Feed (Scrollable) -->
                <div class="flex flex-col gap-4 p-4 overflow-y-auto max-h-145 scrollbar-thin scrollbar-thumb-[#2A2A2E]">
                    <!-- Empty State -->
                    <div v-if="filteredNotifications.length === 0" class="py-12 text-center space-y-2">
                        <Icon name="ic:outline-notifications-off" class="text-3xl text-gray-500 mx-auto" />
                        <p class="text-sm font-semibold text-white">No notifications found</p>
                        <p class="text-xs text-gray-400">You're all caught up with your updates.</p>
                    </div>

                    <!-- SECTION 1: New Notifications -->
                    <div v-if="newNotifications.length > 0" class="space-y-2.5">
                        <div class="flex items-center justify-between px-1">
                            <span class="text-xs font-mono font-semibold uppercase tracking-wider text-gray-300">
                                New
                            </span>
                            <span class="text-[11px] font-mono text-gray-400">
                                {{ newNotifications.length }} updates
                            </span>
                        </div>

                        <div
                            v-for="item in newNotifications"
                            :key="item.id"
                            @click="item.isUnread = false"
                            class="flex items-start gap-3.5 p-3 rounded-2xl transition-all duration-200 group relative cursor-pointer"
                            :class="item.isUnread 
                                ? 'bg-[#222228] border border-[#3A3A42] hover:border-[#D0D4F7]/40 shadow-sm' 
                                : 'bg-[#18181B]/60 hover:bg-[#202024] border border-transparent hover:border-[#2A2A2E]'">
                            <!-- Avatar with Figma Corner Badge -->
                            <div class="w-12 h-12 shrink-0 relative">
                                <svg viewBox="0 0 63 63" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 shrink-0">
                                    <circle cx="31.5" cy="31.5" r="31.5" fill="#2E2E38"></circle>
                                    <text x="31.5" y="36" text-anchor="middle" font-size="14" fill="#8E8E9A" font-family="monospace" font-weight="bold">
                                        {{ item.avatarText || 'TONO' }}
                                    </text>

                                    <!-- Badge 1: Band Invite (Violet Gradient) -->
                                    <template v-if="item.svgType === 'band_invite'">
                                        <circle cx="50" cy="50" r="13" fill="url(#paint0_linear_band_invite)"></circle>
                                        <mask id="mask_band_invite" maskUnits="userSpaceOnUse" x="41" y="41" width="18" height="18">
                                            <rect x="41" y="41" width="18" height="18" fill="#D9D9D9"></rect>
                                        </mask>
                                        <g mask="url(#mask_band_invite)">
                                            <path d="M50.375 49.9605C50.7375 49.5605 51.0156 49.1043 51.2094 48.5918C51.4031 48.0793 51.5 47.548 51.5 46.998C51.5 46.448 51.4031 45.9168 51.2094 45.4043C51.0156 44.8918 50.7375 44.4355 50.375 44.0355C51.125 44.1355 51.75 44.4668 52.25 45.0293C52.75 45.5918 53 46.248 53 46.998C53 47.748 52.75 48.4043 52.25 48.9668C51.75 49.5293 51.125 49.8605 50.375 49.9605ZM54.5 55.998V53.748C54.5 53.298 54.4 52.8699 54.2 52.4637C54 52.0574 53.7375 51.698 53.4125 51.3855C54.05 51.6105 54.6406 51.9012 55.1844 52.2574C55.7281 52.6137 56 53.1105 56 53.748V55.998H54.5ZM56 50.748V49.248H54.5V47.748H56V46.248H57.5V47.748H59V49.248H57.5V50.748H56ZM44.8813 49.1168C44.2938 48.5293 44 47.823 44 46.998C44 46.173 44.2938 45.4668 44.8813 44.8793C45.4688 44.2918 46.175 43.998 47 43.998C47.825 43.998 48.5313 44.2918 49.1188 44.8793C49.7063 45.4668 50 46.173 50 46.998C50 47.823 49.7063 48.5293 49.1188 49.1168C48.5313 49.7043 47.825 49.998 47 49.998C46.175 49.998 45.4688 49.7043 44.8813 49.1168ZM41 55.998V53.898C41 53.473 41.1094 53.0824 41.3281 52.7262C41.5469 52.3699 41.8375 52.098 42.2 51.9105C42.975 51.523 43.7625 51.2324 44.5625 51.0387C45.3625 50.8449 46.175 50.748 47 50.748C47.825 50.748 48.6375 50.8449 49.4375 51.0387C50.2375 51.2324 51.025 51.523 51.8 51.9105C52.1625 52.098 52.4531 52.3699 52.6719 52.7262C52.8906 53.0824 53 53.473 53 53.898V55.998H41ZM47 48.498C47.4125 48.498 47.7656 48.3512 48.0594 48.0574C48.3531 47.7637 48.5 47.4105 48.5 46.998C48.5 46.5855 48.3531 46.2324 48.0594 45.9387C47.7656 45.6449 47.4125 45.498 47 45.498C46.5875 45.498 46.2344 45.6449 45.9406 45.9387C45.6469 46.2324 45.5 46.5855 45.5 46.998C45.5 47.4105 45.6469 47.7637 45.9406 48.0574C46.2344 48.3512 46.5875 48.498 47 48.498ZM42.5 54.498H51.5V53.898C51.5 53.7605 51.4656 53.6355 51.3969 53.523C51.3281 53.4105 51.2375 53.323 51.125 53.2605C50.45 52.923 49.7688 52.6699 49.0813 52.5012C48.3938 52.3324 47.7 52.248 47 52.248C46.3 52.248 45.6063 52.3324 44.9188 52.5012C44.2313 52.6699 43.55 52.923 42.875 53.2605C42.7625 53.323 42.6719 53.4105 42.6031 53.523C42.5344 53.6355 42.5 53.7605 42.5 53.898V54.498Z" fill="white"></path>
                                        </g>
                                    </template>

                                    <!-- Badge 2: Contract Cancelled (Red Gradient) -->
                                    <template v-else-if="item.svgType === 'contract_cancel'">
                                        <circle cx="50" cy="50" r="13" fill="url(#paint0_linear_contract_cancel)"></circle>
                                        <mask id="mask_contract_cancel" maskUnits="userSpaceOnUse" x="41" y="41" width="18" height="18">
                                            <rect x="41" y="41" width="18" height="18" fill="#D9D9D9"></rect>
                                        </mask>
                                        <g mask="url(#mask_contract_cancel)">
                                            <path d="M55.25 55.5688L53.6562 57.1437L52.6063 56.0938L54.1812 54.5L52.6063 52.9062L53.6562 51.8563L55.25 53.4312L56.8438 51.8563L57.8937 52.9062L56.3188 54.5L57.8937 56.0938L56.8438 57.1437L55.25 55.5688ZM45.5 57.5C44.875 57.5 44.3438 57.2813 43.9062 56.8438C43.4687 56.4062 43.25 55.875 43.25 55.25V53H45.5V42.5H56.75V50.2812C56.5125 50.1937 56.2687 50.1281 56.0187 50.0844C55.7687 50.0406 55.5125 50.0188 55.25 50.0188V44H47V53H51.0125C50.925 53.2375 50.8594 53.4813 50.8156 53.7313C50.7719 53.9813 50.75 54.2375 50.75 54.5H44.75V55.25C44.75 55.4625 44.8219 55.6406 44.9656 55.7844C45.1094 55.9281 45.2875 56 45.5 56H51.0125C51.1125 56.2875 51.2375 56.5563 51.3875 56.8063C51.5375 57.0563 51.7125 57.2875 51.9125 57.5H45.5ZM47.75 47.75V46.25H54.5V47.75H47.75ZM47.75 50V48.5H54.5V50H47.75Z" fill="white"></path>
                                        </g>
                                    </template>

                                    <!-- Badge 3: Schedule Update (Orange Gradient) -->
                                    <template v-else-if="item.svgType === 'schedule_update'">
                                        <circle cx="50" cy="50" r="13" fill="url(#paint0_linear_schedule_update)"></circle>
                                        <mask id="mask_schedule_update" maskUnits="userSpaceOnUse" x="41" y="41" width="18" height="18">
                                            <rect x="41" y="41" width="18" height="18" fill="#D9D9D9"></rect>
                                        </mask>
                                        <g mask="url(#mask_schedule_update)">
                                            <path d="M44.75 57.5C44.3375 57.5 43.9844 57.3531 43.6906 57.0594C43.3969 56.7656 43.25 56.4125 43.25 56V45.5C43.25 45.0875 43.3969 44.7344 43.6906 44.4406C43.9844 44.1469 44.3375 44 44.75 44H45.5V42.5H47V44H53V42.5H54.5V44H55.25C55.6625 44 56.0156 44.1469 56.3094 44.4406C56.6031 44.7344 56.75 45.0875 56.75 45.5V49.25H55.25V48.5H44.75V56H50V57.5H44.75ZM44.75 47H55.25V45.5H44.75V47ZM51.5 57.5V55.1938L55.6437 51.0688C55.7562 50.9563 55.8812 50.875 56.0187 50.825C56.1562 50.775 56.2938 50.75 56.4313 50.75C56.5813 50.75 56.725 50.7781 56.8625 50.8344C57 50.8906 57.125 50.975 57.2375 51.0875L57.9313 51.7812C58.0313 51.8938 58.1094 52.0187 58.1656 52.1562C58.2219 52.2938 58.25 52.4313 58.25 52.5688C58.25 52.7063 58.225 52.8469 58.175 52.9906C58.125 53.1344 58.0438 53.2625 57.9313 53.375L53.8062 57.5H51.5ZM52.625 56.375H53.3375L55.6063 54.0875L55.2687 53.7313L54.9125 53.3938L52.625 55.6625V56.375ZM55.2687 53.7313L54.9125 53.3938L55.6063 54.0875L55.2687 53.7313Z" fill="white"></path>
                                        </g>
                                    </template>

                                    <!-- Badge 4: Contract Offer (Violet Gradient) -->
                                    <template v-else-if="item.svgType === 'contract_offer'">
                                        <circle cx="50" cy="50" r="13" fill="url(#paint0_linear_contract_offer)"></circle>
                                        <mask id="mask_contract_offer" maskUnits="userSpaceOnUse" x="41" y="41" width="18" height="18">
                                            <rect x="41" y="41" width="18" height="18" fill="#D9D9D9"></rect>
                                        </mask>
                                        <g mask="url(#mask_contract_offer)">
                                            <path d="M47.75 47.75V46.25H54.5V47.75H47.75ZM47.75 50V48.5H54.5V50H47.75ZM50 57.5H45.5C44.875 57.5 44.3438 57.2813 43.9062 56.8438C43.4687 56.4062 43.25 55.875 43.25 55.25V53H45.5V42.5H56.75V49.2688C56.5 49.2438 56.2469 49.2531 55.9906 49.2969C55.7344 49.3406 55.4875 49.4187 55.25 49.5312V44H47V53H51.5L50 54.5H44.75V55.25C44.75 55.4625 44.8219 55.6406 44.9656 55.7844C45.1094 55.9281 45.2875 56 45.5 56H50V57.5ZM51.5 57.5V55.1938L55.6437 51.0688C55.7562 50.9563 55.8812 50.875 56.0187 50.825C56.1562 50.775 56.2938 50.75 56.4313 50.75C56.5813 50.75 56.725 50.7781 56.8625 50.8344C57 50.8906 57.125 50.975 57.2375 51.0875L57.9313 51.7812C58.0313 51.8938 58.1094 52.0187 58.1656 52.1562C58.2219 52.2938 58.25 52.4313 58.25 52.5688C58.25 52.7063 58.225 52.8469 58.175 52.9906C58.125 53.1344 58.0438 53.2625 57.9313 53.375L53.8062 57.5H51.5ZM52.625 56.375H53.3375L55.6063 54.0875L55.2687 53.7313L54.9125 53.3938L52.625 55.6625V56.375ZM55.2687 53.7313L54.9125 53.3938L55.6063 54.0875L55.2687 53.7313Z" fill="white"></path>
                                        </g>
                                    </template>

                                    <!-- Badge 5: Job Posted (Violet Gradient) -->
                                    <template v-else-if="item.svgType === 'job_posted'">
                                        <circle cx="50" cy="50" r="13" fill="url(#paint0_linear_job_posted)"></circle>
                                        <mask id="mask_job_posted" maskUnits="userSpaceOnUse" x="41" y="41" width="18" height="18">
                                            <rect x="41" y="41" width="18" height="18" fill="#D9D9D9"></rect>
                                        </mask>
                                        <g mask="url(#mask_job_posted)">
                                            <path d="M53.75 57.5V55.25H51.5V53.75H53.75V51.5H55.25V53.75H57.5V55.25H55.25V57.5H53.75ZM44.75 56C44.3375 56 43.9844 55.8531 43.6906 55.5594C43.3969 55.2656 43.25 54.9125 43.25 54.5V45.5C43.25 45.0875 43.3969 44.7344 43.6906 44.4406C43.9844 44 44.75 44 44.75 44H45.5V42.5H47V44H51.5V42.5H53V44H53.75C54.1625 44 54.5156 44.1469 54.8094 44.4406C55.1031 44.7344 55.25 45.0875 55.25 45.5V50.075C55 50.0375 54.75 50.0188 54.5 50.0188C54.25 50.0188 54 50.0375 53.75 50.075V48.5H44.75V54.5H50C50 54.75 50.0187 55 50.0562 55.25C50.0937 55.5 50.1625 55.75 50.2625 56H44.75ZM44.75 47H53.75V45.5H44.75V47Z" fill="white"></path>
                                        </g>
                                    </template>

                                    <!-- Badge 6: Booking Cancelled (Red Gradient) -->
                                    <template v-else-if="item.svgType === 'booking_cancel'">
                                        <circle cx="50" cy="50" r="13" fill="url(#paint0_linear_booking_cancel)"></circle>
                                        <mask id="mask_booking_cancel" maskUnits="userSpaceOnUse" x="41" y="41" width="18" height="18">
                                            <rect x="41" y="41" width="18" height="18" fill="#D9D9D9"></rect>
                                        </mask>
                                        <g mask="url(#mask_booking_cancel)">
                                            <path d="M47.3 53.75L50 51.05L52.7 53.75L53.75 52.7L51.05 50L53.75 47.3L52.7 46.25L50 48.95L47.3 46.25L46.25 47.3L48.95 50L46.25 52.7L47.3 53.75ZM44.75 56.75C44.3375 56.75 43.9844 56.6031 43.6906 56.3094C43.3969 56.0156 43.25 55.6625 43.25 55.25V44.75C43.25 44.3375 43.3969 43.9844 43.6906 43.6906C43.9844 43.3969 44.3375 43.25 44.75 43.25H55.25C55.6625 43.25 56.0156 43.3969 56.3094 43.6906C56.6031 43.9844 56.75 44.3375 56.75 44.75V55.25C56.75 55.6625 56.6031 56.0156 56.3094 56.3094C56.0156 56.6031 55.6625 56.75 55.25 56.75H44.75ZM44.75 55.25H55.25V44.75H44.75V55.25Z" fill="white"></path>
                                        </g>
                                    </template>

                                    <!-- Gradients Definition -->
                                    <defs>
                                        <linearGradient id="paint0_linear_band_invite" x1="50" y1="37" x2="50" y2="63" gradientUnits="userSpaceOnUse">
                                            <stop stop-color="#585F9C"></stop>
                                            <stop offset="1" stop-color="#D0D4F7"></stop>
                                        </linearGradient>
                                        <linearGradient id="paint0_linear_contract_cancel" x1="50" y1="37" x2="50" y2="63" gradientUnits="userSpaceOnUse">
                                            <stop stop-color="#FF282C"></stop>
                                            <stop offset="1" stop-color="#D0D4F7"></stop>
                                        </linearGradient>
                                        <linearGradient id="paint0_linear_schedule_update" x1="50" y1="37" x2="50" y2="63" gradientUnits="userSpaceOnUse">
                                            <stop stop-color="#FF8800"></stop>
                                            <stop offset="1" stop-color="#D0D4F7"></stop>
                                        </linearGradient>
                                        <linearGradient id="paint0_linear_contract_offer" x1="50" y1="37" x2="50" y2="63" gradientUnits="userSpaceOnUse">
                                            <stop stop-color="#585F9C"></stop>
                                            <stop offset="1" stop-color="#D0D4F7"></stop>
                                        </linearGradient>
                                        <linearGradient id="paint0_linear_job_posted" x1="50" y1="37" x2="50" y2="63" gradientUnits="userSpaceOnUse">
                                            <stop stop-color="#585F9C"></stop>
                                            <stop offset="1" stop-color="#D0D4F7"></stop>
                                        </linearGradient>
                                        <linearGradient id="paint0_linear_booking_cancel" x1="50" y1="37" x2="50" y2="63" gradientUnits="userSpaceOnUse">
                                            <stop stop-color="#FF282C"></stop>
                                            <stop offset="1" stop-color="#D0D4F7"></stop>
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>

                            <!-- Content Details -->
                            <div class="flex-1 min-w-0 space-y-1">
                                <div class="flex items-start justify-between gap-2">
                                    <p class="text-sm font-medium text-white leading-snug">
                                        {{ item.title }}
                                    </p>
                                    <span v-if="item.isUnread" class="w-2 h-2 rounded-full bg-[#D0D4F7] shadow-[0_0_8px_#D0D4F7] shrink-0 mt-1"></span>
                                </div>
                                <p v-if="item.subtitle" class="text-xs text-gray-400 leading-relaxed line-clamp-2">
                                    {{ item.subtitle }}
                                </p>
                                <span class="text-[11px] text-gray-400 font-mono block pt-0.5">
                                    {{ item.time }}
                                </span>

                                <!-- Action Buttons (Accept / Decline, Review, etc.) -->
                                <div v-if="item.hasActions" class="flex items-center gap-2 pt-1.5">
                                    <button
                                        v-if="item.actionPrimary"
                                        type="button"
                                        @click.stop="handleNotificationAction(item, 'primary')"
                                        class="px-3.5 py-1 rounded-lg text-xs font-semibold bg-[#D0D4F7]/20 hover:bg-[#D0D4F7]/30 border border-[#D0D4F7]/40 text-[#D0D4F7] transition-all cursor-pointer shadow-sm active:scale-95">
                                        {{ item.actionPrimary }}
                                    </button>
                                    <button
                                        v-if="item.actionSecondary"
                                        type="button"
                                        @click.stop="handleNotificationAction(item, 'secondary')"
                                        class="px-3 py-1 rounded-lg text-xs font-medium bg-[#2A2A2E] hover:bg-[#38383E] text-gray-300 hover:text-white transition-all cursor-pointer active:scale-95">
                                        {{ item.actionSecondary }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECTION 2: Earlier Notifications -->
                    <div v-if="earlierNotifications.length > 0" class="space-y-2.5 pt-1">
                        <div class="flex items-center justify-between px-1">
                            <span class="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">
                                Earlier
                            </span>
                            <span class="text-[11px] font-mono text-gray-400">
                                {{ earlierNotifications.length }} items
                            </span>
                        </div>

                        <div
                            v-for="item in earlierNotifications"
                            :key="item.id"
                            @click="item.isUnread = false"
                            class="flex items-start gap-3.5 p-3 rounded-2xl transition-all duration-200 group relative cursor-pointer"
                            :class="item.isUnread 
                                ? 'bg-[#222228] border border-[#3A3A42] hover:border-[#D0D4F7]/40 shadow-sm' 
                                : 'bg-[#18181B]/60 hover:bg-[#202024] border border-transparent hover:border-[#2A2A2E]'">
                            <!-- Avatar with Figma Corner Badge -->
                            <div class="w-12 h-12 shrink-0 relative">
                                <svg viewBox="0 0 63 63" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 shrink-0">
                                    <circle cx="31.5" cy="31.5" r="31.5" fill="#2E2E38"></circle>
                                    <text x="31.5" y="36" text-anchor="middle" font-size="14" fill="#8E8E9A" font-family="monospace" font-weight="bold">
                                        {{ item.avatarText || 'TONO' }}
                                    </text>

                                    <!-- Badge: Schedule Update (Orange Gradient) -->
                                    <template v-if="item.svgType === 'schedule_update'">
                                        <circle cx="50" cy="50" r="13" fill="url(#paint0_linear_schedule_update)"></circle>
                                        <mask id="mask_schedule_update_earlier" maskUnits="userSpaceOnUse" x="41" y="41" width="18" height="18">
                                            <rect x="41" y="41" width="18" height="18" fill="#D9D9D9"></rect>
                                        </mask>
                                        <g mask="url(#mask_schedule_update_earlier)">
                                            <path d="M44.75 57.5C44.3375 57.5 43.9844 57.3531 43.6906 57.0594C43.3969 56.7656 43.25 56.4125 43.25 56V45.5C43.25 45.0875 43.3969 44.7344 43.6906 44.4406C43.9844 44.1469 44.3375 44 44.75 44H45.5V42.5H47V44H53V42.5H54.5V44H55.25C55.6625 44 56.0156 44.1469 56.3094 44.4406C56.6031 44.7344 56.75 45.0875 56.75 45.5V49.25H55.25V48.5H44.75V56H50V57.5H44.75ZM44.75 47H55.25V45.5H44.75V47ZM51.5 57.5V55.1938L55.6437 51.0688C55.7562 50.9563 55.8812 50.875 56.0187 50.825C56.1562 50.775 56.2938 50.75 56.4313 50.75C56.5813 50.75 56.725 50.7781 56.8625 50.8344C57 50.8906 57.125 50.975 57.2375 51.0875L57.9313 51.7812C58.0313 51.8938 58.1094 52.0187 58.1656 52.1562C58.2219 52.2938 58.25 52.4313 58.25 52.5688C58.25 52.7063 58.225 52.8469 58.175 52.9906C58.125 53.1344 58.0438 53.2625 57.9313 53.375L53.8062 57.5H51.5ZM52.625 56.375H53.3375L55.6063 54.0875L55.2687 53.7313L54.9125 53.3938L52.625 55.6625V56.375ZM55.2687 53.7313L54.9125 53.3938L55.6063 54.0875L55.2687 53.7313Z" fill="white"></path>
                                        </g>
                                    </template>

                                    <!-- Badge: Job Posted (Violet Gradient) -->
                                    <template v-else-if="item.svgType === 'job_posted'">
                                        <circle cx="50" cy="50" r="13" fill="url(#paint0_linear_job_posted)"></circle>
                                        <mask id="mask_job_posted_earlier" maskUnits="userSpaceOnUse" x="41" y="41" width="18" height="18">
                                            <rect x="41" y="41" width="18" height="18" fill="#D9D9D9"></rect>
                                        </mask>
                                        <g mask="url(#mask_job_posted_earlier)">
                                            <path d="M53.75 57.5V55.25H51.5V53.75H53.75V51.5H55.25V53.75H57.5V55.25H55.25V57.5H53.75ZM44.75 56C44.3375 56 43.9844 55.8531 43.6906 55.5594C43.3969 55.2656 43.25 54.9125 43.25 54.5V45.5C43.25 45.0875 43.3969 44.7344 43.6906 44.4406C43.9844 44 44.75 44 44.75 44H45.5V42.5H47V44H51.5V42.5H53V44H53.75C54.1625 44 54.5156 44.1469 54.8094 44.4406C55.1031 44.7344 55.25 45.0875 55.25 45.5V50.075C55 50.0375 54.75 50.0188 54.5 50.0188C54.25 50.0188 54 50.0375 53.75 50.075V48.5H44.75V54.5H50C50 54.75 50.0187 55 50.0562 55.25C50.0937 55.5 50.1625 55.75 50.2625 56H44.75ZM44.75 47H53.75V45.5H44.75V47Z" fill="white"></path>
                                        </g>
                                    </template>

                                    <!-- Badge: Booking Cancelled (Red Gradient) -->
                                    <template v-else-if="item.svgType === 'booking_cancel'">
                                        <circle cx="50" cy="50" r="13" fill="url(#paint0_linear_booking_cancel)"></circle>
                                        <mask id="mask_booking_cancel_earlier" maskUnits="userSpaceOnUse" x="41" y="41" width="18" height="18">
                                            <rect x="41" y="41" width="18" height="18" fill="#D9D9D9"></rect>
                                        </mask>
                                        <g mask="url(#mask_booking_cancel_earlier)">
                                            <path d="M47.3 53.75L50 51.05L52.7 53.75L53.75 52.7L51.05 50L53.75 47.3L52.7 46.25L50 48.95L47.3 46.25L46.25 47.3L48.95 50L46.25 52.7L47.3 53.75ZM44.75 56.75C44.3375 56.75 43.9844 56.6031 43.6906 56.3094C43.3969 56.0156 43.25 55.6625 43.25 55.25V44.75C43.25 44.3375 43.3969 43.9844 43.6906 43.6906C43.9844 43.3969 44.3375 43.25 44.75 43.25H55.25C55.6625 43.25 56.0156 43.3969 56.3094 43.6906C56.6031 43.9844 56.75 44.3375 56.75 44.75V55.25C56.75 55.6625 56.6031 56.0156 56.3094 56.3094C56.0156 56.6031 55.6625 56.75 55.25 56.75H44.75ZM44.75 55.25H55.25V44.75H44.75V55.25Z" fill="white"></path>
                                        </g>
                                    </template>
                                </svg>
                            </div>

                            <!-- Content Details -->
                            <div class="flex-1 min-w-0 space-y-1">
                                <div class="flex items-start justify-between gap-2">
                                    <p class="text-sm font-medium text-white leading-snug">
                                        {{ item.title }}
                                    </p>
                                    <span v-if="item.isUnread" class="w-2 h-2 rounded-full bg-[#D0D4F7] shadow-[0_0_8px_#D0D4F7] shrink-0 mt-1"></span>
                                </div>
                                <p v-if="item.subtitle" class="text-xs text-gray-400 leading-relaxed line-clamp-2">
                                    {{ item.subtitle }}
                                </p>
                                <span class="text-[11px] text-gray-400 font-mono block pt-0.5">
                                    {{ item.time }}
                                </span>

                                <!-- Action Button -->
                                <div v-if="item.hasActions" class="flex items-center gap-2 pt-1.5">
                                    <button
                                        v-if="item.actionPrimary"
                                        type="button"
                                        @click.stop="handleNotificationAction(item, 'primary')"
                                        class="px-3.5 py-1 rounded-lg text-xs font-semibold bg-[#D0D4F7]/20 hover:bg-[#D0D4F7]/30 border border-[#D0D4F7]/40 text-[#D0D4F7] transition-all cursor-pointer shadow-sm active:scale-95">
                                        {{ item.actionPrimary }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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

// ====================================================
// Notification Panel Sandbox State
// ====================================================
const notificationFilter = ref<'All' | 'Unread'>('All')

interface NotificationItem {
    id: string
    title: string
    subtitle?: string
    time: string
    isUnread: boolean
    category: 'new' | 'earlier'
    type: string
    svgType: string
    avatarText?: string
    hasActions?: boolean
    actionPrimary?: string
    actionSecondary?: string
}

const notificationsList = ref<NotificationItem[]>([
    {
        id: 'n1',
        title: 'The Metro Groove invited you to join Band',
        subtitle: 'Invited as Lead Guitarist for upcoming showcase',
        time: '1hr ago',
        isUnread: true,
        category: 'new',
        type: 'band_invite',
        svgType: 'band_invite',
        avatarText: 'MG',
        hasActions: true,
        actionPrimary: 'Accept',
        actionSecondary: 'Decline'
    },
    {
        id: 'n2',
        title: 'Contract BK-093002-2026 was cancelled',
        subtitle: 'Skyline Lounge cancelled gig due to venue maintenance',
        time: '2hr ago',
        isUnread: true,
        category: 'new',
        type: 'contract_cancel',
        svgType: 'contract_cancel',
        avatarText: 'SL'
    },
    {
        id: 'n3',
        title: 'Schedule updated for "Acoustic Weekend"',
        subtitle: 'Performance moved to 8:30 PM by Avenue Plaza',
        time: '3hr ago',
        isUnread: true,
        category: 'new',
        type: 'schedule_update',
        svgType: 'schedule_update',
        avatarText: 'AP',
        hasActions: true,
        actionPrimary: 'View Schedule'
    },
    {
        id: 'n4',
        title: 'Contract Offer received from Avenue Plaza',
        subtitle: 'Review contract BK-093001-2026 and customize your setlist',
        time: '5hr ago',
        isUnread: false,
        category: 'new',
        type: 'contract_offer',
        svgType: 'contract_offer',
        avatarText: 'AP',
        hasActions: true,
        actionPrimary: 'Review Contract'
    },
    {
        id: 'n5',
        title: 'New Casting Call: Calle Z Restobar',
        subtitle: 'Open gig listing for Indie/Alternative (₱10,000 budget)',
        time: '1d ago',
        isUnread: false,
        category: 'earlier',
        type: 'job_posted',
        svgType: 'job_posted',
        avatarText: 'CZ',
        hasActions: true,
        actionPrimary: 'View Job'
    },
    {
        id: 'n6',
        title: 'Venue details updated for "Summer Jam"',
        subtitle: 'Soundcheck time confirmed for 5:00 PM at Main Stage',
        time: '2d ago',
        isUnread: false,
        category: 'earlier',
        type: 'schedule_update',
        svgType: 'schedule_update',
        avatarText: 'SJ'
    },
    {
        id: 'n7',
        title: 'Direct booking request withdrawn',
        subtitle: 'Requester withdrew request for Oct 12 performance',
        time: '3d ago',
        isUnread: false,
        category: 'earlier',
        type: 'booking_cancel',
        svgType: 'booking_cancel',
        avatarText: 'DB'
    }
])

const markAllAsRead = () => {
    notificationsList.value.forEach(item => {
        item.isUnread = false
    })
}

const unreadCount = computed(() => notificationsList.value.filter(n => n.isUnread).length)

const filteredNotifications = computed(() => {
    if (notificationFilter.value === 'Unread') {
        return notificationsList.value.filter(n => n.isUnread)
    }
    return notificationsList.value
})

const newNotifications = computed(() => filteredNotifications.value.filter(n => n.category === 'new'))
const earlierNotifications = computed(() => filteredNotifications.value.filter(n => n.category === 'earlier'))

const handleNotificationAction = (item: NotificationItem, actionType: 'primary' | 'secondary') => {
    item.isUnread = false
    if (actionType === 'primary') {
        if (item.actionPrimary === 'Accept') {
            item.hasActions = false
            item.subtitle = '✓ Invitation accepted! Welcome to the band.'
        } else if (item.actionPrimary === 'Review Contract') {
            item.subtitle = 'Opening contract review modal...'
        }
    } else {
        if (item.actionSecondary === 'Decline') {
            item.hasActions = false
            item.subtitle = 'Invitation declined.'
        }
    }
}

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
