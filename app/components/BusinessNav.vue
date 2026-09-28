<script setup lang="ts">

import { ref, computed, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()
const db = supabase as any
const user = useSupabaseUser()
const isProfileActive = computed(() => route.path.toLowerCase() === '/userprofile')

// Shared cross-component avatar state across TONO
const avatarUrl = useState<string | null>('tono_user_avatar', () => null)
const imageLoadError = ref(false)

const route = useRoute()
const { signOutAdmin } = useAdminAuth()
const navItems = [
  {
    name: 'Home',
    path: '/businessdash',
    icon: 'ic:outline-home',
    activeIcon: 'mdi:home'
  },
  {
    name: 'Job Listings',
    path: '/businessjoblist',
    icon: 'mdi:briefcase-outline',
    activeIcon: 'mdi:briefcase'
  },
  {
    name: 'Job Applications',
    path: '/businessjobapp',
    icon: 'mdi:clipboard-file-outline',
    activeIcon: 'mdi:clipboard-file'
  },
  {
    name: 'Contracts',
    path: '/businesscontracts',
    icon: 'mdi:file-multiple-outline',
    activeIcon: 'mdi:file-multiple'
  },
]

const loadAvatar = async () => {
  try {
    const userId = user.value?.id || (await supabase.auth.getUser()).data.user?.id
    if (!userId) return

    const { data, error } = await db
      .from('USER_ACCOUNT')
      .select('Profile_Picture')
      .eq('ACCOUNT_ID', userId)
      .maybeSingle()

    if (!error && data?.Profile_Picture) {
      avatarUrl.value = data.Profile_Picture
      imageLoadError.value = false
    }
  } catch (e) {
    // Non-blocking
  }
}

onMounted(() => {
  loadAvatar()
})

watch(
  () => user.value?.id,
  (newId) => {
    if (newId) {
      loadAvatar()
    } else {
      avatarUrl.value = null
    }
  }
)

const handleLogout = async () => {
  await signOutAdmin()
}
</script>

<template>
   <nav class="flex items-center justify-end px-16 h-20 border-b border-[#46464D] top-0 sticky backdrop-blur-3xl z-10">
       <button
            class="flex items-center justify-center p-2 sm:p-2.5 rounded-full transition-all duration-300 cursor-pointer hover:bg-white/5"
            title="Notifications">
            <Icon name="ic:baseline-notifications-none"
                class="text-xl sm:text-2xl text-[#C7C5CE] transition-all duration-300 hover:text-[#D0D4F7]" />
        </button>

        <button
          @click="navigateTo('/userprofile')"
          class="flex items-center justify-center p-1 sm:p-1.5 rounded-full transition-all duration-300 cursor-pointer group hover:bg-[#D0D4F7]/10 hover:shadow-[0_0_12px_rgba(208,212,247,0.18)]"
          :class="isProfileActive ? 'bg-[#D0D4F7]/10 shadow-[0_0_12px_rgba(208,212,247,0.18)] ring-1 ring-[#D0D4F7]/40' : ''"
          title="User Profile">
          <img
            v-if="avatarUrl && !imageLoadError"
            :src="avatarUrl"
            alt="Profile Avatar"
            @error="imageLoadError = true"
            class="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover object-center ring-1 ring-[#46464D]/50" />
          <Icon
            v-else
            name="ic:outline-account-circle"
            class="text-xl sm:text-2xl transition-all duration-300"
            :class="isProfileActive ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] group-hover:text-[#D0D4F7]'" />
        </button>
    </nav>

  <aside
    id="logo-sidebar"
    class="fixed top-0 left-0 z-40 w-64 h-full transition-transform -translate-x-full sm:translate-x-0 bg-[#201F21]"
    aria-label="Sidebar"
  >
    <div class="h-full flex flex-col justify-between w-[256px] p-6 overflow-y-auto bg-neutral-primary-soft border-e border-[#46464D]">
      <div>
        <!-- Logo -->
        <div class="flex items-center gap-2 mb-12">
          <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
          <div>
            <h1 class="text-xl font-bold">TONO</h1>
            <h2 class="text-md font-light text-[#D0D4F7]">BUSINESS SUITE</h2>
          </div>
        </div>
<ul class="space-y-2">
  <li v-for="item in navItems" :key="item.path">
    <NuxtLink
      :to="item.path"
      class="flex items-center px-2 py-1.5 rounded transition-colors"
      :class="route.path === item.path
        ? 'bg-[#B4B8DA] text-[#444865] font-bold'
        : 'text-[#C7C5CE] hover:bg-[#B4B8DA]/20 hover:text-white'"
    >
      <!-- Single dynamic Icon based on current route -->
      <Icon
        :name="route.path === item.path ? item.activeIcon : item.icon"
        class="text-2xl"
      />
      <span class="ms-3">{{ item.name }}</span>
    </NuxtLink>
  </li>
</ul>

      </div>

      <!-- Logout -->
      <div>
        <button
          @click="handleLogout"
          class="flex items-center gap-2 px-2 py-1.5 text-[#C7C5CE] hover:text-white hover:bg-neutral-tertiary w-full text-left rounded transition-colors"
        >
          <Icon name="ic:baseline-logout" class="text-2xl" />
          <span class="ms-3">Logout</span>
        </button>
      </div>
    </div>
  </aside>
</template>