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

</script>

<template>
    <div class="min-h-screen bg-[#131315] text-white sm:ml-64 font-Sora">
        <aside id="logo-sidebar"
            class="fixed top-0 left-0 z-40 w-64 h-full transition-transform -translate-x-full sm:translate-x-0 bg-[#201F21]"
            aria-label="Sidebar">
            <div
                class="h-full flex flex-col justify-between w-[256px] p-6 overflow-y-auto bg-neutral-primary-soft border-e border-default border-[#46464D]">
                <div>
                    <div class="flex items-center gap-2 mb-12">
                        <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
                        <div>
                            <h1 class="text-xl font-bold">TONO</h1>
                            <h2 class="text-xl font-light text-[#D0D4F7]">ADMIN PANEL</h2>
                        </div>
                    </div>
                    <ul class="space-y-2">
                        <li>
                            <a @click="navigateTo('/admin/dashboard')"
                                class="flex cursor-pointer items-center px-2 py-1.5 text-body hover:bg-neutral-tertiary hover:text-fg-brand group">
                                <Icon name="ic:outline-dashboard" class="text-2xl text-[#C7C5CE]" />
                                <span class="ms-3">Dashboard</span>
                            </a>
                        </li>
                        <li>
                            <a @click="navigateTo('/admin/tags')"
                                class="flex cursor-pointer items-center px-2 py-1.5 text-body hover:bg-neutral-tertiary hover:text-fg-brand group">
                                <Icon name="ic:outline-label" class="text-2xl text-[#C7C5CE]" />
                                <span class="flex-1 ms-3 whitespace-nowrap">Tags</span>
                            </a>
                        </li>
                        <li>
                            <a @click="navigateTo('/admin/reports')"
                                class="flex font-bold cursor-pointer items-center px-2 py-1.5 text-body hover:bg-neutral-tertiary hover:text-fg-brand group bg-[#B4B8DA] rounded">
                                <Icon name="ic:baseline-flag" class="text-2xl text-[#444865]" />
                                <span class="flex-1 ms-3 whitespace-nowrap text-[#444865]">Reports</span>
                            </a>
                        </li>
                        <li>
                            <a @click="navigateTo('/admin/users')"
                                class="flex cursor-pointer items-center px-2 py-1.5 text-body hover:bg-neutral-tertiary hover:text-fg-brand group">
                                <Icon name="ic:outline-supervisor-account" class="text-2xl text-[#C7C5CE]" />
                                <span class="flex-1 ms-3 whitespace-nowrap">Users</span>
                            </a>
                        </li>
                    </ul>
                </div>
                <div>
                    <button @click="handleLogout"
                        class="flex items-center gap-2 px-2 py-1.5 text-body hover:bg-neutral-tertiary hover:text-fg-brand group w-full text-left">
                        <Icon name="ic:baseline-logout" class="text-2xl text-[#C7C5CE]" />
                        <span class="flex-1 ms-3 whitespace-nowrap">Logout</span>
                    </button>
                </div>
            </div>
        </aside>

        <div>
            <nav class="flex items-center px-16 h-20 border-be border-default border-[#46464D] top-0 sticky backdrop-blur-3xl z-10">
                <h1 class="text-[#D0D4F7] text-[24px] font-medium">Welcome Back Admin!</h1>
            </nav>
            <main class="p-16">
            </main>
        </div>
    </div>
</template>