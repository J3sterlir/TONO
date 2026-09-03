<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()
const supabase = useSupabaseClient()

const adminProfile = await fetchCurrentAdmin()
const users = ref<any[]>([])
const isLoading = ref(true)

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
                ARTIST (
                    *,
                    SOLO_ARTIST (*),
                    BAND (*)
                ),
                BUSINESS_PROFILE (*)
            `)

        if (error) throw error

        if (usersData) {
            users.value = usersData.map((row: any) => {
                let role = 'User'
                if (row.ARTIST && row.ARTIST.length > 0) role = 'Artist'
                else if (row.BUSINESS_PROFILE && row.BUSINESS_PROFILE.length > 0) role = 'Business'

                let status = 'Active'
                if (row.Is_Banned) status = 'Banned'
                else if (role === 'Artist' && row.ARTIST[0].Status === 'Pending') status = 'Pending'
                else if (role === 'Artist' && row.ARTIST[0].Status === 'Rejected') status = 'Rejected'

                const formatDate = (dateStr: string) => {
                    if (!dateStr) return 'Unknown'
                    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                }

                return {
                    id: row.ACCOUNT_ID,
                    name: row.Username || 'Unknown',
                    email: row.Email || 'Unknown',
                    avatar: row.Profile_Picture || `https://placehold.co/100x100/332244/FFF?text=${(row.Username || 'U').charAt(0)}`,
                    role,
                    status,
                    isBanned: !!row.Is_Banned,
                    joinDate: formatDate(row.Created_at),
                    originalData: row
                }
            })
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
        u.email.toLowerCase().includes(query) || 
        u.id.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
    )
})

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

                <div class="w-full mx-auto overflow-hidden border border-zinc-800 rounded-xl">
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
                            <tr v-for="user in filteredUsers" :key="user.id"
                                class="border-t border-zinc-800 hover:bg-[#1f1f23] transition-colors">
                                <!-- profile cell -->
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-4">
                                        <img :src="user.avatar" :alt="user.name" class="w-12 h-12 rounded-lg object-cover shadow-sm" />
                                        <div class="flex flex-col">
                                            <span class="text-base font-medium text-zinc-100">{{ user.name }}</span>
                                            <span class="text-sm text-zinc-400">{{ user.email }}</span>
                                            <span class="text-xs text-zinc-600 font-mono">{{ user.id }}</span>
                                        </div>
                                    </div>
                                </td>

                                <!-- role -->
                                <td class="px-6 py-4">
                                    <span class="inline-flex items-center justify-center px-4 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/50 border border-zinc-700 rounded-full">
                                        {{ user.role }}
                                    </span>
                                </td>

                                <!-- Account Status -->
                                <td class="px-6 py-4">
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
                                <td class="px-6 py-4 text-sm text-zinc-300">
                                    {{ user.joinDate }}
                                </td>

                                <!-- Actions -->
                                <td class="px-6 py-4 text-right">
                                    <div class="flex items-center justify-end gap-2">
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