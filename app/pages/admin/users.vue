<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import AdminPagination from '~/components/admin/AdminPagination.vue'

const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()
const supabase = useSupabaseClient()

const adminProfile = await fetchCurrentAdmin()
const users = ref<any[]>([])
const isLoading = ref(true)
const previewUser = ref<any>(null)

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

const fetchUsers = async () => {
    isLoading.value = true
    try {
        const { data: usersData, error } = await supabase
            .from('USER_ACCOUNT')
            .select(`
                *,
                ACCOUNT_PREF_GENRE (
                    TAG_GENRE ( Name )
                ),
                ACCOUNT_PREF_INSTRUMENTS (
                    TAG_INSTRUMENT ( Name )
                ),
                ARTIST (
                    *,
                    SOLO_ARTIST (
                        *,
                        SOLO_GENRES ( TAG_GENRE ( Name ) ),
                        SOLO_INSTRUMENTS ( TAG_INSTRUMENT ( Name ) )
                    ),
                    BAND (
                        *,
                        BAND_GENRES ( TAG_GENRE ( Name ) )
                    )
                ),
                BUSINESS_PROFILE (*)
            `)

        if (error) throw error

        if (usersData) {
            users.value = usersData.map((row: any) => {
                let role = 'User'
                const artistRow = row.ARTIST && row.ARTIST.length > 0 ? row.ARTIST[0] : null
                const businessRow = row.BUSINESS_PROFILE && row.BUSINESS_PROFILE.length > 0 ? row.BUSINESS_PROFILE[0] : null

                if (artistRow) role = 'Artist'
                else if (businessRow) role = 'Business'

                let status = 'Active'
                if (row.Is_Banned) status = 'Banned'
                else if (role === 'Artist' && artistRow?.Status === 'Pending') status = 'Pending'
                else if (role === 'Artist' && artistRow?.Status === 'Rejected') status = 'Rejected'

                const formatDate = (dateStr: string) => {
                    if (!dateStr) return 'Unknown'
                    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                }

                // Extract general user preferences
                const userPrefGenres = (row.ACCOUNT_PREF_GENRE || [])
                    .map((g: any) => g.TAG_GENRE?.Name)
                    .filter(Boolean)
                const userPrefInstruments = (row.ACCOUNT_PREF_INSTRUMENTS || [])
                    .map((i: any) => i.TAG_INSTRUMENT?.Name)
                    .filter(Boolean)

                // Extract artist details
                let stageName = ''
                let specialty = ''
                let artistType: 'Solo' | 'Band' | '' = ''
                let genres: string[] = []
                let instruments: string[] = []
                let bio = ''
                let socialLinks: any = {}
                let isVerified = false
                let artistId = ''
                let appliedDate = ''

                if (artistRow) {
                    artistId = artistRow.ARTIST_ID
                    artistType = artistRow.Artist_Type
                    bio = artistRow.Bio || ''
                    socialLinks = artistRow.Links || {}
                    isVerified = !!artistRow.Is_Verified
                    appliedDate = formatDate(artistRow.Created_at)

                    const isSolo = artistRow.Artist_Type === 'Solo'
                    const soloData = isSolo && artistRow.SOLO_ARTIST ? (Array.isArray(artistRow.SOLO_ARTIST) ? artistRow.SOLO_ARTIST[0] : artistRow.SOLO_ARTIST) : null
                    const bandData = !isSolo && artistRow.BAND ? (Array.isArray(artistRow.BAND) ? artistRow.BAND[0] : artistRow.BAND) : null

                    stageName = isSolo ? soloData?.Artist_Name : bandData?.Band_Name
                    specialty = isSolo ? soloData?.Specialty : 'Band'

                    if (isSolo && soloData) {
                        genres = (soloData.SOLO_GENRES || []).map((g: any) => g.TAG_GENRE?.Name).filter(Boolean)
                        instruments = (soloData.SOLO_INSTRUMENTS || []).map((i: any) => i.TAG_INSTRUMENT?.Name).filter(Boolean)
                    } else if (!isSolo && bandData) {
                        genres = (bandData.BAND_GENRES || []).map((g: any) => g.TAG_GENRE?.Name).filter(Boolean)
                    }

                    // Fallback to user preferences if artist tags are not explicitly configured
                    if (genres.length === 0 && userPrefGenres.length > 0) {
                        genres = userPrefGenres
                    }
                    if (instruments.length === 0 && userPrefInstruments.length > 0) {
                        instruments = userPrefInstruments
                    }
                } else {
                    // For general users (and businesses), use account preferences
                    genres = userPrefGenres
                    instruments = userPrefInstruments
                }

                // Extract business details
                let businessName = ''
                let businessAddress = ''
                let businessContact = ''
                let businessService = ''

                if (businessRow) {
                    businessName = businessRow.Business_Name || ''
                    businessAddress = businessRow.Business_Address || ''
                    businessContact = businessRow.Contact_Information || ''
                    businessService = businessRow.Business_Service || ''
                }

                return {
                    id: row.ACCOUNT_ID,
                    artistId,
                    name: row.Username || 'Unknown',
                    stageName: stageName || row.Username || 'Unknown',
                    email: row.Email || 'Unknown',
                    avatar: row.Profile_Picture || `https://placehold.co/100x100/332244/FFF?text=${(stageName || row.Username || 'U').charAt(0)}`,
                    role,
                    artistType,
                    status,
                    isVerified,
                    isBanned: !!row.Is_Banned,
                    city: row.City || '',
                    barangay: row.Barangay || '',
                    joinDate: formatDate(row.Created_at),
                    appliedDate,
                    bio,
                    specialty,
                    genres,
                    instruments,
                    socialLinks,
                    businessName,
                    businessAddress,
                    businessContact,
                    businessService,
                    originalData: row
                }
            })

            // Keep preview user updated if open
            if (previewUser.value) {
                previewUser.value = users.value.find(u => u.id === previewUser.value.id) || null
            }
        }
    } catch (error) {
        console.error('Error fetching users:', error)
    } finally {
        isLoading.value = false
    }
}

