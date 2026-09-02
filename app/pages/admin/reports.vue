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
</script>

<template>
        <div>
            <nav class="flex items-center px-16 h-20 border-be border-default border-[#46464D] top-0 sticky backdrop-blur-3xl z-10">
                <h1 class="text-[#D0D4F7] text-[24px] font-medium">Welcome Back Admin!</h1>
            </nav>
            <main class="p-16">
            </main>
        </div>
</template>