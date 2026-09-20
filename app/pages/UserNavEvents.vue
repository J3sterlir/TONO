<script setup lang="ts">

definePageMeta({
  layout: 'user',
  middleware: 'auth'
})


import { ref, onMounted, onUnmounted } from 'vue'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile } = useTonoAuth()

const username = ref('')
const isLoading = ref(true)


onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.artistProfile) {
      setPageLayout('artist')
    } else {
      setPageLayout('user')
    }
    if (profile?.account?.Username) {
      username.value = profile.account.Username
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

</template>