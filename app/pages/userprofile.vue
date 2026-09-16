<script setup lang="ts">
definePageMeta({
  layout: 'user',
  middleware: ['auth', 'user']
})

import { ref, computed, onMounted } from 'vue'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile, resolveUserType } = useTonoAuth()

const username = ref('')
const usertype = ref('')
const userTags = ref<string[]>([])
const isLoading = ref(true)

const tagsDisplay = computed(() => {
  if (userTags.value.length === 0) return 'No tags selected'
  return userTags.value.join(', ')
})

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account?.Username) {
      username.value = profile.account.Username
      usertype.value = resolveUserType(profile)
      userTags.value = [...(profile.genres || []), ...(profile.instruments || [])]
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
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
  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen">
    <!-- Loading Skellys -->
    <main v-if="isLoading" class="flex flex-col gap-11.75 p-16 animate-pulse">
      <div class="flex justify-between items-start">
        <div class="flex flex-col gap-3">
          <div class="h-4 w-24 bg-[#1E1E24] rounded-md"></div>
          <div class="h-16 w-80 max-w-full bg-[#1E1E24] rounded-xl"></div>
          <div class="h-5 w-60 max-w-full bg-[#1E1E24] rounded-md"></div>
        </div>

        <div class="w-48 h-48 bg-[#1E1E24] rounded-full border border-[#46464D]/30 shrink-0"></div>
      </div>

      <div class="border-b border-[#46464D]/20">
        <div class="border-b-2 border-[#D0D4F7]/40 w-fit pb-1">
          <div class="h-7 w-28 bg-[#1E1E24] rounded-md"></div>
        </div>
      </div>
    </main>

    <main v-else class="flex flex-col gap-11.75 p-16">
      <div class="flex justify-between items-start">
        <div class="flex flex-col gap-1">
          <h1 class="font-Geist font-medium text-[14px] text-[#D0D4F7]/90 tracking-wide uppercase">
            {{ usertype || 'User' }}
          </h1>
          <h1 class="font-Sora font-bold text-[64px] tracking-tight">
            {{ username || 'User' }}
          </h1>
          <h1 class="font-HankenGrotesk text-[16px] text-gray-400">
            User Tags: {{ tagsDisplay }}
          </h1>
        </div>

        <div class="w-48 h-48 bg-[#353437] rounded-full flex items-center justify-center text-gray-500 overflow-hidden shadow-xl border border-[#46464D]/30">
          <Icon name="ic:outline-account-circle" class="w-full h-full text-[#46464D]" />
        </div>
      </div>

      <div class="border-b border-[#46464D]/20">
        <div class="flex gap-5">
          <button class="font-Sora text-[#D0D4F7] text-[24px] border-b-2 border-[#D0D4F7] w-fit pb-1 cursor-pointer">Active Bookings</button>

          <button class="font-Sora text-[#FFFFFF] text-[24px] hover:text-[#D0D4F7] cursor-pointer">Booking Requests</button>
        </div>
      </div>
    </main>
  </div>
</template>