<script setup lang="ts">
import { ref, onMounted } from 'vue'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile } = useTonoAuth()

const artistName = ref('')
const isLoading = ref(true)

onMounted(async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      await navigateTo('/Login')
      return
    }

    const profile = await fetchCurrentUserProfile()
    
    // For artist, prefer stageName but fallback to Username
    if (profile?.artistProfile?.StageName) {
      artistName.value = profile.artistProfile.StageName
    } else if (profile?.account?.Username) {
      artistName.value = profile.account.Username
    } else {
      await navigateTo('/Login')
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
    await navigateTo('/Login')
  } finally {
    isLoading.value = false
  }
})

const handleLogout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/Login')
}
</script>

<template>
  <div class="min-h-screen bg-[#131315] text-white flex flex-col items-center justify-center p-6">
    <div v-if="isLoading" class="text-[#D0D4F7]">
      Loading...
    </div>
    
    <div v-else class="flex flex-col items-center gap-6 bg-[#1E1E20] p-10 rounded-2xl border border-[#3A3A3C] max-w-md w-full shadow-lg">
      <div class="flex items-center gap-3">
        <img src="/TONO_LOGO.svg" alt="Logo" class="h-12 w-12 rounded-full" />
        <h1 class="text-3xl font-bold">TONO</h1>
      </div>
      
      <div class="text-center">
        <h2 class="text-xl font-light text-gray-300">Welcome back, Artist</h2>
        <p class="text-3xl font-bold mt-2 text-[#D0D4F7]">{{ artistName || 'Artist' }}!</p>
      </div>
      
      <button 
        @click="handleLogout"
        class="mt-4 bg-[#D0D4F7] text-[#151A34] w-full p-3 rounded-full font-semibold hover:bg-[#B0B4D7] transition-colors cursor-pointer">
        Logout
      </button>
    </div>
  </div>
</template>