onMounted(() => {
    fetchUsers()
})

const handleLogout = async () => {
    await signOutAdmin()
}

// Search & Filter
const searchQuery = ref('')
const filteredUsers = computed(() => {
    if (!searchQuery.value) return users.value
    const query = searchQuery.value.toLowerCase()
    return users.value.filter(u => 
        u.name.toLowerCase().includes(query) || 
        (u.stageName && u.stageName.toLowerCase().includes(query)) ||
        (u.businessName && u.businessName.toLowerCase().includes(query)) ||
        u.email.toLowerCase().includes(query) || 
        u.id.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query) ||
        (u.genres && u.genres.some((g: string) => g.toLowerCase().includes(query))) ||
        (u.instruments && u.instruments.some((i: string) => i.toLowerCase().includes(query)))
    )
})

// Pagination State
const currentPage = ref(1)
const pageSize = ref(10)

const paginatedUsers = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return filteredUsers.value.slice(start, start + pageSize.value)
})

watch([searchQuery, pageSize], () => {
    currentPage.value = 1
})

// Preview State & Actions
const togglePreviewUser = (user: any) => {
    if (previewUser.value?.id === user.id) {
        previewUser.value = null
    } else {
        previewUser.value = user
    }
}

const closePreview = () => {
    previewUser.value = null
}

const approveArtist = async (artistId: string) => {
    if (!artistId) return
    try {
        const { error } = await supabase
            .from('ARTIST')
            .update({ Is_Verified: true, Status: 'Active' })
            .eq('ARTIST_ID', artistId)

        if (error) throw error
        await fetchUsers()
    } catch (error) {
        console.error('Error approving artist:', error)
    }
}

const rejectArtist = async (artistId: string) => {
    if (!artistId) return
    try {
        const { error } = await supabase
            .from('ARTIST')
            .update({ Is_Verified: false, Status: 'Rejected' })
            .eq('ARTIST_ID', artistId)

        if (error) throw error
        await fetchUsers()
    } catch (error) {
        console.error('Error rejecting artist:', error)
    }
}

// Modals State
const isEditModalOpen = ref(false)
const isBanModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const selectedUser = ref<any>(null)
const editFormData = ref({ name: '', email: '', isBanned: false })

