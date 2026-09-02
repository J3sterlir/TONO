<script setup lang="ts">
import { ref, computed } from 'vue'

const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()

const handleLogout = async () => {
    await signOutAdmin()
}

// Admin profile
const adminProfile = await fetchCurrentAdmin()
definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

interface TagItem {
    id: number
    name: string
    active: boolean
    type: 'Genre' | 'Instrument'
}

let nextTagId = 1
const generateId = () => nextTagId++

// Active Genres & Instruments
const genres = ref<TagItem[]>([
    'Indie Folk', 'Alternative Rock', 'Neo-Soul', 'Electronic', 'Synthwave', 
    'Pop', 'Jazz', 'Shoegaze', 'R&B', 'Post-Punk'
].map(name => ({ id: generateId(), name, active: true, type: 'Genre' })))

const instruments = ref<TagItem[]>([
    'Vocals', 'Acoustic Guitar', 'Electric Guitar', 'Bass Guitar', 'Drums', 
    'Piano', 'Synthesizer', 'Keyboard', 'Launchpad', 'Saxophone'
].map(name => ({ id: generateId(), name, active: true, type: 'Instrument' })))

// Modal State
const showModal = ref(false)
const modalType = ref<'add' | 'edit' | 'delete'>('add')
const targetTagType = ref<'Genre' | 'Instrument'>('Genre')
const editingTag = ref<TagItem | null>(null)

// Form State
const formTagName = ref('')
const formTagActive = ref(true)

// Search State
const genreSearch = ref('')
const instrumentSearch = ref('')

const filteredGenres = computed(() => {
    if (!genreSearch.value) return genres.value
    const lower = genreSearch.value.toLowerCase()
    return genres.value.filter(g => g.name.toLowerCase().includes(lower))
})

const filteredInstruments = computed(() => {
    if (!instrumentSearch.value) return instruments.value
    const lower = instrumentSearch.value.toLowerCase()
    return instruments.value.filter(i => i.name.toLowerCase().includes(lower))
})

// Computed Counts
const activeGenresCount = computed(() => genres.value.filter(g => g.active).length)
const inactiveGenresCount = computed(() => genres.value.filter(g => !g.active).length)
const activeInstrumentsCount = computed(() => instruments.value.filter(i => i.active).length)
const inactiveInstrumentsCount = computed(() => instruments.value.filter(i => !i.active).length)

// Modal Actions
const openAddModal = (type: 'Genre' | 'Instrument') => {
    targetTagType.value = type
    modalType.value = 'add'
    formTagName.value = ''
    formTagActive.value = true
    showModal.value = true
}

const openEditModal = (tag: TagItem) => {
    editingTag.value = tag
    targetTagType.value = tag.type
    modalType.value = 'edit'
    formTagName.value = tag.name
    formTagActive.value = tag.active
    showModal.value = true
}

const openDeleteModal = (tag: TagItem) => {
    editingTag.value = tag
    modalType.value = 'delete'
    showModal.value = true
}

const closeModal = () => {
    showModal.value = false
    editingTag.value = null
}

const saveModal = () => {
    if (modalType.value === 'add') {
        const list = targetTagType.value === 'Genre' ? genres : instruments
        list.value.push({
            id: generateId(),
            name: formTagName.value,
            active: formTagActive.value,
            type: targetTagType.value
        })
    } else if (modalType.value === 'edit' && editingTag.value) {
        editingTag.value.name = formTagName.value
        editingTag.value.active = formTagActive.value
    } else if (modalType.value === 'delete' && editingTag.value) {
        if (editingTag.value.type === 'Genre') {
            genres.value = genres.value.filter(g => g.id !== editingTag.value!.id)
        } else {
            instruments.value = instruments.value.filter(i => i.id !== editingTag.value!.id)
        }
    }
    closeModal()
}

interface SuggestedTag {
    id: number
    tag: string
    type: 'Genre' | 'Instrument'
    user: {
        name: string
        email: string
        avatar: string
    }
    dateRequested: string
    status: 'Pending' | 'Accepted' | 'Rejected'
}

