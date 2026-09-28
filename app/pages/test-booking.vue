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
        <div class="bg-[#131315] border border-[#2A2A2E]/60 rounded-2xl p-6 sm:p-8 max-w-5xl mx-auto mt-8 space-y-6">

            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 font-Sora">
                <div class="flex flex-col gap-1">
                    <h1 class="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-none">
                        BK-121201-2026</h1><!--BK-[month-day-bookingcount]-[YEAR]-->
                    <h2 class="text-sm sm:text-[16px] text-[#D0D4F7] font-medium tracking-wide">ARTIST BOOKING CONTRACT
                    </h2>
                </div>

                <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start sm:self-end">
                    <button
                        class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-5 py-2.5 rounded-full border border-[#46464D] hover:border-red-500/50 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer whitespace-nowrap">
                        Cancel Booking
                    </button>
                    <button
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
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">Business Name</p>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">REQUESTER
                                ACCOUNT</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">User Account Name</p>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">ARTIST
                                ACCOUNT</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">Artist Name</p>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB ID</span>
                            <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">FORM ID</p>
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
                            <input type="text"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full"
                                placeholder="Enter Booking type" />
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">VENUE</span>
                            <input type="text"
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
                                    <input type="date"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                        <Icon name="ic:baseline-calendar-month" class="text-xl" />
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END DATE</span>
                                <div class="relative flex items-center">
                                    <input type="date"
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
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START TIME</span>
                                <div class="relative flex items-center">
                                    <input type="time"
                                        class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                    <div
                                        class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                                        <Icon name="ic:outline-access-time" class="text-lg" />
                                    </div>
                                </div>
                            </div>

                            <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END TIME</span>
                                <div class="relative flex items-center">
                                    <input type="time"
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
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BOOKING DESCRIPTION</span>
                            <textarea name="" id="" type="text"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full"
                                placeholder="Enter Gig Description"></textarea>
                        </div>
                        <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                            <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">EQUIPMENT &amp; TECHNICAL SETUP</span>
                            <textarea name="" id="" type="text"
                                class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full"
                                placeholder="Enter Required & Provided Equipment"></textarea>
                        </div>

                        <!-- Song Lineup Card -->
                        <div
                            class="flex flex-col gap-2.5 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                            <div class="flex items-center justify-between">
                                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">SONG
                                    LINEUP</span>
                                <span v-if="songLineupList.length" class="text-[11px] font-mono text-gray-400">
                                    {{ songLineupList.length }} {{ songLineupList.length === 1 ? 'song' : 'songs' }}
                                </span>
                            </div>

                            <!-- Song Lineup Items -->
                            <div class="space-y-2 font-Sora">
                                <div v-for="(song, index) in songLineupList" :key="song.id"
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
                                        <button type="button" @click="removeSong(index)"
                                            class="flex text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                                            title="Remove song">
                                            <Icon name="ic:round-close" class="text-base" />
                                        </button>
                                    </div>
                                </div>

                                <!-- Add song to setlist button -->
                                <button type="button" @click="addSong"
                                    class="group flex items-center justify-between w-full px-3.5 py-2.5 bg-[#1B1B1E]/60 hover:bg-[#1B1B1E] border border-[#2D2D32]/60 hover:border-[#46464D] rounded-xl text-gray-400 hover:text-white text-xs sm:text-sm font-medium transition-all cursor-pointer">
                                    <span class="flex items-center gap-1.5">
                                        <span>+</span>
                                        <span>Add song to setlist</span>
                                    </span>
                                    <span class="text-base font-light text-gray-400 group-hover:text-white">+</span>
                                </button>
                            </div>

                            <!-- Preview of comma-separated string that will be sent to the database -->
                            <div v-if="formattedSongLineup"
                                class="pt-1 text-[11px] text-gray-400 flex items-center gap-2 font-mono">
                                <span class="text-gray-500 shrink-0">DB Payload:</span>
                                <span class="text-[#D0D4F7]/90 truncate">"{{ formattedSongLineup }}"</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Booking Contract Artist View Modal -->
        <div class="bg-[#131315] border border-[#2A2A2E]/60 rounded-2xl p-6 sm:p-8 max-w-5xl mx-auto mt-8 space-y-6">
            <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4 font-Sora">
                <div class="flex flex-col gap-1">
                    <h1 class="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-none">
                        BK-121201-2026</h1><!--BK-[month-day-bookingcount]-[YEAR]-->
                    <h2 class="text-sm sm:text-[16px] text-[#D0D4F7] font-medium tracking-wide">ARTIST BOOKING CONTRACT
                    </h2>
                </div>

                <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start lg:self-end">
                    <button
                        class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-5 py-2.5 rounded-full border border-[#46464D] hover:bg-white/5 hover:border-gray-400 transition-all cursor-pointer whitespace-nowrap">
                        Save Draft
                    </button>
                    <button
                        class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-5 py-2.5 rounded-full border border-[#46464D] hover:border-red-500/50 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer whitespace-nowrap">
                        Reject Contract
                    </button>
                    <button
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
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">Business Name</p>
                            </span>

                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">REQUESTER
                                    ACCOUNT</h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">User Account Name</p>
                            </span>

                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">ARTIST ACCOUNT
                                </h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">Artist Name</p>
                            </span>

                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB ID</h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">FORM ID</p>
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
                                        <input type="date"
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
                                        <input type="date"
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
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START
                                        TIME</span>
                                    <div class="relative flex items-center">
                                        <input type="time"
                                            class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                                        <div
                                            class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                                            <Icon name="ic:outline-access-time" class="text-lg" />
                                        </div>
                                    </div>
                                </div>

                                <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END
                                        TIME</span>
                                    <div class="relative flex items-center">
                                        <input type="time"
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
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">BOOKING TYPE</p>
                            </span>

                            <span class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                                <h1 class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BOOKING
                                    DESCRIPTION</h1>
                                <p class="text-base sm:text-[18px] font-medium text-[#E5E1E4]">GIG DESCRIPTION</p>
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="flex flex-col gap-6 sm:flex-row">
                    <div class="flex flex-col gap-2.5 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">SONG LINEUP</span>
                        <span v-if="songLineupList.length" class="text-[11px] font-mono text-gray-400">
                            {{ songLineupList.length }} {{ songLineupList.length === 1 ? 'song' : 'songs' }}
                        </span>
                    </div>

                    <!-- Song Lineup Items -->
                    <div class="space-y-2 font-Sora">
                        <div v-for="(song, index) in songLineupList" :key="song.id"
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
                                <button type="button" @click="removeSong(index)"
                                    class="flex text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                                    title="Remove song">
                                    <Icon name="ic:round-close" class="text-base" />
                                </button>
                            </div>
                        </div>

                        <!-- Add song to setlist button -->
                        <button type="button" @click="addSong"
                            class="group flex items-center justify-between w-full px-3.5 py-2.5 bg-[#1B1B1E]/60 hover:bg-[#1B1B1E] border border-[#2D2D32]/60 hover:border-[#46464D] rounded-xl text-gray-400 hover:text-white text-xs sm:text-sm font-medium transition-all cursor-pointer">
                            <span class="flex items-center gap-1.5">
                                <span>+</span>
                                <span>Add song to setlist</span>
                            </span>
                            <span class="text-base font-light text-gray-400 group-hover:text-white">+</span>
                        </button>
                    </div>

                    <!-- Preview of comma-separated string that will be sent to the database -->
                    <div v-if="formattedSongLineup"
                        class="pt-1 text-[11px] text-gray-400 flex items-center gap-2 font-mono">
                        <span class="text-gray-500 shrink-0">DB Payload:</span>
                        <span class="text-[#D0D4F7]/90 truncate">"{{ formattedSongLineup }}"</span>
                    </div>
                </div>
                    <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                        <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">EQUIPMENT &amp;
                            TECHNICAL SETUP</span>
                        <textarea name="" id="" type="text"
                            class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-base font-medium w-full"
                            placeholder="Enter Required & Provided Equipment"></textarea>
                    </div>
                </div>

            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import DirectBookingModal from '~/components/DirectBookingModal.vue'

const showModal = ref(false)
const activeFilter = ref('All')
const lastSubmittedBooking = ref<any>(null)

interface SongItem {
    id: string
    title: string
    duration: string
}

const songLineupList = ref<SongItem[]>([

])

const addSong = () => {
    songLineupList.value.push({
        id: String(Date.now()),
        title: '',
        duration: ''
    })
}

const removeSong = (index: number) => {
    songLineupList.value.splice(index, 1)
}

// Formatted as comma-separated string for sending to the database
const formattedSongLineup = computed(() => {
    return songLineupList.value
        .map(song => {
            const title = song.title.trim()
            if (!title) return ''
            const duration = song.duration?.trim()
            return duration ? `${title} (${duration})` : title
        })
        .filter(Boolean)
        .join(', ')
})

const mockBookings = ref([
    { id: '1', artistName: 'The Juans (Band)', status: 'Confirmed', date: '2026-10-15', time: '19:00 - 22:00', venue: 'Avenue Plaza Hotel' },
    { id: '2', artistName: 'Ahsoka (Solo)', status: 'Pending', date: '2026-09-28', time: '20:00 - 21:30', venue: 'Private Residence, Naga' },
    { id: '3', artistName: 'Sunset Trio', status: 'Cancelled', date: '2026-09-10', time: '18:00 - 20:00', venue: 'Calle Z Restobar' }
])

const handleBookingSubmit = (payload: any) => {
    lastSubmittedBooking.value = payload
    // Also add to the mock list as Pending
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
</script>