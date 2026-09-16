<script setup lang="ts">
import { computed } from 'vue'

const supabase = useSupabaseClient()
const route = useRoute()

const isDiscoverActive = computed(() => route.path === '/Artisthome')
const isArtistsActive = computed(() => route.path.startsWith('/UserNavArtists'))
const isEventsActive = computed(() => route.path.startsWith('/UserNavEvents'))
const isProfileActive = computed(() => route.path === '/Artistprofile')

const handleLogout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/Login')
}
</script>

<template>
  <nav
    class="bg-[#131315] sticky top-0 border-b border-[#46464D]/75 z-50">
    <div class="flex items-center justify-between px-4 sm:px-8 md:px-10 py-3 sm:py-4">
      <!-- Brand / Logo -->
      <div
        @click="navigateTo('/Artisthome')"
        class="flex items-center gap-2.5 sm:gap-3 cursor-pointer group shrink-0">
        <img
          src="/TONO_LOGO.svg"
          alt="Logo"
          class="h-7 w-7 sm:h-8 sm:w-8 rounded-full" />
        <h1 class="text-xl sm:text-[1.5rem] font-bold tracking-wide">
          TONO
        </h1>
      </div>

      <!-- Centered Nav Links (Tablet & Desktop) -->
      <div class="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-6 md:gap-10">
        <button
          @click="navigateTo('/Artisthome')"
          class="pb-1 text-sm font-medium transition-all duration-300 cursor-pointer"
          :class="isDiscoverActive
            ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
            : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7] hover:border-[#D0D4F7]/60 hover:-translate-y-0.5'">
          Discover
        </button>

        <button
          @click="navigateTo('/UserNavArtists')"
          class="pb-1 text-sm font-medium transition-all duration-300 cursor-pointer"
          :class="isArtistsActive
            ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
            : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7] hover:border-[#D0D4F7]/60 hover:-translate-y-0.5'">
          Artists
        </button>

        <button
          @click="navigateTo('/UserNavEvents')"
          class="pb-1 text-sm font-medium transition-all duration-300 cursor-pointer"
          :class="isEventsActive
            ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
            : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7] hover:border-[#D0D4F7]/60 hover:-translate-y-0.5'">
          Events
        </button>
      </div>

      <!-- Right Actions -->
      <div class="flex items-center gap-1 sm:gap-2">
        <!-- Notification Icon -->
        <button
          class="flex items-center justify-center p-2 sm:p-2.5 rounded-full transition-all duration-300 cursor-pointer"
          title="Notifications">
          <Icon
            name="ic:baseline-notifications-none"
            class="text-xl sm:text-2xl text-[#C7C5CE] transition-all duration-300 hover:text-[#D0D4F7]" />
        </button>

        <!-- Profile Button -->
        <button
          @click="navigateTo('/Artistprofile')"
          class="flex items-center justify-center p-2 sm:p-2.5 rounded-full transition-all duration-300 cursor-pointer group hover:bg-[#D0D4F7]/10 hover:shadow-[0_0_12px_rgba(208,212,247,0.18)]"
          :class="isProfileActive ? 'bg-[#D0D4F7]/10 shadow-[0_0_12px_rgba(208,212,247,0.18)] ring-1 ring-[#D0D4F7]/40' : ''"
          title="Artist Profile">
          <Icon
            name="ic:outline-account-circle"
            class="text-xl sm:text-2xl transition-all duration-300"
            :class="isProfileActive ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] group-hover:text-[#D0D4F7]'" />
        </button>

        <!-- Logout Button -->
        <button
          @click="handleLogout"
          class="flex items-center justify-center p-2 sm:p-2.5 rounded-full transition-all duration-300 cursor-pointer"
          title="Log Out">
          <Icon
            name="ic:outline-vpn-key-off"
            class="text-xl sm:text-2xl text-[#C7C5CE] transition-all duration-300 hover:text-[#ff3c3c]" />
        </button>
      </div>
    </div>

    <!-- Mobile Sub-Nav Links (Mobile Screens < 640px) -->
    <div class="flex sm:hidden items-center justify-around px-4 py-2 border-t border-[#46464D]/30 bg-[#0E0E10]/80">
      <button
        @click="navigateTo('/Artisthome')"
        class="pb-0.5 text-xs font-medium transition-all duration-300 cursor-pointer"
        :class="isDiscoverActive
          ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
          : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7]'">
        Discover
      </button>

      <button
        @click="navigateTo('/UserNavArtists')"
        class="pb-0.5 text-xs font-medium transition-all duration-300 cursor-pointer"
        :class="isArtistsActive
          ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
          : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7]'">
        Artists
      </button>

      <button
        @click="navigateTo('/UserNavEvents')"
        class="pb-0.5 text-xs font-medium transition-all duration-300 cursor-pointer"
        :class="isEventsActive
          ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
          : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7]'">
        Events
      </button>
    </div>
  </nav>
</template>
