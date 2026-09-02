<script setup lang="ts">
/*
definePageMeta({
  middleware: 'admin'
})
*/
const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()
/*
const supabase = useSupabaseClient()
*/
const handleLogout = async () => {
    await signOutAdmin()
}

// the admin profile
const adminProfile = await fetchCurrentAdmin()

definePageMeta({ layout: 'admin' })

const users = [
    {
        id: 1,
        name: 'Elena Vance',
        email: 'elena.vance@tono.music',
        avatar: 'https://placehold.co/100x100/332244/FFF?text=EV',
        role: 'Artist',
        status: 'Active',
        joinDate: 'Oct 12, 2023'
    },
    {
        id: 2,
        name: 'Marcus Thorne',
        email: 'm.thorne@sonicpulse.com',
        avatar: 'https://placehold.co/100x100/443322/FFF?text=MT',
        role: 'Business',
        status: 'Active',
        joinDate: 'Nov 05, 2023'
    },
    {
        id: 3,
        name: 'Julian Chen',
        email: 'julian.chen@gmail.com',
        avatar: 'https://placehold.co/100x100/223344/FFF?text=JC',
        role: 'User',
        status: 'Banned',
        joinDate: 'Dec 20, 2023'
    },
    {
        id: 4,
        name: 'Sarah Jenkins',
        email: 'sarah.j@starlight.io',
        avatar: 'https://placehold.co/100x100/222/FFF?text=SJ',
        role: 'Artist',
        status: 'Active',
        joinDate: 'Jan 15, 2024'
    }
]

</script>

<template>
        <div>
            <nav class="flex items-center px-16 h-20 border-be border-default border-[#46464D] top-0 sticky backdrop-blur-3xl z-10">
                <h1 class="text-[#D0D4F7] text-[24px] font-medium">Welcome Back Admin!</h1>
            </nav>
            <main class="p-16">
                <div class="flex flex-col gap-6">

                    <div>
                        <h1 class="font-semibold text-[40px] ">User Directory</h1>
                        <h1 class="font-light text-[16px]">Manage platform users, verify artists, and manage user
                            santions.</h1>
                    </div>

                    <div class="bg-[#1C1C1F]/60 border border-[#2A2A2E] p-6 rounded-xl">
                        <div class="w-fit flex items-center justify-center">
                            <form action="/search" method="GET" class="relative group">
                                <div
                                    class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                                    <Icon name="ic:outline-search" class="absolute text-2xl text-[#ffffff]" />
                                </div>

                                <input type="search" name="q" placeholder="Search by name, email or ID..."
                                    class="w-101.5 py-2 pl-12 pr-5 bg-[#0E0E10] placeholder:text-[#6B7280] rounded-lg" />
                            </form>
                        </div>
                    </div>

                    <div class="w-full mx-auto overflow-hidden border border-zinc-800 rounded-xl">
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
                                    <th
                                        class="px-6 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase text-right">
                                        Actions</th>
                                </tr>
                            </thead>

                            <!-- Table Body -->
                            <tbody class="bg-[#18181b]">
                                <tr v-for="user in users" :key="user.id"
                                    class="border-t border-zinc-800 hover:bg-[#1f1f23] transition-colors">

                                    <!-- profile cell -->
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-4">
                                            <img :src="user.avatar" :alt="user.name"
                                                class="w-12 h-12 rounded-lg object-cover shadow-sm" />
                                            <div class="flex flex-col">
                                                <span class="text-base font-medium text-zinc-100">{{ user.name }}</span>
                                                <span class="text-sm text-zinc-400">{{ user.email }}</span>
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

                                    <!-- Account Statuz -->
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-2 text-sm font-medium"
                                            :class="user.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'">
                                            <!-- Status Dot -->
                                            <span class="w-2 h-2 rounded-full"
                                                :class="user.status === 'Active' ? 'bg-emerald-400' : 'bg-rose-400'">
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
                                        <!-- Insert action buttons HERE -->
                                    </td>

                                </tr>
                            </tbody>

                        </table>
                        <div class="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-[#18181b]">
                            <!-- Showing Results Text -->
                            <span class="text-sm text-zinc-300">
                                Showing 1 to 10 of 2,450 users
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

                                <!-- Inactive Pages -->
                                <button
                                    class="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors">
                                    2
                                </button>

                                <button
                                    class="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors">
                                    3
                                </button>

                                <!-- Ellipsis -->
                                <span class="px-1 text-sm text-zinc-400">...</span>

                                <!-- Next Button -->
                                <button
                                    class="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M9 5l7 7-7 7"></path>
                                    </svg>
                                </button>

                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
</template>