const suggestedTags = ref<SuggestedTag[]>([
    {
        id: 1,
        tag: 'Math Rock',
        type: 'Genre',
        user: {
            name: 'Elena Vance',
            email: 'elena.vance@tono.music',
            avatar: 'https://placehold.co/100x100/332244/FFF?text=EV'
        },
        dateRequested: 'Oct 24, 2023',
        status: 'Pending'
    },
    {
        id: 2,
        tag: 'Theremin',
        type: 'Instrument',
        user: {
            name: 'Marcus Thorne',
            email: 'm.thorne@sonicpulse.com',
            avatar: 'https://placehold.co/100x100/443322/FFF?text=MT'
        },
        dateRequested: 'Nov 02, 2023',
        status: 'Pending'
    },
    {
        id: 3,
        tag: 'Hyperpop',
        type: 'Genre',
        user: {
            name: 'Julian Chen',
            email: 'julian.chen@gmail.com',
            avatar: 'https://placehold.co/100x100/223344/FFF?text=JC'
        },
        dateRequested: 'Nov 10, 2023',
        status: 'Pending'
    },
    {
        id: 4,
        tag: 'Kalimba',
        type: 'Instrument',
        user: {
            name: 'Sarah Jenkins',
            email: 'sarah.j@starlight.io',
            avatar: 'https://placehold.co/100x100/222/FFF?text=SJ'
        },
        dateRequested: 'Nov 18, 2023',
        status: 'Pending'
    },
    {
        id: 5,
        tag: 'City Pop',
        type: 'Genre',
        user: {
            name: 'Kenji Sato',
            email: 'kenji.sato@groove.jp',
            avatar: 'https://placehold.co/100x100/113322/FFF?text=KS'
        },
        dateRequested: 'Dec 01, 2023',
        status: 'Pending'
    },
    {
        id: 6,
        tag: 'Hang Drum',
        type: 'Instrument',
        user: {
            name: 'Aria Montgomery',
            email: 'aria.m@soundscape.net',
            avatar: 'https://placehold.co/100x100/442233/FFF?text=AM'
        },
        dateRequested: 'Dec 05, 2023',
        status: 'Pending'
    }
])

const selectedIds = ref<number[]>([])

const pendingCount = computed(() => {
    return suggestedTags.value.filter(t => t.status === 'Pending').length
})

const isAllSelected = computed(() => {
    const pending = suggestedTags.value.filter(t => t.status === 'Pending')
    return pending.length > 0 && selectedIds.value.length === pending.length
})

const toggleSelectAll = () => {
    const pending = suggestedTags.value.filter(t => t.status === 'Pending')
    if (selectedIds.value.length === pending.length) {
        selectedIds.value = []
    } else {
        selectedIds.value = pending.map(t => t.id)
    }
}

const acceptTag = (id: number) => {
    const item = suggestedTags.value.find(t => t.id === id)
    if (item) {
        item.status = 'Accepted'
        selectedIds.value = selectedIds.value.filter(selectedId => selectedId !== id)
        if (item.type === 'Genre' && !genres.value.find(g => g.name === item.tag)) {
            genres.value.push({ id: generateId(), name: item.tag, active: true, type: 'Genre' })
        } else if (item.type === 'Instrument' && !instruments.value.find(i => i.name === item.tag)) {
            instruments.value.push({ id: generateId(), name: item.tag, active: true, type: 'Instrument' })
        }
    }
}

const rejectTag = (id: number) => {
    const item = suggestedTags.value.find(t => t.id === id)
    if (item) {
        item.status = 'Rejected'
        selectedIds.value = selectedIds.value.filter(selectedId => selectedId !== id)
    }
}

const acceptSelected = () => {
    selectedIds.value.forEach(id => acceptTag(id))
}

const rejectSelected = () => {
    selectedIds.value.forEach(id => rejectTag(id))
}
</script>

