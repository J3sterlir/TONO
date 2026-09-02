<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({ layout: 'admin' })

interface ArtistVerification {
    id: number
    name: string
    stageName: string
    email: string
    avatar: string
    role: string
    artistType: 'Solo' | 'Band'
    status: 'Pending' | 'Active' | 'Banned' | 'Rejected'
    joinDate: string
    appliedDate: string
    city: string
    barangay: string
    bio: string
    specialty: string
    genres: string[]
    instruments: string[]
    socialLinks: {
        facebook?: string
        instagram?: string
        youtube?: string
        spotify?: string
    }
}

const users = ref<ArtistVerification[]>([
    {
        id: 1,
        name: 'Elena Vance',
        stageName: 'Elena Vance',
        email: 'elena.vance@tono.music',
        avatar: 'https://placehold.co/100x100/332244/FFF?text=EV',
        role: 'Artist',
        artistType: 'Solo',
        status: 'Pending',
        joinDate: 'Oct 12, 2023',
        appliedDate: 'Oct 15, 2023',
        city: 'Cebu City',
        barangay: 'Mabolo',
        specialty: 'Lead Vocalist & Acoustic Guitarist',
        bio: 'Indie-folk singer-songwriter inspired by ambient storytelling and acoustic melodies. Actively producing original indie acoustics.',
        genres: ['Indie Folk', 'Acoustic', 'Dream Pop'],
        instruments: ['Vocals', 'Acoustic Guitar', 'Piano'],
        socialLinks: {
            spotify: 'https://spotify.com',
            instagram: 'https://instagram.com',
            youtube: 'https://youtube.com',
            facebook: 'https://facebook.com'
        }
    },
    {
        id: 2,
        name: 'Marcus Thorne',
        stageName: 'The Velvet Echo',
        email: 'm.thorne@sonicpulse.com',
        avatar: 'https://placehold.co/100x100/443322/FFF?text=MT',
        role: 'Artist',
        artistType: 'Band',
        status: 'Pending',
        joinDate: 'Nov 05, 2023',
        appliedDate: 'Nov 08, 2023',
        city: 'Quezon City',
        barangay: 'Diliman',
        specialty: 'Alternative Rock Ensemble',
        bio: '4-piece alternative rock band blending 90s shoegaze textures with modern post-punk energy.',
        genres: ['Alternative Rock', 'Post-Punk', 'Shoegaze'],
        instruments: ['Electric Guitar', 'Bass', 'Drums', 'Synthesizer'],
        socialLinks: {
            spotify: 'https://spotify.com',
            instagram: 'https://instagram.com',
            youtube: 'https://youtube.com'
        }
    },
    {
        id: 3,
        name: 'Julian Chen',
        stageName: 'Julian Chen',
        email: 'julian.chen@gmail.com',
        avatar: 'https://placehold.co/100x100/223344/FFF?text=JC',
        role: 'Artist',
        artistType: 'Solo',
        status: 'Banned',
        joinDate: 'Dec 20, 2023',
        appliedDate: 'Dec 22, 2023',
        city: 'Davao City',
        barangay: 'Poblacion',
        specialty: 'Neo-Soul & Keyboardist',
        bio: 'Session keyboardist and producer creating chill neo-soul beats and smooth jazz rhythms.',
        genres: ['Neo-Soul', 'Jazz', 'R&B'],
        instruments: ['Keyboard', 'Piano', 'Synthesizer'],
        socialLinks: {
            instagram: 'https://instagram.com',
            youtube: 'https://youtube.com'
        }
    },
    {
        id: 4,
        name: 'Sarah Jenkins',
        stageName: 'Sarah J',
        email: 'sarah.j@starlight.io',
        avatar: 'https://placehold.co/100x100/222/FFF?text=SJ',
        role: 'Artist',
        artistType: 'Solo',
        status: 'Active',
        joinDate: 'Jan 15, 2024',
        appliedDate: 'Jan 16, 2024',
        city: 'Makati City',
        barangay: 'Poblacion',
        specialty: 'Electronic Producer & Vocalist',
        bio: 'Electronic pop producer combining deep basslines with airy atmospheric vocal hooks.',
        genres: ['Electronic', 'Synthwave', 'Indie Pop'],
        instruments: ['Vocals', 'Synthesizer', 'Launchpad'],
        socialLinks: {
            spotify: 'https://spotify.com',
            instagram: 'https://instagram.com'
        }
    }
])

const selectedArtist = ref<ArtistVerification | null>(null)

const selectForReview = (artist: ArtistVerification) => {
    if (selectedArtist.value?.id === artist.id) {
        selectedArtist.value = null
    } else {
        selectedArtist.value = artist
    }
}

