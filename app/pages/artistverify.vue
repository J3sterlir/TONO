<script setup lang="ts">
import { onMounted, ref } from 'vue'

definePageMeta({
  middleware: [
    'auth',
    async (to) => {
      const supabase = useSupabaseClient()
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) return navigateTo('/Login')

      const { fetchCurrentUserProfile } = useTonoAuth()
      const profile = await fetchCurrentUserProfile(authData.user.id)
      if (!profile) return navigateTo('/Login')

      // Check if user is banned or suspended
      const isBanned = profile?.account?.Is_Banned === true
      const isSuspended =
        profile?.account?.Is_Suspended === true &&
        Boolean(profile?.account?.Suspended_Until) &&
        new Date(profile.account.Suspended_Until!).getTime() > Date.now()

      if (isBanned || isSuspended) {
        return navigateTo('/banned')
      }

      // If user is not an artist at all, redirect to their home
      if (!profile.artistProfile) {
        if (profile.businessProfile) {
          return navigateTo('/BusinessDash')
        }
        return navigateTo('/userhome')
      }

      // If artist is already verified or active, redirect to artist dashboard
      if (profile.artistProfile.Is_Verified || profile.artistProfile.Status === 'Active') {
        return navigateTo('/Artisthome')
      }
    }
  ]
})

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile } = useTonoAuth()

const isLoading = ref(true)
const isRejected = ref(false)
const isPending = ref(false)

const checkVerification = async () => {
  isLoading.value = true
  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    navigateTo('/Login')
    return
  }

  const profile = await fetchCurrentUserProfile(authData.user.id)
  if (!profile) {
    navigateTo('/Login')
    return
  }

  const isBanned = profile?.account?.Is_Banned === true
  const isSuspended =
    profile?.account?.Is_Suspended === true &&
    Boolean(profile?.account?.Suspended_Until) &&
    new Date(profile.account.Suspended_Until!).getTime() > Date.now()

  if (isBanned || isSuspended) {
    navigateTo('/banned')
    return
  }

  if (!profile.artistProfile) {
    if (profile.businessProfile) {
      navigateTo('/BusinessDash')
    } else {
      navigateTo('/userhome')
    }
    return
  }

  if (profile.artistProfile.Is_Verified || profile.artistProfile.Status === 'Active') {
    navigateTo('/Artisthome')
    return
  }

  if (profile.artistProfile.Status === 'Rejected') {
    isRejected.value = true
    isPending.value = false
  } else {
    isRejected.value = false
    isPending.value = true
  }
  isLoading.value = false
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
  <head>
    <title>Artist Verification | TONO</title>
  </head>
  <div class="min-h-screen bg-[#0E0E10] flex flex-col items-center justify-center p-6 text-center font-Geist">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center gap-3">
      <Icon name="ic:baseline-sync" class="animate-spin text-3xl text-[#D0D4F7]" />
      <span class="text-xs text-[#8E8B94]">Verifying application status...</span>
    </div>

    <!-- Rejected Card (Strict Theme) -->
    <div v-else-if="isRejected" class="max-w-md w-full bg-[#1B1B1D] border border-[#46464D]/40 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6">
      <div class="flex justify-center items-center bg-red-500/15 border border-red-500/30 p-4 rounded-full">
        <Icon name="material-symbols:cancel" class="text-5xl text-red-500" />
      </div>
      
      <h1 class="text-3xl font-bold text-white font-Sora">Account Rejected</h1>
      
      <p class="text-[#A0A0A5] leading-relaxed text-sm">
        Unfortunately, your artist profile application has been rejected by our administrative team.
      </p>

      <p class="text-[#A0A0A5] leading-relaxed text-sm">
        If you believe this is a mistake, please contact support or try applying again at a later date.
      </p>

      <div class="w-full mt-2">
        <button 
          @click="handleLogout"
          class="w-full cursor-pointer border border-[#46464D]/40 text-white font-semibold py-3 px-6 rounded-full hover:bg-[#26262A] transition text-sm">
          Logout
        </button>
      </div>
    </div>

    <!-- Pending Card (Strict Theme) -->
    <div v-else-if="isPending" class="max-w-md w-full bg-[#1B1B1D] border border-[#46464D]/40 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6">
      <div class="flex justify-center items-center bg-amber-500/15 border border-amber-500/30 p-4 rounded-full">
        <Icon name="material-symbols:pending-actions" class="text-5xl text-amber-500" />
      </div>
      
      <h1 class="text-3xl font-bold text-white font-Sora">Pending Verification</h1>
      
      <p class="text-[#A0A0A5] leading-relaxed text-sm">
        Your artist profile has been submitted and is currently under review by our admin team. This process ensures the quality and legitimacy of artists on the platform.
      </p>

      <p class="text-[#A0A0A5] leading-relaxed text-sm">
        Please check back later. Once approved, you will have full access to your artist dashboard.
      </p>

      <div class="flex gap-3 w-full mt-2">
        <button 
          @click="checkVerification"
          class="flex-1 cursor-pointer bg-[#D0D4F7] text-[#0E0E10] font-semibold py-3 px-5 rounded-full hover:bg-[#B0B4D7] transition flex items-center justify-center gap-2 text-sm shadow-md">
          <Icon name="material-symbols:refresh" class="text-xl" />
          Refresh Status
        </button>
        <button 
          @click="handleLogout"
          class="flex-1 cursor-pointer border border-[#46464D]/40 text-white font-semibold py-3 px-5 rounded-full hover:bg-[#26262A] transition text-sm">
          Logout
        </button>
      </div>
    </div>
  </div>
</template>
