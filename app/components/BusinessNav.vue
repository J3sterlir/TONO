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
  avatarUrl.value = null
  await supabase.auth.signOut()
  await navigateTo('/Login')
}

// Mobile sidebar drawer state
const isMobileSidebarOpen = ref(false)

const toggleMobileSidebar = () => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value
}

const closeMobileSidebar = () => {
  isMobileSidebarOpen.value = false
}

// Close mobile sidebar on route changes
watch(
  () => route.path,
  () => {
    closeMobileSidebar()
  }
)
</script>

<template>
  <div>
    <!-- Top Navigation Bar -->
    <nav class="flex items-center justify-between px-4 sm:px-16 h-16 sm:h-20 border-b border-[#46464D] top-0 sticky backdrop-blur-3xl z-30 bg-[#131315]/80">
      <!-- Left (Mobile Only): Hamburger Toggle & Mini Logo -->
      <div class="flex items-center gap-2.5 sm:hidden">
        <button
          type="button"
          @click="toggleMobileSidebar"
          class="flex p-2 -ml-1 text-gray-300 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Open navigation menu">
          <Icon name="ic:round-menu" class="text-2xl text-[#D0D4F7]" />
        </button>

        <div class="flex items-center gap-2 cursor-pointer" @click="navigateTo('/businessdash')">
          <img src="/TONO_LOGO.svg" alt="TONO Logo" class="h-7 w-7 rounded-full" />
          <div class="leading-tight">
            <span class="text-sm font-bold tracking-tight text-white block">TONO</span>
            <span class="text-[9px] font-mono text-[#D0D4F7] uppercase tracking-wider block">BUSINESS</span>
          </div>
        </div>
      </div>

      <!-- Left spacer for desktop to maintain right-aligned action buttons -->
      <div class="hidden sm:block"></div>

      <!-- Right: Action Buttons -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Switch to Personal Mode (User Discovery & Profile) -->
        <button
          @click="navigateTo('/userhome')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E1E24] hover:bg-[#D0D4F7]/15 border border-[#3A3A3C] hover:border-[#D0D4F7]/60 text-xs font-semibold text-[#D0D4F7] transition-all duration-300 cursor-pointer shadow-sm group"
          title="Switch to Personal Mode">
          <Icon name="ic:outline-explore" class="text-base text-[#D0D4F7] group-hover:scale-110 transition-transform shrink-0" />
          <span class=" xs:inline font-Sora">Personal Mode</span>
        </button>

        <button
          class="flex items-center justify-center p-2 sm:p-2.5 rounded-full transition-all duration-300 cursor-pointer hover:bg-white/5"
          title="Notifications">
          <Icon
            name="ic:baseline-notifications-none"
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
      </div>
    </nav>

    <!-- Mobile Backdrop Overlay -->
    <div
      v-if="isMobileSidebarOpen"
      @click="closeMobileSidebar"
      class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs sm:hidden transition-opacity duration-300"
      aria-hidden="true"
    ></div>

    <!-- Sidebar Drawer -->
    <aside
      id="logo-sidebar"
      class="fixed top-0 left-0 z-50 w-64 h-full transition-transform duration-300 ease-in-out bg-[#201F21]"
      :class="isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full sm:translate-x-0'"
      aria-label="Sidebar"
    >
      <div class="h-full flex flex-col justify-between w-64 p-6 overflow-y-auto bg-neutral-primary-soft border-e border-[#46464D]">
        <div>
          <!-- Logo & Mobile Close Button -->
          <div class="flex items-center justify-between mb-8 sm:mb-12">
            <div class="flex items-center gap-2 cursor-pointer" @click="navigateTo('/businessdash'); closeMobileSidebar()">
              <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
              <div>
                <h1 class="text-xl font-bold">TONO</h1>
                <h2 class="text-md font-light text-[#D0D4F7]">BUSINESS SUITE</h2>
              </div>
            </div>

            <!-- Close button for mobile -->
            <button
              type="button"
              @click="closeMobileSidebar"
              class="sm:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close sidebar"
            >
              <Icon name="ic:round-close" class="text-2xl" />
            </button>
          </div>

          <!-- Nav Items -->
          <ul class="space-y-2">
            <li v-for="item in navItems" :key="item.path">
              <NuxtLink
                :to="item.path"
                @click="closeMobileSidebar"
                class="flex items-center px-3 py-2.5 rounded-xl transition-all"
                :class="route.path.toLowerCase() === item.path.toLowerCase()
                  ? 'bg-[#B4B8DA] text-[#131315] font-bold shadow-sm'
                  : 'text-[#C7C5CE] hover:bg-[#B4B8DA]/15 hover:text-white'"
              >
                <!-- Single dynamic Icon based on current route -->
                <Icon
                  :name="route.path.toLowerCase() === item.path.toLowerCase() ? item.activeIcon : item.icon"
                  class="text-2xl"
                />
                <span class="ms-3 text-sm">{{ item.name }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Footer Actions (Personal Mode Switch & Logout) -->
        <div class="space-y-2 pt-6 border-t border-[#46464D]/50">
          <button
            @click="navigateTo('/userhome'); closeMobileSidebar()"
            class="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-[#D0D4F7] hover:bg-[#D0D4F7]/10 w-full text-left rounded-xl transition-colors cursor-pointer sm:hidden"
          >
            <Icon name="ic:outline-explore" class="text-xl" />
            <span>Switch to Personal Mode</span>
          </button>

          <button
            @click="handleLogout"
            class="flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#C7C5CE] hover:text-red-300 hover:bg-red-500/10 w-full text-left rounded-xl transition-colors cursor-pointer"
          >
            <Icon name="ic:baseline-logout" class="text-xl" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>