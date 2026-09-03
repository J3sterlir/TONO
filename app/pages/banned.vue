<script setup lang="ts">
definePageMeta({
    middleware: 'auth'
})

const supabase = useSupabaseClient()

const handleLogout = async () => {
    await supabase.auth.signOut()
    navigateTo('/Login')
}
</script>

<template>
    <div class="min-h-screen bg-[#121214] flex flex-col items-center justify-center p-6 text-center">
        <!-- Banned Modal -->
        <div class="max-w-md w-full bg-[#1E1E20] border border-red-500/30 p-8 rounded-xl shadow-2xl flex flex-col items-center gap-6">
            <div class="flex justify-center items-center bg-red-500/20 p-4 rounded-full">
                <Icon name="material-symbols:block" class="text-5xl text-red-500" />
            </div>
            
            <h1 class="text-3xl font-bold text-white">Account Suspended</h1>
            
            <p class="text-[#A0A0A5] leading-relaxed">
                Your account has been suspended for violating our community guidelines or terms of service.
            </p>

            <p class="text-[#A0A0A5] leading-relaxed">
                If you believe this action was taken in error, please contact our support team to appeal this decision.
            </p>

            <div class="flex gap-4 w-full mt-4">
                <button 
                    @click="handleLogout"
                    class="flex-1 cursor-pointer border border-[#3A3A3C] text-white font-semibold py-3 rounded-lg hover:bg-[#2A2A2C] transition">
                    Logout
                </button>
            </div>
        </div>
    </div>
</template>
