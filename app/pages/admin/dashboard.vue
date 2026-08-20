<script setup lang="ts">
const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()
const supabase = useSupabaseClient()
const handleLogout = async () => {
  await signOutAdmin()
}
const { data: authData } = await supabase.auth.getUser()
if (!authData.user) {
  await navigateTo('/admin/auth')
}

// Fetch admin profile
const adminProfile = await fetchCurrentAdmin()
</script>

<template>
  <div class="min-h-screen bg-[#131315] text-white p-8">
    <div class="flex justify-between items-center mb-8">
      <div class="flex items-center gap-2">
        <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
        <div>
          <h1 class="text-xl font-bold">TONO</h1>
          <h2 class="text-xl font-light text-[#D0D4F7]">ADMIN PANEL</h2>
        </div>
      </div>
      <button 
        @click="handleLogout" 
        class="px-4 py-2 bg-[#3A3A3C] rounded-full hover:bg-[#4A4A4E] transition cursor-pointer"
      >
        Sign Out
      </button>
    </div>

    <div v-if="adminProfile" class="bg-[#1E1E20] rounded-2xl p-6 shadow-lg border border-[#3A3A3C] max-w-2xl mx-auto">
      <h2 class="text-2xl font-semibold mb-4 text-[#D0D4F7]">Admin Profile</h2>
      
      <div class="space-y-3">
        <div class="flex items-center">
          <span class="w-32 font-semibold text-[#7A7A7D]">ID:</span>
          <span class="text-gray-300">{{ adminProfile.ADMIN_ID }}</span>
        </div>
        
        <div class="flex items-center">
          <span class="w-32 font-semibold text-[#7A7A7D]">Username:</span>
          <span class="text-gray-300">{{ adminProfile.Username }}</span>
        </div>
        
        <div class="flex items-center">
          <span class="w-32 font-semibold text-[#7A7A7D]">Email:</span>
          <span class="text-gray-300">{{ adminProfile.Email }}</span>
        </div>
        
        <div class="flex items-center">
          <span class="w-32 font-semibold text-[#7A7A7D]">Created At:</span>
          <span class="text-gray-300">{{ new Date(adminProfile.Created_at || '').toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <div v-else class="text-center text-[#7A7A7D] mt-10">
      <p>Loading admin profile...</p>
    </div>
  </div>
</template>