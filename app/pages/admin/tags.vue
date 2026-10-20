<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import AdminPagination from '~/components/admin/AdminPagination.vue'

const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()
const supabase = useSupabaseClient()
const db = supabase as any

const handleLogout = async () => {
    await signOutAdmin()
}

// Admin profile
const adminProfile = await fetchCurrentAdmin()
definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

useHead({
  title: 'Tag Management | Admin TONO'
})

interface TagItem {
    id: string
    name: string
    active: boolean
    type: 'Genre' | 'Instrument'
}

// Live Genres & Instruments
const genres = ref<TagItem[]>([])
const instruments = ref<TagItem[]>([])
const isLoadingTags = ref(true)

// Modal State
const showModal = ref(false)
useModalScrollLock(showModal)
const modalType = ref<'add' | 'edit' | 'delete'>('add')
const targetTagType = ref<'Genre' | 'Instrument'>('Genre')
const editingTag = ref<TagItem | null>(null)
const isSavingTag = ref(false)
const formErrorMessage = ref<string | null>(null)

// Notification State
const notificationMessage = ref<{ text: string; type: 'success' | 'error' } | null>(null)
const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    notificationMessage.value = { text, type }
    setTimeout(() => {
        if (notificationMessage.value?.text === text) {
            notificationMessage.value = null
        }
    }, 4000)
}

// Form State
const formTagName = ref('')
const formTagActive = ref(true)

// Search State
const genreSearch = ref('')
const instrumentSearch = ref('')

const filteredGenres = computed(() => {
    const query = genreSearch.value.trim().toLowerCase()
    if (!query) return genres.value
    return genres.value.filter(g => g.name.toLowerCase().includes(query))
})

const filteredInstruments = computed(() => {
    const query = instrumentSearch.value.trim().toLowerCase()
    if (!query) return instruments.value
    return instruments.value.filter(i => i.name.toLowerCase().includes(query))
})

// Computed Counts
const activeGenresCount = computed(() => genres.value.filter(g => g.active).length)
const inactiveGenresCount = computed(() => genres.value.filter(g => !g.active).length)
const activeInstrumentsCount = computed(() => instruments.value.filter(i => i.active).length)
const inactiveInstrumentsCount = computed(() => instruments.value.filter(i => !i.active).length)

// Fetch Tags from Database
const fetchTags = async () => {
    isLoadingTags.value = true
    try {
        const [genreRes, instRes] = await Promise.all([
            db.from('TAG_GENRE').select('Genre_ID, Name, Is_active').order('Name', { ascending: true }),
            db.from('TAG_INSTRUMENT').select('Instrument_ID, Name, Is_active').order('Name', { ascending: true })
        ])

        if (genreRes.error) throw genreRes.error
        if (instRes.error) throw instRes.error

        genres.value = (genreRes.data || []).map((g: any) => ({
            id: g.Genre_ID,
            name: g.Name,
            active: !!g.Is_active,
            type: 'Genre' as const
        }))

        instruments.value = (instRes.data || []).map((i: any) => ({
            id: i.Instrument_ID,
            name: i.Name,
            active: !!i.Is_active,
            type: 'Instrument' as const
        }))
    } catch (err: any) {
        console.error('Error fetching tags:', err)
        showNotification(err.message || 'Failed to load tags from database', 'error')
    } finally {
        isLoadingTags.value = false
    }
}

// Modal Actions
const openAddModal = (type: 'Genre' | 'Instrument') => {
    targetTagType.value = type
    modalType.value = 'add'
    formTagName.value = ''
    formTagActive.value = true
    formErrorMessage.value = null
    showModal.value = true
}

const openEditModal = (tag: TagItem) => {
    editingTag.value = tag
    targetTagType.value = tag.type
    modalType.value = 'edit'
    formTagName.value = tag.name
    formTagActive.value = tag.active
    formErrorMessage.value = null
    showModal.value = true
}

const openDeleteModal = (tag: TagItem) => {
    editingTag.value = tag
    modalType.value = 'delete'
    formErrorMessage.value = null
    showModal.value = true
}

const closeModal = () => {
    showModal.value = false
    editingTag.value = null
    formErrorMessage.value = null
}

