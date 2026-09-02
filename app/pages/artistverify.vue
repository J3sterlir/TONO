<script setup lang="ts">
import { onMounted, ref } from 'vue'

definePageMeta({
    middleware: 'auth'
})

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile } = useTonoAuth()

const isRejected = ref(false)

const checkVerification = async () => {
    const profile = await fetchCurrentUserProfile()
    if (!profile) {
        navigateTo('/Login')
        return
    }

    if (profile?.artistProfile?.Is_Verified || profile?.artistProfile?.Status === 'Active') {
        navigateTo('/Artisthome')
    } else if (profile?.artistProfile?.Status === 'Rejected') {
        isRejected.value = true
    } else {
        isRejected.value = false
    }
}

const handleLogout = async () => {
    await supabase.auth.signOut()
    navigateTo('/Login')
}

onMounted(() => {
    checkVerification()
})
</script>

<template>
    <div class="min-h-screen bg-[#121214] flex flex-col items-center justify-center p-6 text-center">
        <!-- Rejected Modal -->
        <div v-if="isRejected" class="max-w-md w-full bg-[#1E1E20] border border-red-500/30 p-8 rounded-xl shadow-2xl flex flex-col items-center gap-6">
            <div class="flex justify-center items-center bg-red-500/20 p-4 rounded-full">
                <Icon name="material-symbols:cancel" class="text-5xl text-red-500" />
            </div>
            
            <h1 class="text-3xl font-bold text-white">Account Rejected</h1>
            
            <p class="text-[#A0A0A5] leading-relaxed">
                Unfortunately, your artist profile application has been rejected by our administrative team.
            </p>

            <p class="text-[#A0A0A5] leading-relaxed">
                If you believe this is a mistake, please contact support or try applying again at a later date.
            </p>

            <div class="flex gap-4 w-full mt-4">
                <button 
                    @click="handleLogout"
                    class="flex-1 cursor-pointer border border-[#3A3A3C] text-white font-semibold py-3 rounded-lg hover:bg-[#2A2A2C] transition">
                    Logout
                </button>
            </div>
        </div>

        <!-- Pending Modal -->
        <div v-else class="max-w-md w-full bg-[#1E1E20] border border-[#3A3A3C] p-8 rounded-xl shadow-2xl flex flex-col items-center gap-6">
            <div class="flex justify-center items-center bg-amber-500/20 p-4 rounded-full">
                <Icon name="material-symbols:pending-actions" class="text-5xl text-amber-500" />
            </div>
            
            <h1 class="text-3xl font-bold text-white">Pending Verification</h1>
            
            <p class="text-[#A0A0A5] leading-relaxed">
                Your artist profile has been submitted and is currently under review by our admin team. This process ensures the quality and legitimacy of artists on the platform.
            </p>

            <p class="text-[#A0A0A5] leading-relaxed">
                Please check back later. Once approved, you will have full access to your artist dashboard.
            </p>

            <div class="flex gap-4 w-full mt-4">
                <button 
                    @click="checkVerification"
                    class="flex-1 cursor-pointer bg-[#D0D4F7] text-[#121214] font-semibold py-3 rounded-lg hover:bg-[#B0B4D7] transition flex items-center justify-center gap-2">
                    <Icon name="material-symbols:refresh" class="text-xl" />
                    Refresh Status
                </button>
                <button 
                    @click="handleLogout"
                    class="flex-1 cursor-pointer border border-[#3A3A3C] text-white font-semibold py-3 rounded-lg hover:bg-[#2A2A2C] transition">
                    Logout
                </button>
            </div>
        </div>
    </div>
</template>
