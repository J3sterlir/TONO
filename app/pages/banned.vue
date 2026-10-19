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
  <head>
    <title>Account Banned | TONO</title>
  </head>
  <div class="min-h-screen bg-[#0E0E10] flex flex-col items-center justify-center p-6 text-center">
    <!-- Banned Card (Strict Theme) -->
    <div class="max-w-md w-full bg-[#1B1B1D] border border-[#46464D]/40 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6">
      <div class="flex justify-center items-center bg-red-500/15 border border-red-500/30 p-4 rounded-full">
        <Icon name="material-symbols:block" class="text-5xl text-red-500" />
      </div>
      
      <h1 class="text-3xl font-bold text-white">Account Suspended</h1>
      
      <p class="text-[#A0A0A5] leading-relaxed text-sm">
        Your account has been suspended for violating our community guidelines or terms of service.
      </p>

      <p class="text-[#A0A0A5] leading-relaxed text-sm">
        If you believe this action was taken in error, please contact our support team to appeal this decision.
      </p>

      <div class="w-full mt-2">
        <button 
          @click="handleLogout"
          class="w-full cursor-pointer border border-[#46464D]/40 text-white font-semibold py-3 px-6 rounded-full hover:bg-[#26262A] transition text-sm">
          Logout
        </button>
      </div>
    </div>
  </div>
</template>