const saveModal = async () => {
    const trimmedName = formTagName.value.trim().toUpperCase()
    if (modalType.value !== 'delete' && !trimmedName) return

    isSavingTag.value = true
    formErrorMessage.value = null

    try {
        if (modalType.value === 'add') {
            const tableName = targetTagType.value === 'Genre' ? 'TAG_GENRE' : 'TAG_INSTRUMENT'
            const idCol = targetTagType.value === 'Genre' ? 'Genre_ID' : 'Instrument_ID'

            // Duplicate check locally
            const list = targetTagType.value === 'Genre' ? genres.value : instruments.value
            const existsLocally = list.some(t => t.name.toLowerCase() === trimmedName.toLowerCase())
            if (existsLocally) {
                formErrorMessage.value = 'Tag is already present'
                isSavingTag.value = false
                return
            }

            const { data, error } = await db
                .from(tableName)
                .insert({ 
                    Name: trimmedName, 
                    Normalized_Name: trimmedName.toLowerCase().replace(/\s+/g, ' '),
                    Is_active: formTagActive.value 
                })
                .select()
                .single()

            if (error) throw error

            const newTag: TagItem = {
                id: data[idCol],
                name: data.Name,
                active: !!data.Is_active,
                type: targetTagType.value
            }

            if (targetTagType.value === 'Genre') {
                genres.value.push(newTag)
                genres.value.sort((a, b) => a.name.localeCompare(b.name))
            } else {
                instruments.value.push(newTag)
                instruments.value.sort((a, b) => a.name.localeCompare(b.name))
            }

            showNotification(`Added ${targetTagType.value} "${trimmedName}"`)
            closeModal()
        } else if (modalType.value === 'edit' && editingTag.value) {
            const tableName = editingTag.value.type === 'Genre' ? 'TAG_GENRE' : 'TAG_INSTRUMENT'
            const idCol = editingTag.value.type === 'Genre' ? 'Genre_ID' : 'Instrument_ID'

            // Check if renaming to an existing name (different tag)
            const list = editingTag.value.type === 'Genre' ? genres.value : instruments.value
            const duplicate = list.find(t => t.id !== editingTag.value!.id && t.name.toLowerCase() === trimmedName.toLowerCase())
            if (duplicate) {
                formErrorMessage.value = 'Tag is already present'
                isSavingTag.value = false
                return
            }

            const { error } = await db
                .from(tableName)
                .update({ 
                    Name: trimmedName, 
                    Normalized_Name: trimmedName.toLowerCase().replace(/\s+/g, ' '),
                    Is_active: formTagActive.value 
                })
                .eq(idCol, editingTag.value.id)

            if (error) throw error

            editingTag.value.name = trimmedName
            editingTag.value.active = formTagActive.value
            showNotification(`Updated ${editingTag.value.type} "${trimmedName}"`)
            closeModal()
        } else if (modalType.value === 'delete' && editingTag.value) {
            const tableName = editingTag.value.type === 'Genre' ? 'TAG_GENRE' : 'TAG_INSTRUMENT'
            const idCol = editingTag.value.type === 'Genre' ? 'Genre_ID' : 'Instrument_ID'
            const deletedName = editingTag.value.name
            const deletedType = editingTag.value.type

            const { error } = await db
                .from(tableName)
                .delete()
                .eq(idCol, editingTag.value.id)

            if (error) throw error

            if (deletedType === 'Genre') {
                genres.value = genres.value.filter(g => g.id !== editingTag.value!.id)
            } else {
                instruments.value = instruments.value.filter(i => i.id !== editingTag.value!.id)
            }

            showNotification(`Deleted ${deletedType} "${deletedName}"`)
            closeModal()
        }
    } catch (err: any) {
        console.error('Error saving tag:', err)
        if (err.message?.includes('duplicate') || err.code === '23505') {
            formErrorMessage.value = 'Tag is already present'
        } else {
            formErrorMessage.value = err.message || 'Operation failed. Please try again.'
        }
    } finally {
        isSavingTag.value = false
    }
}

// User Submissions / Suggested Tags State with Grouping
export interface RequesterInfo {
    id: string
    name: string
    email: string
    avatar: string | null
    initials: string
    dateRequested: string
    requestId: string
}

export interface GroupedTagRequest {
    key: string
    tagId: string | null
    tagName: string
    normalizedName: string
    type: 'Genre' | 'Instrument'
    requestCount: number
    requesters: RequesterInfo[]
    status: 'Pending' | 'Accepted' | 'Rejected'
    latestDate: string
    requestIds: string[]
}

const groupedRequests = ref<GroupedTagRequest[]>([])
const isLoadingRequests = ref(true)
const isProcessingAction = ref<string | null>(null)
const selectedGroupKeys = ref<string[]>([])