<template>
    <div>
        <nav
            class="flex items-center px-16 h-20 border-b border-[#46464D] top-0 sticky backdrop-blur-3xl z-10">
            <h1 class="text-[#D0D4F7] text-[24px] font-medium">Welcome Back Admin!</h1>
        </nav>
        <main class="p-8 lg:p-16 flex flex-col gap-10">
            <!-- Metric Counters -->
            <div class="flex flex-wrap justify-start gap-6 text-[1.2rem] font-Geist">

                <div
                    class="flex justify-between border rounded-xl border-[#2A2A2E]/50 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60">
                    <div class="flex flex-col justify-center">
                        <h1 class="text-base text-zinc-300">Active Genre Tags</h1>
                        <h1 class="text-[36px] font-bold text-[#D0D4F7]">{{ activeGenresCount }}</h1>
                    </div>
                    <div class="flex justify-center items-center">
                        <div class="flex p-2.5 rounded-lg bg-[#D0D4F7]/20">
                            <Icon name="ic:baseline-label" class="text-[32px] text-[#D0D4F7]" />
                        </div>
                    </div>
                </div>

                <div
                    class="flex justify-between border rounded-xl border-[#2A2A2E]/50 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60">
                    <div class="flex flex-col justify-center">
                        <h1 class="text-base text-zinc-300">Inactive Genre Tags</h1>
                        <h1 class="text-[36px] font-bold text-zinc-400">{{ inactiveGenresCount }}</h1>
                    </div>
                    <div class="flex justify-center items-center">
                        <div class="flex p-2.5 rounded-lg bg-zinc-800">
                            <Icon name="ic:baseline-label-off" class="text-[32px] text-zinc-400" />
                        </div>
                    </div>
                </div>

                <div
                    class="flex justify-between border rounded-xl border-[#2A2A2E]/50 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60">
                    <div class="flex flex-col justify-center">
                        <h1 class="text-base text-zinc-300">Active Instrument Tags</h1>
                        <h1 class="text-[36px] font-bold text-[#D0D4F7]">{{ activeInstrumentsCount }}</h1>
                    </div>
                    <div class="flex justify-center items-center">
                        <div class="flex p-2.5 rounded-lg bg-[#D0D4F7]/20">
                            <Icon name="ic:baseline-label" class="text-[32px] text-[#D0D4F7]" />
                        </div>
                    </div>
                </div>

                <div
                    class="flex justify-between border rounded-xl border-[#2A2A2E]/50 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60">
                    <div class="flex flex-col justify-center">
                        <h1 class="text-base text-zinc-300">Inactive Instrument Tags</h1>
                        <h1 class="text-[36px] font-bold text-zinc-400">{{ inactiveInstrumentsCount }}</h1>
                    </div>
                    <div class="flex justify-center items-center">
                        <div class="flex p-2.5 rounded-lg bg-zinc-800">
                            <Icon name="ic:baseline-label-off" class="text-[32px] text-zinc-400" />
                        </div>
                    </div>
                </div>

                <div
                    class="flex justify-between border rounded-xl border-[#2A2A2E]/50 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60">
                    <div class="flex flex-col justify-center">
                        <h1 class="text-base text-zinc-300">User Submissions</h1>
                        <h1 class="text-[36px] font-bold text-[#D0D4F7]">{{ pendingCount }}</h1>
                    </div>
                    <div class="flex justify-center items-center">
                        <div class="flex p-2.5 rounded-lg bg-[#D0D4F7]/20">
                            <Icon name="ic:baseline-new-label" class="text-[32px] text-[#D0D4F7]" />
                        </div>
                    </div>
                </div>

            </div>

            <!-- Active Tags Panels -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Genre Tags -->
                <div class="p-8 bg-[#1C1C1F]/60 border border-[#2A2A2E] rounded-xl flex flex-col gap-5">
                    <div class="flex flex-row justify-between items-center">
                        <div>
                            <h1 class="text-[#D3D4E9] font-bold text-lg">Genre Tags</h1>
                            <h2 class="text-zinc-400 text-sm font-light">Music Genre Classifications</h2>
                        </div>
                        <button @click="openAddModal('Genre')" class="flex items-center justify-center w-9 h-9 bg-[#D0D4F7] hover:bg-[#B0B4D7] rounded-full transition cursor-pointer shadow">
                            <Icon name="ic:baseline-plus" class="text-2xl text-[#2A2F4A]" />
                        </button>
                    </div>

                    <div class="relative">
                        <Icon name="ic:baseline-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
                        <input 
                            v-model="genreSearch"
                            type="text" 
                            placeholder="Search genres..." 
                            class="w-full bg-[#141416] border border-[#2A2A2E] rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#D0D4F7] transition-colors placeholder:text-zinc-600"
                        />
                    </div>

                    <div class="flex flex-col gap-2 pt-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        <div 
                            v-for="genre in filteredGenres" 
                            :key="genre.id"
                            class="flex items-center justify-between p-3 bg-[#242428] border border-zinc-700/60 rounded-lg group transition-colors hover:border-zinc-500/50">
                            
                            <div class="flex items-center gap-3">
                                <span class="text-sm font-medium text-zinc-200">{{ genre.name }}</span>
                                <span 
                                    class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                                    :class="genre.active ? 'bg-[#D0D4F7] text-[#2A2F4A]' : 'bg-zinc-800 text-zinc-400'">
                                    {{ genre.active ? 'Active' : 'Inactive' }}
                                </span>
                            </div>
                            
                            <div class="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button @click="openEditModal(genre)" class="p-1.5 text-zinc-400 hover:text-[#D0D4F7] hover:bg-[#D0D4F7]/10 rounded-md transition cursor-pointer">
                                    <Icon name="ic:baseline-edit" class="text-lg" />
                                </button>
                                <button @click="openDeleteModal(genre)" class="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition cursor-pointer">
                                    <Icon name="ic:baseline-delete" class="text-lg" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Instrument Tags -->
                <div class="p-8 bg-[#1C1C1F]/60 border border-[#2A2A2E] rounded-xl flex flex-col gap-5">
                    <div class="flex flex-row justify-between items-center">
                        <div>
                            <h1 class="text-[#D3D4E9] font-bold text-lg">Instrument Tags</h1>
                            <h2 class="text-zinc-400 text-sm font-light">Music Instrument Classifications</h2>
                        </div>
                        <button @click="openAddModal('Instrument')" class="flex items-center justify-center w-9 h-9 bg-[#D0D4F7] hover:bg-[#B0B4D7] rounded-full transition cursor-pointer shadow">
                            <Icon name="ic:baseline-plus" class="text-2xl text-[#2A2F4A]" />
                        </button>
                    </div>

                    <div class="relative">
                        <Icon name="ic:baseline-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
                        <input 
                            v-model="instrumentSearch"
                            type="text" 
                            placeholder="Search instruments..." 
                            class="w-full bg-[#141416] border border-[#2A2A2E] rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#D0D4F7] transition-colors placeholder:text-zinc-600"
                        />
                    </div>

                    <div class="flex flex-col gap-2 pt-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        <div 
                            v-for="instrument in filteredInstruments" 
                            :key="instrument.id"
                            class="flex items-center justify-between p-3 bg-[#242428] border border-zinc-700/60 rounded-lg group transition-colors hover:border-zinc-500/50">
                            
                            <div class="flex items-center gap-3">
                                <span class="text-sm font-medium text-zinc-200">{{ instrument.name }}</span>
                                <span 
                                    class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                                    :class="instrument.active ? 'bg-[#D0D4F7] text-[#2A2F4A]' : 'bg-zinc-800 text-zinc-400'">
                                    {{ instrument.active ? 'Active' : 'Inactive' }}
                                </span>
                            </div>
                            
                            <div class="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button @click="openEditModal(instrument)" class="p-1.5 text-zinc-400 hover:text-[#D0D4F7] hover:bg-[#D0D4F7]/10 rounded-md transition cursor-pointer">
                                    <Icon name="ic:baseline-edit" class="text-lg" />
                                </button>
                                <button @click="openDeleteModal(instrument)" class="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition cursor-pointer">
                                    <Icon name="ic:baseline-delete" class="text-lg" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Suggested Tags Table -->
            <div class="w-full mx-auto overflow-hidden border border-zinc-800 rounded-xl bg-[#18181b]">
                <div class="bg-[#2A2A2C]/40 px-6 py-5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 class="font-bold text-lg text-white">User Submissions</h1>
                        <h2 class="text-zinc-400 text-sm font-light">Review community submitted tags</h2>
                    </div>

                    <div v-if="selectedIds.length > 0" class="flex items-center gap-3">
                        <span class="text-xs text-zinc-300 font-medium">{{ selectedIds.length }} selected</span>
                        <button 
                            @click="acceptSelected" 
                            class="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-semibold cursor-pointer transition">
                            Accept Selected
                        </button>
                        <button 
                            @click="rejectSelected" 
                            class="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 rounded-lg text-xs font-semibold cursor-pointer transition">
                            Reject Selected
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">

                        <!-- Table Header -->
                        <thead class="bg-[#242426]">
                            <tr>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase w-12">
                                    <input 
                                        type="checkbox" 
                                        :checked="isAllSelected"
                                        @change="toggleSelectAll"
                                        class="w-4 h-4 rounded bg-[#18181b] border-zinc-700 text-[#D0D4F7] accent-[#D0D4F7] cursor-pointer" /> 
                                </th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    SUGGESTED TAG</th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    TYPE</th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    USER</th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    DATE REQUESTED</th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase text-right">
                                    ACTIONS</th>
                            </tr>
                        </thead>

                        <!-- Table Body -->
                        <tbody class="bg-[#18181b]">
                            <tr v-for="item in suggestedTags" :key="item.id"
                                class="border-t border-zinc-800 hover:bg-[#1f1f23] transition-colors"
                                :class="{ 'bg-[#222228]/70': selectedIds.includes(item.id) }">

                                <!-- Checkbox -->
                                <td class="px-6 py-4">
                                    <input 
                                        type="checkbox" 
                                        :value="item.id" 
                                        v-model="selectedIds"
                                        :disabled="item.status !== 'Pending'"
                                        class="w-4 h-4 rounded bg-[#18181b] border-zinc-700 text-[#D0D4F7] accent-[#D0D4F7] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" />
                                </td>

                                <!-- Suggested Tag -->
                                <td class="px-6 py-4">
                                    <span class="text-base font-semibold text-zinc-100">{{ item.tag }}</span>
                                </td>

                                <!-- Type -->
                                <td class="px-6 py-4">
                                    <span
                                        class="inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full"
                                        :class="item.type === 'Genre' 
                                            ? 'text-[#D0D4F7] bg-[#D0D4F7]/10 border border-[#D0D4F7]/25' 
                                            : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25'">
                                        {{ item.type }}
                                    </span>
                                </td>

                                <!-- User Profile -->
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-3">
                                        <img :src="item.user.avatar" :alt="item.user.name"
                                            class="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0" />
                                        <div class="flex flex-col min-w-0">
                                            <span class="text-sm font-medium text-zinc-100 truncate">{{ item.user.name }}</span>
                                            <span class="text-xs text-zinc-400 truncate">{{ item.user.email }}</span>
                                        </div>
                                    </div>
                                </td>

                                <!-- Date Requested -->
                                <td class="px-6 py-4 text-sm text-zinc-300 whitespace-nowrap">
                                    {{ item.dateRequested }}
                                </td>

                                <!-- Actions -->
                                <td class="px-6 py-4 text-right">
                                    <div v-if="item.status === 'Pending'" class="flex items-center justify-end gap-2">
                                        <button 
                                            @click="acceptTag(item.id)"
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                                            title="Accept tag">
                                            <Icon name="ic:baseline-check" class="text-base" />
                                            Accept
                                        </button>
                                        <button 
                                            @click="rejectTag(item.id)"
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                                            title="Reject tag">
                                            <Icon name="ic:baseline-close" class="text-base" />
                                            Reject
                                        </button>
                                    </div>
                                    <div v-else class="flex items-center justify-end">
                                        <span 
                                            class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md"
                                            :class="item.status === 'Accepted' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'">
                                            <Icon :name="item.status === 'Accepted' ? 'ic:baseline-check' : 'ic:baseline-close'" class="text-sm" />
                                            {{ item.status }}
                                        </span>
                                    </div>
                                </td>

                            </tr>
                        </tbody>

                    </table>
                </div>

                <!-- Table Footer -->
                <div class="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-[#18181b]">
                    <span class="text-sm text-zinc-300">
                        Showing {{ suggestedTags.length }} submitted tag{{ suggestedTags.length === 1 ? '' : 's' }}
                    </span>

                    <div class="flex items-center gap-2">
                        <button
                            class="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-800 text-zinc-600 cursor-not-allowed">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M15 19l-7-7 7-7"></path>
                            </svg>
                        </button>
                        <button
                            class="flex items-center justify-center w-8 h-8 rounded-md bg-[#e2dcfc] text-zinc-900 font-semibold text-sm transition-colors hover:bg-indigo-200">
                            1
                        </button>
                        <button
                            class="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-800 text-zinc-600 cursor-not-allowed">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </main>

        <!-- Modal Overlay -->
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div class="bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                
                <!-- Header -->
                <div class="px-6 py-4 border-b border-[#2A2A2E] flex justify-between items-center">
                    <h2 class="text-lg font-bold text-zinc-100">
                        {{ modalType === 'add' ? `Add New ${targetTagType}` : (modalType === 'edit' ? `Edit ${targetTagType}` : `Delete ${targetTagType}`) }}
                    </h2>
                    <button @click="closeModal" class="text-zinc-400 hover:text-white transition cursor-pointer">
                        <Icon name="ic:baseline-close" class="text-xl" />
                    </button>
                </div>

                <!-- Body Add/Edit -->
                <div v-if="modalType === 'add' || modalType === 'edit'" class="p-6 flex flex-col gap-5">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-300">Tag Name</label>
                        <input 
                            v-model="formTagName"
                            type="text" 
                            class="w-full bg-[#141416] border border-[#2A2A2E] rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-[#D0D4F7] transition-colors placeholder:text-zinc-600"
                            placeholder="e.g. Dream Pop"
                        />
                    </div>
                    
                    <div class="flex items-center justify-between mt-2">
                        <div class="flex flex-col">
                            <label class="text-sm font-medium text-zinc-300">Status</label>
                            <span class="text-xs text-zinc-500">Set whether this tag is actively used</span>
                        </div>
                        <button 
                            @click="formTagActive = !formTagActive"
                            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer"
                            :class="formTagActive ? 'bg-[#D0D4F7]' : 'bg-zinc-700'">
                            <span 
                                class="inline-block h-4 w-4 transform rounded-full bg-[#1C1C1F] transition-transform"
                                :class="formTagActive ? 'translate-x-6' : 'translate-x-1'">
                            </span>
                        </button>
                    </div>
                </div>

                <!-- Body Delete -->
                <div v-if="modalType === 'delete'" class="p-6">
                    <p class="text-zinc-300 text-sm">
                        Are you sure you want to delete the tag <span class="font-bold text-white">"{{ editingTag?.name }}"</span>? This action cannot be undone.
                    </p>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 bg-[#141416]/50 border-t border-[#2A2A2E] flex justify-end gap-3">
                    <button 
                        @click="closeModal"
                        class="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button 
                        v-if="modalType !== 'delete'"
                        @click="saveModal"
                        :disabled="!formTagName.trim()"
                        class="px-4 py-2 bg-[#D0D4F7] text-[#2A2F4A] hover:bg-[#B0B4D7] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                        Save Tag
                    </button>
                    <button 
                        v-if="modalType === 'delete'"
                        @click="saveModal"
                        class="px-4 py-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 rounded-lg text-sm font-semibold transition-colors cursor-pointer">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>