const closeReview = () => {
    selectedArtist.value = null
}

const approveArtist = (id: number) => {
    const user = users.value.find(u => u.id === id)
    if (user) {
        user.status = 'Active'
        if (selectedArtist.value?.id === id) {
            selectedArtist.value = { ...user }
        }
    }
}

const rejectArtist = (id: number) => {
    const user = users.value.find(u => u.id === id)
    if (user) {
        user.status = 'Rejected'
        if (selectedArtist.value?.id === id) {
            selectedArtist.value = { ...user }
        }
    }
}
</script>

<template>
    <div>
        <nav class="flex items-center px-16 h-20 border-b border-[#46464D] top-0 sticky backdrop-blur-3xl z-10">
            <h1 class="text-[#D0D4F7] text-[24px] font-medium">Welcome Back Admin!</h1>
        </nav>
        <main class="p-8 lg:p-16 flex flex-col gap-6">
            <div>
                <h1 class="font-semibold text-[40px]">User Verification</h1>
                <h1 class="font-light text-[16px] text-zinc-400">Review and verify user verification requests</h1>
            </div>
            <div>
                <h2 class="text-[16px] font-medium text-zinc-200">Queue</h2>
            </div>

            <!-- Main Content: Flexible row containing the table and the artist review card -->
            <div class="flex flex-col xl:flex-row gap-6 items-start w-full transition-all duration-300">
                <!-- Table Container: flex-1 ensures it resizes dynamically when card appears -->
                <div class="flex-1 min-w-0 w-full transition-all duration-300">
                    <div class="w-full overflow-hidden border border-zinc-800 rounded-xl bg-[#18181b]">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse">

                                <!-- Table Header -->
                                <thead class="bg-[#242426]">
                                    <tr>
                                        <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                            User Profile</th>
                                        <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                            Role</th>
                                        <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                            Account Status</th>
                                        <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                            Join Date</th>
                                        <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase text-right">
                                            Actions</th>
                                    </tr>
                                </thead>

                                <!-- Table Body -->
                                <tbody class="bg-[#18181b]">
                                    <tr v-for="user in users" :key="user.id"
                                        class="border-t border-zinc-800 transition-colors"
                                        :class="selectedArtist?.id === user.id ? 'bg-[#222228] border-l-4 border-l-[#D0D4F7]' : 'hover:bg-[#1f1f23]'">

                                        <!-- profile cell -->
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-4">
                                                <img :src="user.avatar" :alt="user.name"
                                                    class="w-12 h-12 rounded-lg object-cover shadow-sm shrink-0" />
                                                <div class="flex flex-col min-w-0">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-base font-medium text-zinc-100 truncate">{{ user.name }}</span>
                                                        <span v-if="user.artistType" class="px-1.5 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                                            {{ user.artistType }}
                                                        </span>
                                                    </div>
                                                    <span class="text-sm text-zinc-400 truncate">{{ user.email }}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <!-- role -->
                                        <td class="px-6 py-4">
                                            <span
                                                class="inline-flex items-center justify-center px-4 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/50 border border-zinc-700 rounded-full">
                                                {{ user.role }}
                                            </span>
                                        </td>

                                        <!-- Account Status -->
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-2 text-sm font-medium"
                                                :class="{
                                                    'text-amber-400': user.status === 'Pending',
                                                    'text-emerald-400': user.status === 'Active',
                                                    'text-rose-400': user.status === 'Banned' || user.status === 'Rejected'
                                                }">
                                                <!-- Status Dot -->
                                                <span class="w-2 h-2 rounded-full"
                                                    :class="{
                                                        'bg-amber-400': user.status === 'Pending',
                                                        'bg-emerald-400': user.status === 'Active',
                                                        'bg-rose-400': user.status === 'Banned' || user.status === 'Rejected'
                                                    }">
                                                </span>
                                                {{ user.status }}
                                            </div>
                                        </td>

                                        <!-- Join Date -->
                                        <td class="px-6 py-4 text-sm text-zinc-300 whitespace-nowrap">
                                            {{ user.joinDate }}
                                        </td>

                                        <!-- Actions -->
                                        <td class="px-6 py-4 text-right">
                                            <button 
                                                @click="selectForReview(user)"
                                                class="cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                                                :class="selectedArtist?.id === user.id
                                                    ? 'bg-[#D0D4F7] text-[#151A34] font-semibold shadow' 
                                                    : 'text-[#D0D4F7] hover:bg-[#D0D4F7]/10 underline underline-offset-4'">
                                                {{ selectedArtist?.id === user.id ? 'Reviewing' : 'Review' }}
                                            </button>
                                        </td>

                                    </tr>
                                </tbody>

                            </table>
                        </div>

                        <div class="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-[#18181b]">
                            <!-- Showing Results Text -->
                            <span class="text-sm text-zinc-300">
                                Showing 1 to {{ users.length }} of {{ users.length }} requests
                            </span>

                            <!-- Pagination Controls -->
                            <div class="flex items-center gap-2">

                                <!-- Previous Button (Disabled state) -->
                                <button
                                    class="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-800 text-zinc-600 cursor-not-allowed">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M15 19l-7-7 7-7"></path>
                                    </svg>
                                </button>

                                <!-- Active Page -->
                                <button
                                    class="flex items-center justify-center w-8 h-8 rounded-md bg-[#e2dcfc] text-zinc-900 font-semibold text-sm transition-colors hover:bg-indigo-200">
                                    1
                                </button>

                                <!-- Next Button (Disabled) -->
                                <button
                                    class="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-800 text-zinc-600 cursor-not-allowed">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7">
                                        </path>
                                    </svg>
                                </button>

                            </div>
                        </div>
                    </div>
                </div>

                <!-- Artist Review Card -->
                <Transition name="slide-card">
                    <aside 
                        v-if="selectedArtist" 
                        class="w-full xl:w-[420px] 2xl:w-[460px] shrink-0 bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl p-6 shadow-2xl sticky top-24 flex flex-col gap-5 text-zinc-200">
                        
                        <!-- Header -->
                        <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
                            <div class="flex items-center gap-2">
                                <Icon name="ic:outline-verified-user" class="text-2xl text-[#D0D4F7]" />
                                <div>
                                    <h2 class="text-lg font-bold text-white leading-tight">Artist Details</h2>
                                    <p class="text-xs text-zinc-400">Verification Request</p>
                                </div>
                            </div>
                            <button 
                                @click="closeReview"
                                class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Close review">
                                <Icon name="ic:baseline-close" class="text-xl" />
                            </button>
                        </div>

                        <!-- Artist Identity -->
                        <div class="flex items-start gap-4">
                            <img 
                                :src="selectedArtist.avatar" 
                                :alt="selectedArtist.name" 
                                class="w-16 h-16 rounded-xl object-cover border border-zinc-700 shadow-md shrink-0" 
                            />
                            <div class="flex flex-col min-w-0 flex-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="text-lg font-bold text-white truncate">{{ selectedArtist.stageName }}</h3>
                                    <span class="px-2 py-0.5 text-[11px] font-medium bg-[#D0D4F7]/20 text-[#D0D4F7] border border-[#D0D4F7]/30 rounded-full">
                                        {{ selectedArtist.artistType }}
                                    </span>
                                </div>
                                <span class="text-xs text-zinc-400 truncate">{{ selectedArtist.name }} • {{ selectedArtist.email }}</span>
                                <span v-if="selectedArtist.city" class="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                                    <Icon name="ic:outline-location-on" class="text-sm text-[#D0D4F7]" />
                                    {{ selectedArtist.barangay ? `${selectedArtist.barangay}, ` : '' }}{{ selectedArtist.city }}
                                </span>
                            </div>
                        </div>

                        <!-- Meta Info Grid -->
                        <div class="grid grid-cols-2 gap-2 p-3 bg-[#141416] rounded-lg border border-zinc-800/80 text-xs">
                            <div>
                                <span class="text-zinc-500 block mb-0.5 font-medium">Status</span>
                                <div class="flex items-center gap-1.5 font-medium"
                                    :class="{
                                        'text-amber-400': selectedArtist.status === 'Pending',
                                        'text-emerald-400': selectedArtist.status === 'Active',
                                        'text-rose-400': selectedArtist.status === 'Banned' || selectedArtist.status === 'Rejected'
                                    }">
                                    <span class="w-2 h-2 rounded-full"
                                        :class="{
                                            'bg-amber-400': selectedArtist.status === 'Pending',
                                            'bg-emerald-400': selectedArtist.status === 'Active',
                                            'bg-rose-400': selectedArtist.status === 'Banned' || selectedArtist.status === 'Rejected'
                                        }">
                                    </span>
                                    {{ selectedArtist.status }}
                                </div>
                            </div>
                            <div>
                                <span class="text-zinc-500 block mb-0.5 font-medium">Applied Date</span>
                                <span class="text-zinc-300 font-medium">{{ selectedArtist.appliedDate }}</span>
                            </div>
                        </div>

                        <!-- Specialty -->
                        <div v-if="selectedArtist.specialty" class="flex flex-col gap-1.5">
                            <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Specialty</span>
                            <p class="text-zinc-200 bg-[#18181b] px-3 py-2 rounded-lg border border-zinc-800 text-xs font-medium">
                                {{ selectedArtist.specialty }}
                            </p>
                        </div>

                        <!-- Bio -->
                        <div class="flex flex-col gap-1.5">
                            <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Artist Bio</span>
                            <p class="text-zinc-300 bg-[#18181b] p-3 rounded-lg border border-zinc-800 leading-relaxed text-xs max-h-24 overflow-y-auto scrollbar-hide">
                                {{ selectedArtist.bio || 'No bio provided.' }}
                            </p>
                        </div>

                        <!-- Genres & Instruments -->
                        <div class="flex flex-col gap-3">
                            <div v-if="selectedArtist.genres?.length">
                                <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px] block mb-1.5">Genres</span>
                                <div class="flex flex-wrap gap-1.5">
                                    <span 
                                        v-for="genre in selectedArtist.genres" 
                                        :key="genre"
                                        class="px-2.5 py-1 text-xs font-medium text-[#D0D4F7] bg-[#D0D4F7]/10 border border-[#D0D4F7]/20 rounded-md">
                                        {{ genre }}
                                    </span>
                                </div>
                            </div>

                            <div v-if="selectedArtist.instruments?.length">
                                <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px] block mb-1.5">Instruments</span>
                                <div class="flex flex-wrap gap-1.5">
                                    <span 
                                        v-for="inst in selectedArtist.instruments" 
                                        :key="inst"
                                        class="px-2.5 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/70 border border-zinc-700/60 rounded-md">
                                        {{ inst }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Social & External Links -->
                        <div v-if="selectedArtist.socialLinks && Object.values(selectedArtist.socialLinks).some(Boolean)">
                            <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px] block mb-1.5">Links & Profiles</span>
                            <div class="flex flex-wrap gap-2">
                                <a 
                                    v-if="selectedArtist.socialLinks.spotify" 
                                    :href="selectedArtist.socialLinks.spotify" 
                                    target="_blank"
                                    class="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-emerald-950/40 text-emerald-400 border border-zinc-800 hover:border-emerald-700/50 rounded-lg text-xs transition">
                                    <Icon name="ic:baseline-music-note" /> Spotify
                                </a>
                                <a 
                                    v-if="selectedArtist.socialLinks.instagram" 
                                    :href="selectedArtist.socialLinks.instagram" 
                                    target="_blank"
                                    class="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-pink-950/40 text-pink-400 border border-zinc-800 hover:border-pink-700/50 rounded-lg text-xs transition">
                                    <Icon name="ic:outline-camera-alt" /> Instagram
                                </a>
                                <a 
                                    v-if="selectedArtist.socialLinks.youtube" 
                                    :href="selectedArtist.socialLinks.youtube" 
                                    target="_blank"
                                    class="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-red-950/40 text-rose-400 border border-zinc-800 hover:border-rose-700/50 rounded-lg text-xs transition">
                                    <Icon name="ic:outline-smart-display" /> YouTube
                                </a>
                                <a 
                                    v-if="selectedArtist.socialLinks.facebook" 
                                    :href="selectedArtist.socialLinks.facebook" 
                                    target="_blank"
                                    class="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-blue-950/40 text-blue-400 border border-zinc-800 hover:border-blue-700/50 rounded-lg text-xs transition">
                                    <Icon name="ic:outline-facebook" /> Facebook
                                </a>
                            </div>
                        </div>

                        <!-- Verification Actions -->
                        <div class="pt-3 border-t border-zinc-800 flex gap-3 mt-auto">
                            <button 
                                @click="approveArtist(selectedArtist.id)"
                                class="flex-1 py-2.5 px-4 bg-[#D0D4F7] hover:bg-[#B0B4D7] text-[#121214] font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow">
                                <Icon name="ic:round-check-circle" class="text-base" />
                                Approve
                            </button>
                            <button 
                                @click="rejectArtist(selectedArtist.id)"
                                class="flex-1 py-2.5 px-4 bg-transparent hover:bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:border-rose-500 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer">
                                <Icon name="ic:baseline-cancel" class="text-base" />
                                Reject
                            </button>
                        </div>
                    </aside>
                </Transition>
            </div>

        </main>
    </div>
</template>

<style scoped>
.slide-card-enter-active,
.slide-card-leave-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-card-enter-from,
.slide-card-leave-to {
    opacity: 0;
    transform: translateX(20px);
}
</style>