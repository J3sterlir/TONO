<script setup lang="ts">
import { ref } from 'vue'
import { useAdminAuth } from '~/composables/useAdminAuth'

const showPassword = ref(false)
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const { signInAdmin } = useAdminAuth()

const handleLogin = async () => {
  errorMessage.value = ''
  if (!email.value.trim() || !password.value.trim()) {
    errorMessage.value = 'Please enter both email and password.'
    return
  }

  try {
    isLoading.value = true
    await signInAdmin(email.value, password.value)
    await navigateTo('/admin/dashboard')
  } catch (err: any) {
    errorMessage.value = err.message || 'Login failed. Please check your admin credentials.'
  } finally {
    isLoading.value = false
  }
}

definePageMeta({
  middleware: 'admin'
})
const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()
const handleLogout = async () => {
  await signOutAdmin()
}

const adminProfile = await fetchCurrentAdmin()
</script>

<template>
  <title>TONO Admin Login</title>
  <div class="min-h-screen bg-[#131315] flex flex-col justify-center items-center p-8">
    <div class="flex items-center gap-1.5 mt-6.5 mb-6 text-white">
      <img src="/TONO_LOGO.svg" alt="Logo" class="h-11 w-11 rounded-full" />
      <h1 class="text-2xl font-bold">TONO</h1>
      <h1 class="text-2xl font-light text-[#D0D4F7]">ADMIN</h1>
    </div>

    <form @submit.prevent="handleLogin" class="text-white p-3 w-full max-w-sm flex flex-col gap-4">
      <div>
        <p class="font-light text-xs text-[#7A7A7D] mb-1.5 uppercase tracking-wider">Email</p>
        <div class="relative">
          <Icon name="ic:outline-person" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
          <input 
            v-model="email"
            type="email" 
            placeholder="Enter your admin email"
            required
            class="w-full pl-12 p-3 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent transition" 
          />
        </div>
      </div>

      <div>
        <div class="flex justify-between items-center mb-1.5">
          <p class="font-light text-xs text-[#7A7A7D] uppercase tracking-wider">Password</p>
        </div>
        <div class="relative">
          <Icon name="ic:outline-lock" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />

          <input 
            v-model="password"
            :type="showPassword ? 'text' : 'password'" 
            placeholder="Enter your password"
            required
            class="w-full pl-12 pr-12 p-3 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent transition" 
          />

          <button 
            type="button" 
            class="flex absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7A7D] hover:text-white transition"
            @click="showPassword = !showPassword"
          >
            <Icon class="text-2xl" :name="showPassword ? 'ic:outline-visibility-off' : 'ic:outline-visibility'" />
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
        {{ errorMessage }}
      </div>

      <button 
        type="submit"
        :disabled="isLoading"
        class="bg-[#D0D4F7] text-[#151A34] font-semibold w-full py-3 rounded-full mt-3 hover:bg-[#B0B4D7] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
      >
        <span v-if="isLoading">Signing in...</span>
        <span v-else>Sign in</span>
      </button>
    </form>
  </div>
</template>