// Edit Spelling Modal for Requested Tags
const showEditSpellingModal = ref(false)
const editingSpellingTag = ref<GroupedTagRequest | null>(null)
const formSpellingNewName = ref('')
const isSavingSpelling = ref(false)
const spellingErrorMessage = ref<string | null>(null)

// Pagination State for User Submissions
const submissionsPage = ref(1)
const submissionsPageSize = ref(10)

const paginatedSubmissions = computed(() => {
    const start = (submissionsPage.value - 1) * submissionsPageSize.value
    return groupedRequests.value.slice(start, start + submissionsPageSize.value)
})

watch(submissionsPageSize, () => {
    submissionsPage.value = 1
})

// Fetch Suggested Tags from TAG_REQUEST
const fetchSuggestedTags = async () => {
    isLoadingRequests.value = true
    try {
        const { data, error } = await db
            .from('TAG_REQUEST')
            .select(`
                Request_ID,
                Tag_Name,
                Normalized_Name,
                Type,
                Status,
                Created_at,
                Genre_ID,
                Instrument_ID,
                USER_ACCOUNT (
                    ACCOUNT_ID,
                    Username,
                    Email,
                    Profile_Picture
                )
            `)
            .order('Created_at', { ascending: false })

        if (error) {
            console.warn('TAG_REQUEST query info:', error.message)
            return
        }

        if (data) {
            const groupsMap = new Map<string, GroupedTagRequest>()

            for (const item of data) {
                const type = (item.Type || 'Genre') as 'Genre' | 'Instrument'
                const tagId = (type === 'Genre' ? item.Genre_ID : item.Instrument_ID) || null
                const rawName = item.Tag_Name || 'Untitled Tag'
                const normalized = (item.Normalized_Name || rawName.trim().toLowerCase().replace(/\s+/g, ' '))
                const groupKey = `${type}_${tagId || normalized}`

                const user = item.USER_ACCOUNT
                const userName = user?.Username || 'Anonymous User'
                const initials = userName.slice(0, 2).toUpperCase()
                const avatar = user?.Profile_Picture || null
                const formatDate = (dateStr: string) => {
                    if (!dateStr) return 'Recent'
                    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                }

                const requester: RequesterInfo = {
                    id: user?.ACCOUNT_ID || item.Request_ID,
                    name: userName,
                    email: user?.Email || 'No email',
                    avatar,
                    initials,
                    dateRequested: formatDate(item.Created_at),
                    requestId: item.Request_ID
                }

                if (!groupsMap.has(groupKey)) {
                    groupsMap.set(groupKey, {
                        key: groupKey,
                        tagId,
                        tagName: rawName,
                        normalizedName: normalized,
                        type,
                        requestCount: 1,
                        requesters: [requester],
                        status: (item.Status as any) || 'Pending',
                        latestDate: formatDate(item.Created_at),
                        requestIds: [item.Request_ID]
                    })
                } else {
                    const existing = groupsMap.get(groupKey)!
                    existing.requestCount += 1
                    existing.requestIds.push(item.Request_ID)
                    if (!existing.requesters.some(r => r.id === requester.id)) {
                        existing.requesters.push(requester)
                    }
                    if (item.Status === 'Pending' && existing.status !== 'Pending') {
                        existing.status = 'Pending'
                    }
                }
            }

            groupedRequests.value = Array.from(groupsMap.values())
        }
    } catch (err: any) {
        console.error('Error fetching suggested tags:', err)
    } finally {
        isLoadingRequests.value = false
    }
}

const pendingCount = computed(() => {
    return groupedRequests.value.filter(g => g.status === 'Pending').length
})

const isAllSelected = computed(() => {
    const pending = groupedRequests.value.filter(g => g.status === 'Pending')
    return pending.length > 0 && selectedGroupKeys.value.length === pending.length
})

const toggleSelectAll = () => {
    const pending = groupedRequests.value.filter(g => g.status === 'Pending')
    if (selectedGroupKeys.value.length === pending.length) {
        selectedGroupKeys.value = []
    } else {
        selectedGroupKeys.value = pending.map(g => g.key)
    }
}

// Open Edit Spelling Modal
const openEditSpellingModal = (group: GroupedTagRequest) => {
    editingSpellingTag.value = group
    formSpellingNewName.value = group.tagName
    spellingErrorMessage.value = null
    showEditSpellingModal.value = true
}

