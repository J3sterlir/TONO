<script setup lang="ts">
import { ref, watch } from 'vue'

const route = useRoute()
const { signOutAdmin } = useAdminAuth()

const isMobileOpen = ref(false)

const toggleSidebar = () => {
  isMobileOpen.value = !isMobileOpen.value
}

// Automatically close mobile sidebar on route change
watch(
  () => route.path,
  () => {
    isMobileOpen.value = false
  }
)

useModalScrollLock(isMobileOpen)

const navItems = [
  {
    name: 'Dashboard',
    path: '/admin/dashboard',
    icon: 'ic:outline-dashboard',
    activeIcon: 'ic:baseline-dashboard'
  },
  {
    name: 'Tags',
    path: '/admin/tags',
    icon: 'ic:outline-label',
    activeIcon: 'ic:baseline-label'
  },
  {
    name: 'Reports',
    path: '/admin/reports',
    icon: 'ic:baseline-outlined-flag',
    activeIcon: 'ic:baseline-flag'
  },
  {
    name: 'Users',
    path: '/admin/users',
    icon: 'ic:outline-supervisor-account',
    activeIcon: 'ic:baseline-supervisor-account'
  },
  {
    name: 'Verifications',
    path: '/admin/verifications',
    icon: 'ic:outline-verified-user',
    activeIcon: 'ic:baseline-verified-user'
  }
]

const handleLogout = async () => {
  isMobileOpen.value = false
  await signOutAdmin()
}
</script>

<template>
  <div>
    <!-- Mobile Menu Button to Show Aside (Visible only when sidebar is closed on mobile) -->
    <button
      v-if="!isMobileOpen"
      @click="toggleSidebar"
      type="button"
      class="fixed top-4 left-4 z-30 sm:hidden p-2 rounded-xl bg-[#1C1C1F]/90 backdrop-blur-md border border-[#46464D]/60 text-gray-300 hover:text-white shadow-xl transition-all cursor-pointer flex items-center justify-center focus:outline-hidden active:scale-95"
      aria-label="Open navigation menu"
    >
      <Icon name="ic:round-menu" class="text-2xl text-[#D0D4F7]" />
    </button>

    <!-- Mobile Backdrop Overlay -->
    <transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileOpen"
        @click="isMobileOpen = false"
        class="fixed inset-0 bg-black/65 backdrop-blur-xs z-40 sm:hidden"
        aria-hidden="true"
      />
    </transition>

    <!-- Sidebar Aside -->
    <aside
      id="logo-sidebar"
      class="fixed top-0 left-0 z-50 w-64 h-dvh transition-transform duration-300 ease-in-out bg-[#201F21] shadow-2xl sm:shadow-none"
      :class="isMobileOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'"
      aria-label="Sidebar"
    >
      <div class="h-full flex flex-col justify-between w-64 p-5 sm:p-6 bg-neutral-primary-soft border-e border-[#46464D] select-none">
        <!-- Logo & Header (shrink-0) -->
        <div class="shrink-0 flex items-center justify-between mb-6">
          <div class="flex items-center gap-2">
            <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
            <div>
              <h1 class="text-xl font-bold">TONO</h1>
              <h2 class="text-xs font-light text-[#D0D4F7] tracking-wider uppercase">ADMIN PANEL</h2>
            </div>
          </div>

          <!-- Mobile Close Button (Existing X button inside drawer - no duplicate) -->
          <button
            @click="isMobileOpen = false"
            type="button"
            class="sm:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <Icon name="ic:round-close" class="text-2xl" />
          </button>
        </div>

        <!-- Navigation Links & Logout Container -->
        <div class="flex-1 overflow-y-auto min-h-0 pr-1 -mr-1 custom-scrollbar flex flex-col">
          <ul class="space-y-1.5 sm:space-y-2">
            <li v-for="item in navItems" :key="item.path">
              <NuxtLink
                :to="item.path"
                @click="isMobileOpen = false"
                class="flex items-center px-3 py-2 rounded-xl transition-colors"
                :class="route.path === item.path
                  ? 'bg-[#B4B8DA] text-[#444865] font-bold'
                  : 'text-[#C7C5CE] hover:bg-[#B4B8DA]/20 hover:text-white'"
              >
                <!-- Single dynamic Icon based on current route -->
                <Icon
                  :name="route.path === item.path ? item.activeIcon : item.icon"
                  class="text-2xl"
                />
                <span class="ms-3 text-sm font-medium">{{ item.name }}</span>
              </NuxtLink>
            </li>
          </ul>

          <!-- Logout (Aligned with tabs, mt-6 and border-t on mobile; sm:mt-auto on desktop) -->
          <div class="mt-6 pt-4 border-t border-[#46464D]/50 sm:mt-auto">
            <button
              @click="handleLogout"
              class="flex items-center px-3 py-2 text-[#C7C5CE] hover:text-red-300 hover:bg-red-500/10 w-full text-left rounded-xl transition-colors cursor-pointer"
            >
              <Icon name="ic:baseline-logout" class="text-2xl text-red-400" />
              <span class="ms-3 text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