// Actions
const openEditModal = (user: any) => {
    selectedUser.value = user
    editFormData.value = { name: user.name, email: user.email, isBanned: user.isBanned }
    isEditModalOpen.value = true
}

const openBanModal = (user: any) => {
    selectedUser.value = user
    isBanModalOpen.value = true
}

const openDeleteModal = (user: any) => {
    selectedUser.value = user
    isDeleteModalOpen.value = true
}

const closeModals = () => {
    isEditModalOpen.value = false
    isBanModalOpen.value = false
    isDeleteModalOpen.value = false
    selectedUser.value = null
}

const saveEdit = async () => {
    if (!selectedUser.value) return
    try {
        const { error } = await supabase
            .from('USER_ACCOUNT')
            .update({ Username: editFormData.value.name, Email: editFormData.value.email })
            .eq('ACCOUNT_ID', selectedUser.value.id)

        if (error) throw error
        await fetchUsers()
        closeModals()
    } catch (error) {
        console.error('Error updating user:', error)
    }
}

const toggleBanUser = async () => {
    if (!selectedUser.value) return
    try {
        const newBanStatus = !selectedUser.value.isBanned
        const { error } = await supabase
            .from('USER_ACCOUNT')
            .update({ Is_Banned: newBanStatus })
            .eq('ACCOUNT_ID', selectedUser.value.id)
            
        if (error) throw error
        await fetchUsers()
        closeModals()
    } catch (error) {
        console.error('Error banning user:', error)
    }
}

const confirmDeleteUser = async () => {
    if (!selectedUser.value) return
    try {
        const response = await $fetch('/api/admin/delete-user', {
            method: 'POST',
            body: { userId: selectedUser.value.id }
        })
        if (previewUser.value && previewUser.value.id === selectedUser.value.id) {
            previewUser.value = null
        }
        await fetchUsers()
        closeModals()
    } catch (error) {
        console.error('Error deleting user:', error)
    }
}

</script>

