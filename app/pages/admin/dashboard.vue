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

</script>

<template>
  <div class="min-h-screen bg-[#131315] text-white sm:ml-64 font-Sora">
    <aside id="logo-sidebar"
      class="fixed top-0 left-0 z-40 w-64 h-full transition-transform -translate-x-full sm:translate-x-0 bg-[#201F21]"
      aria-label="Sidebar">
      <div
        class="h-full flex flex-col justify-between w-[256px] p-6 overflow-y-auto bg-neutral-primary-soft border-e border-default border-[#46464D]">
        <div>
          <div class="flex items-center gap-2 mb-12">
            <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
            <div>
              <h1 class="text-xl font-bold">TONO</h1>
              <h2 class="text-xl font-light text-[#D0D4F7]">ADMIN PANEL</h2>
            </div>
          </div>
          <ul class="space-y-2 font-medium">
            <li>
              <a href="#"
                class="flex items-center px-2 py-1.5 text-body rounded-base hover:bg-neutral-tertiary hover:text-fg-brand group">
                <Icon name="ic:outline-dashboard" class="text-2xl text-[#C7C5CE]" />
                <span class="ms-3">Dashboard</span>
              </a>
            </li>
            <li>
              <a href="#"
                class="flex items-center px-2 py-1.5 text-body rounded-base hover:bg-neutral-tertiary hover:text-fg-brand group">
                <Icon name="ic:baseline-label" class="text-2xl text-[#C7C5CE]" />
                <span class="flex-1 ms-3 whitespace-nowrap">Tags</span>
              </a>
            </li>
            <li>
              <a href="#"
                class="flex items-center px-2 py-1.5 text-body rounded-base hover:bg-neutral-tertiary hover:text-fg-brand group">
                <Icon name="ic:baseline-outlined-flag" class="text-2xl text-[#C7C5CE]" />
                <span class="flex-1 ms-3 whitespace-nowrap">Reports</span>
              </a>
            </li>
            <li>
              <a href="#"
                class="flex items-center px-2 py-1.5 text-body rounded-base hover:bg-neutral-tertiary hover:text-fg-brand group">
                <Icon name="ic:outline-supervisor-account" class="text-2xl text-[#C7C5CE]" />
                <span class="flex-1 ms-3 whitespace-nowrap">Users</span>
              </a>
            </li>
          </ul>
        </div>
        <div>
          <button @click="handleLogout" class="flex items-center gap-2 px-2 py-1.5 text-body rounded-base hover:bg-neutral-tertiary hover:text-fg-brand group w-full text-left">
            <Icon name="ic:baseline-logout" class="text-2xl text-[#C7C5CE]" />
            <span class="flex-1 ms-3 whitespace-nowrap">Logout</span>
          </button>
        </div>
      </div>
    </aside>

    <div>
      <nav class="flex items-center px-16 h-20 border-be border-default border-[#46464D]">
        <h1 class="text-[#D0D4F7] text-[24px] font-medium">Welcome Back Admin!</h1>
      </nav>
      <main class="p-16">
        <div class="flex justify-start gap-6 text-[1.2rem] font-Geist">

          <div
            class="flex justify-between border rounded-xl border-[#2A2A2E]/50 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60">
            <div class="flex flex-col justify-center">
              <h1>Reports To Resolve</h1>
              <h1 class="text-[36px] text-[#FFB4AB]">1</h1>
            </div>
            <div class="flex justify-center items-center">
              <div class="flex p-1 rounded bg-[#93000A]/20 ">
                <Icon name="ic:baseline-warning" class="text-[36px] text-[#FFB4AB]" />
              </div>
            </div>
          </div>

          <div
            class="flex justify-between border rounded-xl border-[#2A2A2E]/50 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60">
            <div class="flex flex-col justify-center">
              <h1>Artist To Verify</h1>
              <h1 class="text-[36px] text-[#D0D4F7]">1</h1>
            </div>
            <div class="flex justify-center items-center">
              <div class="flex p-1 rounded bg-[#D0D4F7]/20 ">
                <Icon name="ic:round-check-circle" class="text-[36px] text-[#D0D4F7]" />
              </div>
            </div>
          </div>

          <div
            class="flex justify-between border rounded-xl border-[#2A2A2E]/50 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60">
            <div class="flex flex-col justify-center">
              <h1>Total Users</h1>
              <h1 class="text-[36px] text-[#D0D4F7]">1</h1>
            </div>
            <div class="flex justify-center items-center">
              <div class="flex p-1 rounded bg-[#D0D4F7]/20 ">
                <Icon name="ic:outline-person" class="text-[36px] text-[#D0D4F7]" />
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-12 grid-rows-2 gap-4 mt-12">
          <div class="col-span-8 bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 rounded-xl p-6">

            <div class="flex justify-between mb-6">
              <h1>Recent Reports:</h1>
              <h1 class="text-[#D0D4F7]">View All</h1>
            </div>

            <div class="flex flex-col gap-3">
              <div class="bg-[#1B1B1D] p-4 rounded-lg">
                <div class="flex flex-col font-HankenGrotesk">
                  <h1 class="font-bold text-[16px]">Report ID</h1>
                  <h1 class="text-[14px]">Reported by [Username] - 1h ago</h1>
                </div>
              </div>
            </div>

          </div>

          <div class="col-span-4 bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 rounded-xl p-6">
            
            <div class="flex justify-between mb-6">
              <h1>Recent Accounts:</h1>
              <h1 class="text-[#D0D4F7]">View All</h1>
            </div>

            <div class="flex flex-col gap-4">
              <div class="bg-[#1B1B1D] p-4 rounded-lg">
                <div class="flex flex-col font-HankenGrotesk">
                  <h1 class="font-bold text-[16px]">Report ID</h1>
                  <h1 class="text-[14px]">Reported by [Username] - 1h ago</h1>
                </div>
              </div>
            </div>

          </div>


          <div class="col-span-5 bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 rounded-xl p-6">

            <div class="flex justify-between items-center mb-6">
              <h1>Verification Queue:</h1>
              <h1 class="text-[#444865] bg-[#B4B8DA] p-2 text-[11px] rounded font-bold">1 PENDING</h1>
            </div>

            <div class="flex flex-col gap-4">
              <div class="bg-[#1B1B1D] p-4 rounded-lg">
                <div class="flex flex-col font-HankenGrotesk">
                  <h1 class="font-bold text-[16px]">Report ID</h1>
                  <h1 class="text-[14px]">Reported by [Username] - 1h ago</h1>
                </div>
              </div>
            </div>

          </div>

          <div class="col-span-7 bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 rounded-xl p-6">

            <div class="flex justify-between items-center mb-6">
              <h1>Tag Management:</h1>
              <div class="flex gap-2 items-center">
                <div class="flex items-center px-3 py-1 text-body rounded-base border border-[#D0D4F7]/30 rounded-full">
                  <Icon name="ic:baseline-plus" class="text-[25px] text-[#D0D4F7]" />
                  <h1 class="text-[#D0D4F7] p-2 text-[11px] font-bold whitespace-nowrap">Add New</h1>
                </div>
                
              <div class="flex items-center px-3 py-1 text-body bg-[#D0D4F7] rounded-full">
                  <Icon name="ic:round-check-circle" class="text-[25px] text-[#2A2F4A]" />
                  <h1 class="text-[#2A2F4A] p-2 text-[11px] font-bold whitespace-nowrap">Verify Customs</h1>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-4">
              <div class="bg-[#1B1B1D] p-4 rounded-lg">
                <div class="flex flex-col font-HankenGrotesk">
                  <h1 class="font-bold text-[16px]">Report ID</h1>
                  <h1 class="text-[14px]">Reported by [Username] - 1h ago</h1>
                </div>
              </div>
            </div>

          </div>
        </div>
        
      </main>
    </div>
  </div>


  <!--
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
    -->
</template>