const closeEditSpellingModal = () => {
    showEditSpellingModal.value = false
    editingSpellingTag.value = null
    spellingErrorMessage.value = null
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
        const session = (await supabase.auth.getSession()).data.session
        const headers: Record<string, string> = {}
        if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`
        }
        return headers
    } catch {
        return {}
    }
}

const saveEditSpelling = async () => {
    if (!editingSpellingTag.value || !formSpellingNewName.value.trim()) return
    const trimmed = formSpellingNewName.value.trim().toUpperCase()
    isSavingSpelling.value = true
    spellingErrorMessage.value = null

    try {
        const headers = await getAuthHeaders()
        if (editingSpellingTag.value.tagId) {
            await $fetch('/api/tags/edit-spelling', {
                method: 'POST',
                headers,
                body: {
                    tagId: editingSpellingTag.value.tagId,
                    tagType: editingSpellingTag.value.type,
                    newName: trimmed
                }
            })
        } else {
            await db
                .from('TAG_REQUEST')
                .update({
                    Tag_Name: trimmed,
                    Normalized_Name: trimmed.toLowerCase().replace(/\s+/g, ' ')
                })
                .in('Request_ID', editingSpellingTag.value.requestIds)
        }

        showNotification(`Updated tag spelling to "${trimmed}"`)
        closeEditSpellingModal()
        await Promise.all([fetchTags(), fetchSuggestedTags()])
    } catch (err: any) {
        console.error('Error saving spelling:', err)
        spellingErrorMessage.value = err.data?.statusMessage || err.message || 'Tag is already present'
    } finally {
        isSavingSpelling.value = false
    }
}

const acceptGroup = async (group: GroupedTagRequest) => {
    isProcessingAction.value = group.key
    try {
        const headers = await getAuthHeaders()
        await $fetch('/api/tags/accept', {
            method: 'POST',
            headers,
            body: {
                tagId: group.tagId,
                tagType: group.type,
                requestId: group.requestIds[0],
                requestIds: group.requestIds
            }
        })

        group.status = 'Accepted'
        selectedGroupKeys.value = selectedGroupKeys.value.filter(k => k !== group.key)
        showNotification(`Accepted "${group.tagName}" and added to ${group.type} tags`)
        await Promise.all([fetchTags(), fetchSuggestedTags()])
    } catch (err: any) {
        console.error('Error accepting tag:', err)
        showNotification(err.data?.statusMessage || err.message || 'Failed to accept tag', 'error')
    } finally {
        isProcessingAction.value = null
    }
}

const rejectGroup = async (group: GroupedTagRequest) => {
    isProcessingAction.value = group.key
    try {
        const headers = await getAuthHeaders()
        await $fetch('/api/tags/reject', {
            method: 'POST',
            headers,
            body: {
                tagId: group.tagId,
                tagType: group.type,
                requestId: group.requestIds[0],
                requestIds: group.requestIds
            }
        })

        group.status = 'Rejected'
        selectedGroupKeys.value = selectedGroupKeys.value.filter(k => k !== group.key)
        showNotification(`Rejected "${group.tagName}"`)
        await Promise.all([fetchTags(), fetchSuggestedTags()])
    } catch (err: any) {
        console.error('Error rejecting tag:', err)
        showNotification(err.data?.statusMessage || err.message || 'Failed to reject tag', 'error')
    } finally {
        isProcessingAction.value = null
    }
}

const acceptSelected = async () => {
    const keys = [...selectedGroupKeys.value]
    for (const key of keys) {
        const grp = groupedRequests.value.find(g => g.key === key)
        if (grp && grp.status === 'Pending') {
            await acceptGroup(grp)
        }
    }
}

const rejectSelected = async () => {
    const keys = [...selectedGroupKeys.value]
    for (const key of keys) {
        const grp = groupedRequests.value.find(g => g.key === key)
        if (grp && grp.status === 'Pending') {
            await rejectGroup(grp)
        }
    }
}

onMounted(async () => {
    await Promise.all([
        fetchTags(),
        fetchSuggestedTags()
    ])
})
</script>

<template>
    <div>
        <!-- Toast Notification -->
        <transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="transform -translate-y-2 opacity-0"
            enter-to-class="transform translate-y-0 opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0">
            <div v-if="notificationMessage" 
                class="fixed top-24 right-8 z-50 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border text-sm font-medium backdrop-blur-md"
                :class="notificationMessage.type === 'success' 
                    ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-950/90 border-rose-500/40 text-rose-300'">
                <Icon :name="notificationMessage.type === 'success' ? 'ic:baseline-check-circle' : 'ic:baseline-error'" class="text-xl shrink-0" />
                <span>{{ notificationMessage.text }}</span>
                <button @click="notificationMessage = null" class="ml-2 hover:opacity-75 cursor-pointer">
                    <Icon name="ic:baseline-close" class="text-base" />
                </button>
            </div>
        </transition>

        <nav
            class="flex items-center px-16 h-20 border-b border-[#46464D] top-0 sticky backdrop-blur-3xl z-10">
            <h1 class="text-[#D0D4F7] text-lg sm:text-[24px] font-medium tracking-tight">Welcome Back Admin!</h1>
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
                        <button 
                            @click="openAddModal('Genre')" 
                            class="flex items-center justify-center w-9 h-9 bg-[#D0D4F7] hover:bg-[#B0B4D7] rounded-full transition cursor-pointer shadow"
                            title="Add new genre tag">
                            <Icon name="ic:baseline-plus" class="text-2xl text-[#2A2F4A]" />
                        </button>
                    </div>

                    <!-- Genre Search -->
                    <div class="relative">
                        <Icon name="ic:baseline-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg pointer-events-none" />
                        <input 
                            v-model="genreSearch"
                            type="text" 
                            placeholder="Search genres..." 
                            class="w-full bg-[#141416] border border-[#2A2A2E] rounded-lg pl-10 pr-10 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#D0D4F7] transition-colors placeholder:text-zinc-600"
                        />
                        <button 
                            v-if="genreSearch"
                            @click="genreSearch = ''"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded cursor-pointer"
                            title="Clear search">
                            <Icon name="ic:baseline-close" class="text-base" />
                        </button>
                    </div>

                    <!-- Search Result Count / Clear Link -->
                    <div v-if="genreSearch.trim()" class="text-xs text-zinc-400 flex items-center justify-between px-1">
                        <span>Found {{ filteredGenres.length }} match{{ filteredGenres.length === 1 ? '' : 'es' }}</span>
                        <button @click="genreSearch = ''" class="text-[#D0D4F7] hover:underline cursor-pointer">Clear search</button>
                    </div>

                    <!-- Loading Skeletons -->
                    <div v-if="isLoadingTags" class="flex flex-col gap-2 pt-2">
                        <div v-for="n in 4" :key="n" class="h-12 bg-[#242428]/60 border border-zinc-700/30 rounded-lg animate-pulse"></div>
                    </div>

                    <!-- Empty State -->
                    <div v-else-if="filteredGenres.length === 0" class="py-10 text-center flex flex-col items-center justify-center gap-2 text-zinc-500">
                        <Icon name="ic:baseline-search-off" class="text-3xl text-zinc-600" />
                        <p class="text-sm">
                            {{ genreSearch ? `No genres match "${genreSearch}"` : 'No genre tags created yet.' }}
                        </p>
                        <button v-if="genreSearch" @click="genreSearch = ''" class="text-xs text-[#D0D4F7] hover:underline cursor-pointer">Reset search</button>
                    </div>

                    <!-- Genres List -->
                    <div v-else class="flex flex-col gap-2 pt-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
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
                                <button 
                                    @click="openEditModal(genre)" 
                                    class="flex p-1.5 text-zinc-400 hover:text-[#D0D4F7] hover:bg-[#D0D4F7]/10 rounded-md transition cursor-pointer"
                                    title="Edit tag">
                                    <Icon name="ic:baseline-edit" class="text-lg" />
                                </button>
                                <button 
                                    @click="openDeleteModal(genre)" 
                                    class="flex p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition cursor-pointer"
                                    title="Delete tag">
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
                        <button 
                            @click="openAddModal('Instrument')" 
                            class="flex items-center justify-center w-9 h-9 bg-[#D0D4F7] hover:bg-[#B0B4D7] rounded-full transition cursor-pointer shadow"
                            title="Add new instrument tag">
                            <Icon name="ic:baseline-plus" class="text-2xl text-[#2A2F4A]" />
                        </button>
                    </div>

                    <!-- Instrument Search -->
                    <div class="relative">
                        <Icon name="ic:baseline-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg pointer-events-none" />
                        <input 
                            v-model="instrumentSearch"
                            type="text" 
                            placeholder="Search instruments..." 
                            class="w-full bg-[#141416] border border-[#2A2A2E] rounded-lg pl-10 pr-10 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#D0D4F7] transition-colors placeholder:text-zinc-600"
                        />
                        <button 
                            v-if="instrumentSearch"
                            @click="instrumentSearch = ''"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded cursor-pointer"
                            title="Clear search">
                            <Icon name="ic:baseline-close" class="text-base" />
                        </button>
                    </div>

                    <!-- Search Result Count / Clear Link -->
                    <div v-if="instrumentSearch.trim()" class="text-xs text-zinc-400 flex items-center justify-between px-1">
                        <span>Found {{ filteredInstruments.length }} match{{ filteredInstruments.length === 1 ? '' : 'es' }}</span>
                        <button @click="instrumentSearch = ''" class="text-[#D0D4F7] hover:underline cursor-pointer">Clear search</button>
                    </div>

                    <!-- Loading Skeletons -->
                    <div v-if="isLoadingTags" class="flex flex-col gap-2 pt-2">
                        <div v-for="n in 4" :key="n" class="h-12 bg-[#242428]/60 border border-zinc-700/30 rounded-lg animate-pulse"></div>
                    </div>

                    <!-- Empty State -->
                    <div v-else-if="filteredInstruments.length === 0" class="py-10 text-center flex flex-col items-center justify-center gap-2 text-zinc-500">
                        <Icon name="ic:baseline-search-off" class="text-3xl text-zinc-600" />
                        <p class="text-sm">
                            {{ instrumentSearch ? `No instruments match "${instrumentSearch}"` : 'No instrument tags created yet.' }}
                        </p>
                        <button v-if="instrumentSearch" @click="instrumentSearch = ''" class="text-xs text-[#D0D4F7] hover:underline cursor-pointer">Reset search</button>
                    </div>

                    <!-- Instruments List -->
                    <div v-else class="flex flex-col gap-2 pt-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
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
                                <button 
                                    @click="openEditModal(instrument)" 
                                    class="flex p-1.5 text-zinc-400 hover:text-[#D0D4F7] hover:bg-[#D0D4F7]/10 rounded-md transition cursor-pointer"
                                    title="Edit tag">
                                    <Icon name="ic:baseline-edit" class="text-lg" />
                                </button>
                                <button 
                                    @click="openDeleteModal(instrument)" 
                                    class="flex p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition cursor-pointer"
                                    title="Delete tag">
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
                        <h2 class="text-zinc-400 text-sm font-light">Review community submitted tags and request volume</h2>
                    </div>

                    <div v-if="selectedGroupKeys.length > 0" class="flex items-center gap-3">
                        <span class="text-xs text-zinc-300 font-medium">{{ selectedGroupKeys.length }} tag(s) selected</span>
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
                                    TAG NAME</th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    TYPE</th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    REQUEST COUNT</th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    REQUESTED BY</th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    LATEST REQUEST</th>
                                <th class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase text-right">
                                    ACTIONS</th>
                            </tr>
                        </thead>

                        <!-- Loading State -->
                        <tbody v-if="isLoadingRequests" class="bg-[#18181b]">
                            <tr v-for="n in 3" :key="n" class="border-t border-zinc-800">
                                <td colspan="7" class="px-6 py-4">
                                    <div class="h-8 bg-zinc-800/40 rounded animate-pulse"></div>
                                </td>
                            </tr>
                        </tbody>

                        <!-- Empty State -->
                        <tbody v-else-if="groupedRequests.length === 0" class="bg-[#18181b]">
                            <tr class="border-t border-zinc-800">
                                <td colspan="7" class="px-6 py-12 text-center text-zinc-500">
                                    <Icon name="ic:baseline-inbox" class="text-3xl text-zinc-600 mb-2 mx-auto" />
                                    <p class="text-sm font-medium">No user tag submissions yet.</p>
                                    <p class="text-xs text-zinc-600 mt-1">When artists or users request custom tags from their profile details, they will appear here grouped with counter statistics.</p>
                                </td>
                            </tr>
                        </tbody>

                        <!-- Table Body -->
                        <tbody v-else class="bg-[#18181b]">
                            <tr v-for="item in paginatedSubmissions" :key="item.key"
                                class="border-t border-zinc-800 hover:bg-[#1f1f23] transition-colors"
                                :class="{ 'bg-[#222228]/70': selectedGroupKeys.includes(item.key) }">

                                <!-- Checkbox -->
                                <td class="px-6 py-4 align-top">
                                    <input 
                                        type="checkbox" 
                                        :value="item.key" 
                                        v-model="selectedGroupKeys"
                                        :disabled="item.status !== 'Pending'"
                                        class="w-4 h-4 rounded bg-[#18181b] border-zinc-700 text-[#D0D4F7] accent-[#D0D4F7] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-1" />
                                </td>

                                <!-- Tag Name -->
                                <td class="px-6 py-4 align-top">
                                    <div class="flex items-center gap-2">
                                        <span class="text-base font-semibold text-zinc-100">{{ item.tagName }}</span>
                                    </div>
                                </td>

                                <!-- Type -->
                                <td class="px-6 py-4 align-top">
                                    <span
                                        class="inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full"
                                        :class="item.type === 'Genre' 
                                            ? 'text-[#D0D4F7] bg-[#D0D4F7]/10 border border-[#D0D4F7]/25' 
                                            : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25'">
                                        {{ item.type }}
                                    </span>
                                </td>

                                <!-- Universal Request Count -->
                                <td class="px-6 py-4 align-top">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D0D4F7]/15 text-[#D0D4F7] border border-[#D0D4F7]/30">
                                        <Icon name="ic:baseline-people" class="text-sm" />
                                        <span>{{ item.requestCount }} request{{ item.requestCount === 1 ? '' : 's' }}</span>
                                    </span>
                                </td>

                                <!-- Requesters: flex col with name and email -->
                                <td class="px-6 py-4 align-top">
                                    <div class="flex flex-col gap-2.5 max-h-36 overflow-y-auto pr-1">
                                        <div v-for="user in item.requesters" :key="user.id" class="flex items-center gap-2.5">
                                            <!-- Initials fallback (No placeholder image URL) -->
                                            <img v-if="user.avatar" :src="user.avatar" :alt="user.name"
                                                class="w-8 h-8 rounded-full object-cover shrink-0 border border-zinc-700" />
                                            <div v-else class="w-8 h-8 rounded-full bg-[#2A2F4A] border border-[#D0D4F7]/30 text-[#D0D4F7] flex items-center justify-center font-bold text-xs shrink-0">
                                                {{ user.initials }}
                                            </div>
                                            <!-- Artist/User Name and Email in flex col -->
                                            <div class="flex flex-col min-w-0">
                                                <span class="text-sm font-medium text-zinc-100 truncate">{{ user.name }}</span>
                                                <span class="text-xs text-zinc-400 truncate">{{ user.email }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <!-- Latest Date Requested -->
                                <td class="px-6 py-4 align-top text-sm text-zinc-300 whitespace-nowrap">
                                    {{ item.latestDate }}
                                </td>

                                <!-- Actions -->
                                <td class="px-6 py-4 align-top text-right">
                                    <div v-if="item.status === 'Pending'" class="flex items-center justify-end gap-2 flex-wrap">
                                        <!-- Edit Spelling Button -->
                                        <button 
                                            @click="openEditSpellingModal(item)"
                                            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2A2A2E] hover:bg-[#343438] text-zinc-300 hover:text-white border border-zinc-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                                            title="Edit tag spelling">
                                            <Icon name="ic:baseline-edit" class="text-sm text-[#D0D4F7]" />
                                            <span>Edit</span>
                                        </button>
                                        <!-- Accept Tag Button -->
                                        <button 
                                            @click="acceptGroup(item)"
                                            :disabled="isProcessingAction === item.key"
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                                            title="Accept and activate tag">
                                            <Icon :name="isProcessingAction === item.key ? 'ic:baseline-sync' : 'ic:baseline-check'" 
                                                class="text-base" 
                                                :class="{ 'animate-spin': isProcessingAction === item.key }" />
                                            <span>Accept</span>
                                        </button>
                                        <!-- Reject Tag Button -->
                                        <button 
                                            @click="rejectGroup(item)"
                                            :disabled="isProcessingAction === item.key"
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                                            title="Reject request">
                                            <Icon name="ic:baseline-close" class="text-base" />
                                            <span>Reject</span>
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
                <AdminPagination 
                    v-model:currentPage="submissionsPage" 
                    v-model:pageSize="submissionsPageSize" 
                    :totalItems="groupedRequests.length" 
                    itemLabel="requested tags" 
                />
            </div>
        </main>

        <!-- Modal Overlay -->
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div class="bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                
                <!-- Header -->
                <div class="px-6 py-4 border-b border-[#2A2A2E] flex justify-between items-center">
                    <h2 class="text-lg font-bold text-zinc-100">
                        {{ modalType === 'add' ? `Add New ${targetTagType}` : (modalType === 'edit' ? `Edit ${targetTagType}` : `Delete ${editingTag?.type || targetTagType}`) }}
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
                            class="w-full bg-[#141416] border border-[#2A2A2E] rounded-lg px-4 py-2.5 text-zinc-100 uppercase focus:outline-none focus:border-[#D0D4F7] transition-colors placeholder:text-zinc-600"
                            placeholder="e.g. DREAM POP • MIDI CONTROLLER"
                            @keydown.enter.prevent="saveModal"
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

                    <!-- Error Alert -->
                    <div v-if="formErrorMessage" class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                        <Icon name="ic:baseline-warning" class="text-base shrink-0" />
                        <span>{{ formErrorMessage }}</span>
                    </div>
                </div>

                <!-- Body Delete -->
                <div v-if="modalType === 'delete'" class="p-6 flex flex-col gap-4">
                    <p class="text-zinc-300 text-sm">
                        Are you sure you want to delete the tag <span class="font-bold text-white">"{{ editingTag?.name }}"</span>? This action cannot be undone.
                    </p>
                    
                    <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300/90 text-xs flex items-start gap-2">
                        <Icon name="ic:baseline-info" class="text-base shrink-0 mt-0.5 text-amber-400" />
                        <span>Tip: Deleting a tag cascades and removes it from user preferences and artist profiles. To safely hide it from selection instead, toggle its status to <strong>Inactive</strong>.</span>
                    </div>

                    <!-- Error Alert -->
                    <div v-if="formErrorMessage" class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                        <Icon name="ic:baseline-warning" class="text-base shrink-0" />
                        <span>{{ formErrorMessage }}</span>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 bg-[#141416]/50 border-t border-[#2A2A2E] flex justify-end gap-3">
                    <button 
                        @click="closeModal"
                        :disabled="isSavingTag"
                        class="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50">
                        Cancel
                    </button>
                    <button 
                        v-if="modalType !== 'delete'"
                        @click="saveModal"
                        :disabled="!formTagName.trim() || isSavingTag"
                        class="px-4 py-2 bg-[#D0D4F7] text-[#2A2F4A] hover:bg-[#B0B4D7] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2">
                        <Icon v-if="isSavingTag" name="ic:baseline-sync" class="animate-spin text-base" />
                        <span>{{ isSavingTag ? 'Saving...' : 'Save Tag' }}</span>
                    </button>
                    <button 
                        v-if="modalType === 'delete'"
                        @click="saveModal"
                        :disabled="isSavingTag"
                        class="px-4 py-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50">
                        <Icon v-if="isSavingTag" name="ic:baseline-sync" class="animate-spin text-base" />
                        <span>{{ isSavingTag ? 'Deleting...' : 'Delete' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Edit Spelling Modal for Requested / Custom Tags -->
        <div v-if="showEditSpellingModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div class="bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="px-6 py-4 border-b border-[#2A2A2E] flex justify-between items-center">
                    <h2 class="text-lg font-bold text-zinc-100">
                        Correct Tag Spelling
                    </h2>
                    <button @click="closeEditSpellingModal" class="text-zinc-400 hover:text-white transition cursor-pointer">
                        <Icon name="ic:baseline-close" class="text-xl" />
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6 flex flex-col gap-4">
                    <div class="p-3 bg-[#242428] border border-zinc-700/60 rounded-lg text-xs text-zinc-300">
                        <span class="font-semibold text-[#D0D4F7]">Persistent Unique ID Notice:</span>
                        Correcting this tag's spelling maintains its unique ID so all {{ editingSpellingTag?.requestCount || 1 }} artist/user requester(s) remain seamlessly linked without breaking.
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-300">Correct Tag Name</label>
                        <input 
                            v-model="formSpellingNewName"
                            type="text" 
                            class="w-full bg-[#141416] border border-[#2A2A2E] rounded-lg px-4 py-2.5 text-zinc-100 uppercase focus:outline-none focus:border-[#D0D4F7] transition-colors placeholder:text-zinc-600"
                            placeholder="ENTER CORRECTED TAG NAME..."
                            @keydown.enter.prevent="saveEditSpelling"
                        />
                    </div>

                    <!-- Error Alert -->
                    <div v-if="spellingErrorMessage" class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                        <Icon name="ic:baseline-warning" class="text-base shrink-0" />
                        <span>{{ spellingErrorMessage }}</span>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 bg-[#141416]/50 border-t border-[#2A2A2E] flex justify-end gap-3">
                    <button 
                        @click="closeEditSpellingModal"
                        :disabled="isSavingSpelling"
                        class="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50">
                        Cancel
                    </button>
                    <button 
                        @click="saveEditSpelling"
                        :disabled="!formSpellingNewName.trim() || isSavingSpelling"
                        class="px-4 py-2 bg-[#D0D4F7] text-[#2A2F4A] hover:bg-[#B0B4D7] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2">
                        <Icon v-if="isSavingSpelling" name="ic:baseline-sync" class="animate-spin text-base" />
                        <span>{{ isSavingSpelling ? 'Saving...' : 'Update Spelling' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>