<template>
    <div>
        <nav class="flex items-center px-16 h-20 border-b border-[#46464D] top-0 sticky backdrop-blur-3xl z-10">
            <h1 class="text-[#D0D4F7] text-[24px] font-medium">Welcome Back Admin!</h1>
        </nav>
        <main class="p-16">
            <div class="flex flex-col gap-6">

                <div>
                    <h1 class="font-semibold text-[40px]">User Directory</h1>
                    <h1 class="font-light text-[16px]">Manage platform users, verify artists, and manage user sanctions.</h1>
                </div>

                <div class="bg-[#1C1C1F]/60 border border-[#2A2A2E] p-6 rounded-xl">
                    <div class="w-fit flex items-center justify-center">
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                                <Icon name="ic:outline-search" class="absolute text-2xl text-[#ffffff]" />
                            </div>
                            <input type="search" v-model="searchQuery" placeholder="Search by name, email, ID or Role..."
                                class="w-101.5 py-2 pl-12 pr-5 bg-[#0E0E10] placeholder:text-[#6B7280] rounded-lg text-white outline-none focus:ring-2 focus:ring-[#D0D4F7]/30" />
                        </div>
                    </div>
                </div>

                <!-- Flexible row container: table + user preview card -->
                <div class="flex flex-col xl:flex-row gap-6 items-start w-full transition-all duration-300">
                    <!-- Table Container -->
                    <div class="flex-1 min-w-0 w-full transition-all duration-300">
                        <div class="w-full overflow-hidden border border-zinc-800 rounded-xl bg-[#18181b]">
                            <div class="overflow-x-auto">
                                <table class="w-full text-left border-collapse">
                                    <!-- Table Header -->
                                    <thead class="bg-[#242426]">
                                        <tr>
                                            <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">User Profile</th>
                                            <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Role</th>
                                            <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Account Status</th>
                                            <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Join Date</th>
                                            <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <!-- Table Body -->
                                    <tbody class="bg-[#18181b]">
                                        <tr v-if="isLoading" class="border-t border-zinc-800">
                                            <td colspan="5" class="px-6 py-8 text-center text-zinc-400">Loading users...</td>
                                        </tr>
                                        <tr v-else-if="filteredUsers.length === 0" class="border-t border-zinc-800">
                                            <td colspan="5" class="px-6 py-8 text-center text-zinc-400">No users found.</td>
                                        </tr>
                                        <tr v-for="user in paginatedUsers" :key="user.id"
                                            class="border-t border-zinc-800 transition-colors"
                                            :class="previewUser?.id === user.id ? 'bg-[#222228] border-l-4 border-l-[#D0D4F7]' : 'hover:bg-[#1f1f23]'">
                                            <!-- profile cell -->
                                            <td class="px-6 py-4">
                                                <div class="flex items-center gap-4">
                                                    <img :src="user.avatar" :alt="user.name" class="w-12 h-12 rounded-lg object-cover shadow-sm shrink-0" />
                                                    <div class="flex flex-col min-w-0">
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-base font-medium text-zinc-100 truncate">{{ user.stageName || user.name }}</span>
                                                            <span v-if="user.stageName && user.stageName !== user.name" class="text-xs text-zinc-400">({{ user.name }})</span>
                                                        </div>
                                                        <span class="text-sm text-zinc-400 truncate">{{ user.email }}</span>
                                                        <span class="text-xs text-zinc-600 font-mono truncate">{{ user.id }}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <!-- role -->
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="inline-flex items-center justify-center px-4 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/50 border border-zinc-700 rounded-full">
                                                    {{ user.role === 'Artist' && user.artistType ? `${user.role} (${user.artistType})` : user.role }}
                                                </span>
                                            </td>

                                            <!-- Account Status -->
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <div class="flex items-center gap-2 text-sm font-medium"
                                                    :class="{
                                                        'text-emerald-400': user.status === 'Active',
                                                        'text-rose-400': user.status === 'Banned' || user.status === 'Rejected',
                                                        'text-amber-400': user.status === 'Pending'
                                                    }">
                                                    <span class="w-2 h-2 rounded-full"
                                                        :class="{
                                                            'bg-emerald-400': user.status === 'Active',
                                                            'bg-rose-400': user.status === 'Banned' || user.status === 'Rejected',
                                                            'bg-amber-400': user.status === 'Pending'
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
                                            <td class="px-6 py-4 text-right whitespace-nowrap">
                                                <div class="flex items-center justify-end gap-2">
                                                    <button 
                                                        @click="togglePreviewUser(user)" 
                                                        class="flex cursor-pointer p-2 rounded-lg transition"
                                                        :class="previewUser?.id === user.id 
                                                            ? 'text-[#D0D4F7] bg-zinc-800 ring-1 ring-[#D0D4F7]/50' 
                                                            : 'text-zinc-400 hover:text-[#D0D4F7] hover:bg-zinc-800'"
                                                        :title="previewUser?.id === user.id ? 'Close Preview' : 'Preview User Details'">
                                                        <Icon name="material-symbols:visibility-outline" class="text-xl" />
                                                    </button>
                                                    <button @click="openEditModal(user)" class="flex cursor-pointer p-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-lg transition" title="Edit User">
                                                        <Icon name="material-symbols:edit-outline" class="text-xl" />
                                                    </button>
                                                    <button @click="openBanModal(user)" class="flex cursor-pointer p-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition" :title="user.isBanned ? 'Unban User' : 'Ban User'">
                                                        <Icon :name="user.isBanned ? 'material-symbols:lock-open-outline' : 'material-symbols:lock-outline'" class="text-xl" />
                                                    </button>
                                                    <button @click="openDeleteModal(user)" class="flex cursor-pointer p-2 text-zinc-400 hover:text-rose-500 hover:bg-zinc-800 rounded-lg transition" title="Delete User">
                                                        <Icon name="material-symbols:delete-outline" class="text-xl" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Pagination Footer -->
                            <AdminPagination 
                                v-model:currentPage="currentPage" 
                                v-model:pageSize="pageSize" 
                                :totalItems="filteredUsers.length" 
                                itemLabel="users" 
                            />
                        </div>
                    </div>

                    <!-- User Preview Card (similar to review card in verifications.vue) -->
                    <Transition name="slide-card">
                        <aside 
                            v-if="previewUser" 
                            class="w-full xl:w-105 2xl:w-115 shrink-0 bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl p-6 shadow-2xl sticky top-24 flex flex-col gap-5 text-zinc-200">
                            
                            <!-- Header -->
                            <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
                                <div class="flex items-center gap-2">
                                    <Icon 
                                        :name="previewUser.role === 'Artist' ? 'ic:outline-verified-user' : previewUser.role === 'Business' ? 'material-symbols:storefront-outline' : 'material-symbols:person-outline'" 
                                        class="text-2xl text-[#D0D4F7]" 
                                    />
                                    <div>
                                        <h2 class="text-lg font-bold text-white leading-tight">
                                            {{ previewUser.role === 'Artist' ? 'Artist Details' : previewUser.role === 'Business' ? 'Business Details' : 'User Details' }}
                                        </h2>
                                        <p class="text-xs text-zinc-400">{{ previewUser.role }} Profile Overview</p>
                                    </div>
                                </div>
                                <button 
                                    @click="closePreview"
                                    class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                    title="Close preview">
                                    <Icon name="ic:baseline-close" class="text-xl" />
                                </button>
                            </div>

                            <!-- User Identity -->
                            <div class="flex items-start gap-4">
                                <img 
                                    :src="previewUser.avatar" 
                                    :alt="previewUser.name" 
                                    class="w-16 h-16 rounded-xl object-cover border border-zinc-700 shadow-md shrink-0" 
                                />
                                <div class="flex flex-col min-w-0 flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <h3 class="text-lg font-bold text-white truncate">
                                            {{ previewUser.role === 'Artist' ? previewUser.stageName : previewUser.role === 'Business' ? (previewUser.businessName || previewUser.name) : previewUser.name }}
                                        </h3>
                                        <span class="px-2 py-0.5 text-[11px] font-medium bg-[#D0D4F7]/20 text-[#D0D4F7] border border-[#D0D4F7]/30 rounded-full">
                                            {{ previewUser.role === 'Artist' && previewUser.artistType ? previewUser.artistType : previewUser.role }}
                                        </span>
                                        <span v-if="previewUser.isVerified" class="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                                            <Icon name="ic:round-verified" class="text-xs" /> Verified
                                        </span>
                                    </div>
                                    <span class="text-xs text-zinc-400 truncate">{{ previewUser.name }} • {{ previewUser.email }}</span>
                                    <span v-if="previewUser.city" class="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                                        <Icon name="ic:outline-location-on" class="text-sm text-[#D0D4F7]" />
                                        {{ previewUser.barangay ? `${previewUser.barangay}, ` : '' }}{{ previewUser.city }}
                                    </span>
                                </div>
                            </div>

                            <!-- Meta Info Grid -->
                            <div class="grid grid-cols-2 gap-2 p-3 bg-[#141416] rounded-lg border border-zinc-800/80 text-xs">
                                <div>
                                    <span class="text-zinc-500 block mb-0.5 font-medium">Status</span>
                                    <div class="flex items-center gap-1.5 font-medium"
                                        :class="{
                                            'text-amber-400': previewUser.status === 'Pending',
                                            'text-emerald-400': previewUser.status === 'Active',
                                            'text-rose-400': previewUser.status === 'Banned' || previewUser.status === 'Rejected'
                                        }">
                                        <span class="w-2 h-2 rounded-full"
                                            :class="{
                                                'bg-amber-400': previewUser.status === 'Pending',
                                                'bg-emerald-400': previewUser.status === 'Active',
                                                'bg-rose-400': previewUser.status === 'Banned' || previewUser.status === 'Rejected'
                                            }">
                                        </span>
                                        {{ previewUser.status }}
                                    </div>
                                </div>
                                <div>
                                    <span class="text-zinc-500 block mb-0.5 font-medium">Join Date</span>
                                    <span class="text-zinc-300 font-medium">{{ previewUser.joinDate }}</span>
                                </div>
                            </div>

                            <!-- Account ID -->
                            <div class="flex flex-col gap-1">
                                <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Account ID</span>
                                <p class="text-zinc-400 bg-[#141416] px-3 py-1.5 rounded-lg border border-zinc-800 text-[11px] font-mono select-all truncate">
                                    {{ previewUser.id }}
                                </p>
                            </div>

                            <!-- Artist Specific Details -->
                            <template v-if="previewUser.role === 'Artist'">
                                <!-- Specialty -->
                                <div v-if="previewUser.specialty" class="flex flex-col gap-1.5">
                                    <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Specialty</span>
                                    <p class="text-zinc-200 bg-[#18181b] px-3 py-2 rounded-lg border border-zinc-800 text-xs font-medium">
                                        {{ previewUser.specialty }}
                                    </p>
                                </div>

                                <!-- Bio -->
                                <div class="flex flex-col gap-1.5">
                                    <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Artist Bio</span>
                                    <p class="text-zinc-300 bg-[#18181b] p-3 rounded-lg border border-zinc-800 leading-relaxed text-xs max-h-24 overflow-y-auto scrollbar-hide">
                                        {{ previewUser.bio || 'No bio provided.' }}
                                    </p>
                                </div>

                                <!-- Genres & Instruments -->
                                <div class="flex flex-col gap-3">
                                    <div v-if="previewUser.genres?.length">
                                        <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px] block mb-1.5">Genres</span>
                                        <div class="flex flex-wrap gap-1.5">
                                            <span 
                                                v-for="genre in previewUser.genres" 
                                                :key="genre"
                                                class="px-2.5 py-1 text-xs font-medium text-[#D0D4F7] bg-[#D0D4F7]/10 border border-[#D0D4F7]/20 rounded-md">
                                                {{ genre }}
                                            </span>
                                        </div>
                                    </div>

                                    <div v-if="previewUser.instruments?.length">
                                        <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px] block mb-1.5">Instruments</span>
                                        <div class="flex flex-wrap gap-1.5">
                                            <span 
                                                v-for="inst in previewUser.instruments" 
                                                :key="inst"
                                                class="px-2.5 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/70 border border-zinc-700/60 rounded-md">
                                                {{ inst }}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Social Links -->
                                <div v-if="previewUser.socialLinks && Object.values(previewUser.socialLinks).some(Boolean)">
                                    <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px] block mb-1.5">Links & Profiles</span>
                                    <div class="flex flex-wrap gap-2">
                                        <a 
                                            v-if="previewUser.socialLinks.spotify" 
                                            :href="previewUser.socialLinks.spotify" 
                                            target="_blank"
                                            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-emerald-950/40 text-emerald-400 border border-zinc-800 hover:border-emerald-700/50 rounded-lg text-xs transition">
                                            <Icon name="ic:baseline-music-note" /> Spotify
                                        </a>
                                        <a 
                                            v-if="previewUser.socialLinks.instagram" 
                                            :href="previewUser.socialLinks.instagram" 
                                            target="_blank"
                                            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-pink-950/40 text-pink-400 border border-zinc-800 hover:border-pink-700/50 rounded-lg text-xs transition">
                                            <Icon name="ic:outline-camera-alt" /> Instagram
                                        </a>
                                        <a 
                                            v-if="previewUser.socialLinks.youtube" 
                                            :href="previewUser.socialLinks.youtube" 
                                            target="_blank"
                                            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-red-950/40 text-rose-400 border border-zinc-800 hover:border-rose-700/50 rounded-lg text-xs transition">
                                            <Icon name="ic:outline-smart-display" /> YouTube
                                        </a>
                                        <a 
                                            v-if="previewUser.socialLinks.facebook" 
                                            :href="previewUser.socialLinks.facebook" 
                                            target="_blank"
                                            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-blue-950/40 text-blue-400 border border-zinc-800 hover:border-blue-700/50 rounded-lg text-xs transition">
                                            <Icon name="ic:outline-facebook" /> Facebook
                                        </a>
                                    </div>
                                </div>

                                <!-- Pending verification quick actions -->
                                <div v-if="previewUser.status === 'Pending' && previewUser.artistId" class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex flex-col gap-2 mt-1">
                                    <span class="text-amber-300 text-xs font-medium flex items-center gap-1.5">
                                        <Icon name="material-symbols:pending-actions" class="text-base" /> Pending Verification Request
                                    </span>
                                    <div class="flex gap-2">
                                        <button 
                                            @click="approveArtist(previewUser.artistId)"
                                            class="flex-1 py-2 px-3 bg-[#D0D4F7] hover:bg-[#B0B4D7] text-[#121214] font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer">
                                            <Icon name="ic:round-check-circle" class="text-sm" /> Approve
                                        </button>
                                        <button 
                                            @click="rejectArtist(previewUser.artistId)"
                                            class="flex-1 py-2 px-3 bg-transparent hover:bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:border-rose-500 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer">
                                            <Icon name="ic:baseline-cancel" class="text-sm" /> Reject
                                        </button>
                                    </div>
                                </div>
                            </template>

                            <!-- Business Specific Details -->
                            <template v-else-if="previewUser.role === 'Business'">
                                <div v-if="previewUser.businessName" class="flex flex-col gap-1.5">
                                    <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Business Name</span>
                                    <p class="text-zinc-200 bg-[#18181b] px-3 py-2 rounded-lg border border-zinc-800 text-xs font-medium">
                                        {{ previewUser.businessName }}
                                    </p>
                                </div>
                                <div v-if="previewUser.businessService" class="flex flex-col gap-1.5">
                                    <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Service Provided</span>
                                    <p class="text-zinc-300 bg-[#18181b] px-3 py-2 rounded-lg border border-zinc-800 text-xs">
                                        {{ previewUser.businessService }}
                                    </p>
                                </div>
                                <div v-if="previewUser.businessAddress" class="flex flex-col gap-1.5">
                                    <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Address</span>
                                    <p class="text-zinc-300 bg-[#18181b] px-3 py-2 rounded-lg border border-zinc-800 text-xs">
                                        {{ previewUser.businessAddress }}
                                    </p>
                                </div>
                                <div v-if="previewUser.businessContact" class="flex flex-col gap-1.5">
                                    <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Contact Information</span>
                                    <p class="text-zinc-300 bg-[#18181b] px-3 py-2 rounded-lg border border-zinc-800 text-xs">
                                        {{ previewUser.businessContact }}
                                    </p>
                                </div>
                            </template>

                            <!-- User Specific Note & Preferences -->
                            <template v-else>
                                <!-- Preferences: Genres & Instruments -->
                                <div class="flex flex-col gap-3">
                                    <div>
                                        <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px] block mb-1.5">Preferred Genres</span>
                                        <div v-if="previewUser.genres?.length" class="flex flex-wrap gap-1.5">
                                            <span 
                                                v-for="genre in previewUser.genres" 
                                                :key="genre"
                                                class="px-2.5 py-1 text-xs font-medium text-[#D0D4F7] bg-[#D0D4F7]/10 border border-[#D0D4F7]/20 rounded-md">
                                                {{ genre }}
                                            </span>
                                        </div>
                                        <p v-else class="text-xs text-zinc-500 italic bg-[#18181b] px-3 py-2 rounded-lg border border-zinc-800/60">
                                            No genre preferences selected.
                                        </p>
                                    </div>

                                    <div>
                                        <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px] block mb-1.5">Preferred Instruments</span>
                                        <div v-if="previewUser.instruments?.length" class="flex flex-wrap gap-1.5">
                                            <span 
                                                v-for="inst in previewUser.instruments" 
                                                :key="inst"
                                                class="px-2.5 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/70 border border-zinc-700/60 rounded-md">
                                                {{ inst }}
                                            </span>
                                        </div>
                                        <p v-else class="text-xs text-zinc-500 italic bg-[#18181b] px-3 py-2 rounded-lg border border-zinc-800/60">
                                            No instrument preferences selected.
                                        </p>
                                    </div>
                                </div>

                                <div class="flex flex-col gap-1.5">
                                    <span class="text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Account Type</span>
                                    <p class="text-zinc-300 bg-[#18181b] p-3 rounded-lg border border-zinc-800 leading-relaxed text-xs">
                                        Standard listener / client account with active booking and discovery privileges.
                                    </p>
                                </div>
                            </template>

                            <!-- Card Footer Actions -->
                            <div class="pt-3 border-t border-zinc-800 flex items-center gap-2 mt-auto">
                                <button 
                                    @click="openEditModal(previewUser)"
                                    class="flex-1 py-2.5 px-3 bg-[#D0D4F7] hover:bg-[#B0B4D7] text-[#121214] font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow">
                                    <Icon name="material-symbols:edit-outline" class="text-base" />
                                    Edit
                                </button>
                                <button 
                                    @click="openBanModal(previewUser)"
                                    class="flex-1 py-2.5 px-3 bg-transparent border text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                                    :class="previewUser.isBanned ? 'text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10' : 'text-amber-400 border-amber-500/40 hover:bg-amber-500/10'">
                                    <Icon :name="previewUser.isBanned ? 'material-symbols:lock-open-outline' : 'material-symbols:lock-outline'" class="text-base" />
                                    {{ previewUser.isBanned ? 'Unban' : 'Ban' }}
                                </button>
                                <button 
                                    @click="openDeleteModal(previewUser)"
                                    class="p-2.5 bg-transparent hover:bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:border-rose-500 rounded-lg transition flex items-center justify-center cursor-pointer"
                                    title="Delete User">
                                    <Icon name="material-symbols:delete-outline" class="text-base" />
                                </button>
                            </div>
                        </aside>
                    </Transition>
                </div>
            </div>
        </main>

        <!-- Edit Modal -->
        <div v-if="isEditModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="bg-[#1E1E20] border border-[#3A3A3C] rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-bold text-white">Edit User</h2>
                    <button @click="closeModals" class="cursor-pointer text-zinc-400 hover:text-white transition">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>
                <div class="flex flex-col gap-4">
                    <div>
                        <label class="block text-sm font-medium text-zinc-400 mb-1">Username</label>
                        <input type="text" v-model="editFormData.name" class="w-full bg-[#0E0E10] border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                        <input type="email" v-model="editFormData.email" class="w-full bg-[#0E0E10] border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div class="mt-6 flex justify-end gap-3">
                        <button @click="closeModals" class="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition">Cancel</button>
                        <button @click="saveEdit" class="cursor-pointer px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Ban Modal -->
        <div v-if="isBanModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="bg-[#1E1E20] border border-amber-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl text-center">
                <Icon name="material-symbols:warning-outline" class="text-5xl text-amber-500 mb-4" />
                <h2 class="text-xl font-bold text-white mb-2">{{ selectedUser?.isBanned ? 'Unban User?' : 'Ban User?' }}</h2>
                <p class="text-zinc-400 mb-6">
                    Are you sure you want to {{ selectedUser?.isBanned ? 'unban' : 'ban' }} <strong>{{ selectedUser?.name }}</strong>?
                    <span v-if="!selectedUser?.isBanned">They will no longer be able to log in or access the platform.</span>
                </p>
                <div class="flex justify-center gap-3">
                    <button @click="closeModals" class="cursor-pointer px-6 py-2 font-medium text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition">Cancel</button>
                    <button @click="toggleBanUser" class="cursor-pointer px-6 py-2 font-medium bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition">
                        Confirm {{ selectedUser?.isBanned ? 'Unban' : 'Ban' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Delete Modal -->
        <div v-if="isDeleteModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div class="bg-[#1E1E20] border border-rose-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl text-center">
                <Icon name="material-symbols:delete-forever" class="text-5xl text-rose-500 mb-4" />
                <h2 class="text-2xl font-bold text-white mb-2">Hard Delete User?</h2>
                <p class="text-zinc-400 mb-6">
                    This action is <strong>irreversible</strong>. You are about to permanently delete <strong>{{ selectedUser?.name }}</strong> from the database, including all their associated data, files, and profile details.
                </p>
                <div class="flex flex-col gap-3">
                    <button @click="confirmDeleteUser" class="cursor-pointer w-full py-3 font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition">
                        Yes, I understand. Delete permanently.
                    </button>
                    <button @click="closeModals" class="cursor-pointer w-full py-3 font-medium text-zinc-400 hover:text-white transition border rounded">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
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