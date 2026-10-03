<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

interface Props {
  scrolledTitle?: string
  scrolledAvatar?: string | null
  isScrolled?: boolean
  isVerified?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  scrolledTitle: '',
  scrolledAvatar: null,
  isScrolled: false,
  isVerified: false
})

const emit = defineEmits<{
  (e: 'scrollToTop'): void
}>()

const handleScrollToTop = () => {
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  emit('scrollToTop')
}

const supabase = useSupabaseClient()
const db = supabase as any
const user = useSupabaseUser()
const route = useRoute()

// Shared cross-component avatar state across TONO
const avatarUrl = useState<string | null>('tono_user_avatar', () => null)
const imageLoadError = ref(false)

const isDiscoverActive = computed(() => route.path === '/Artisthome')
const isArtistsActive = computed(() => route.path.startsWith('/ArtistNavArtists') || route.path.startsWith('/UserNavArtists'))
const isEventsActive = computed(() => route.path.startsWith('/ArtistNavEvents') || route.path.startsWith('/UserNavEvents'))
const isProfileActive = computed(() => route.path.toLowerCase() === '/artistprofile')

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
</script>

<template>
  <nav
    class="bg-[#131315]/90 sticky top-0 backdrop-blur-md border-b border-[#46464D]/75 z-40">
    <div class="flex items-center justify-between px-4 sm:px-8 md:px-10 py-3 sm:py-4">
      <!-- Brand / Logo & Scrolled Artist Title (Spotify Behavior) -->
      <div class="flex items-center gap-2.5 sm:gap-3.5 shrink-0 min-w-0">
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

        <!-- Scrolled Artist Display when scrolled down -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-x-2 scale-95"
          enter-to-class="opacity-100 translate-x-0 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-x-0 scale-100"
          leave-to-class="opacity-0 -translate-x-2 scale-95">
          <div
            v-if="isScrolled && scrolledTitle"
            @click="handleScrollToTop"
            class="flex items-center gap-2 sm:gap-2.5 pl-2.5 sm:pl-3.5 border-l border-[#46464D]/70 cursor-pointer group/scrolled min-w-0"
            title="Scroll to top">
            <img
              v-if="scrolledAvatar"
              :src="scrolledAvatar"
              :alt="scrolledTitle"
              class="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover shrink-0 ring-1 ring-[#D0D4F7]/40 shadow-sm" />
            <div
              v-else
              class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#353437] flex items-center justify-center shrink-0">
              <Icon name="ic:outline-account-circle" class="w-4 h-4 sm:w-5 sm:h-5 text-[#D0D4F7]" />
            </div>

            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class="font-Sora font-bold text-xs sm:text-sm text-white group-hover/scrolled:text-[#D0D4F7] transition-colors truncate max-w-25 sm:max-w-40 md:max-w-55">
                {{ scrolledTitle }}
              </span>
              <Icon
                v-if="isVerified"
                name="ic:round-verified"
                class="text-emerald-400 text-xs sm:text-sm shrink-0" />
            </div>
          </div>
        </Transition>
      </div>

      <!-- Centered Nav Links (Tablet & Desktop) -->
      <div
        class="absolute left-1/2 -translate-x-1/2 items-center gap-4 sm:gap-6 md:gap-10"
        :class="(isScrolled && scrolledTitle) ? 'hidden xl:flex' : 'hidden sm:flex'">
        <button
          @click="navigateTo('/Artisthome')"
          class="pb-1 text-sm font-medium transition-all duration-300 cursor-pointer"
          :class="isDiscoverActive
            ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
            : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7] hover:border-[#D0D4F7]/60 hover:-translate-y-0.5'">
          Discover
        </button>

        <button
          @click="navigateTo('/ArtistNavArtists')"
          class="pb-1 text-sm font-medium transition-all duration-300 cursor-pointer"
          :class="isArtistsActive
            ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
            : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7] hover:border-[#D0D4F7]/60 hover:-translate-y-0.5'">
          Artists
        </button>

        <button
          @click="navigateTo('/ArtistNavEvents')"
          class="pb-1 text-sm font-medium transition-all duration-300 cursor-pointer"
          :class="isEventsActive
            ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
            : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7] hover:border-[#D0D4F7]/60 hover:-translate-y-0.5'">
          Events
        </button>
      </div>

      <!-- Right Actions -->
      <div class="flex items-center gap-1 sm:gap-2 shrink-0">
        <!-- Notification Dropdown Component -->
        <NotificationDropdown current-role="Artist" />

        <!-- Profile Button -->
        <button
          @click="navigateTo('/Artistprofile')"
          class="flex items-center justify-center p-1 sm:p-1.5 rounded-full transition-all duration-300 cursor-pointer group hover:bg-[#D0D4F7]/10 hover:shadow-[0_0_12px_rgba(208,212,247,0.18)]"
          :class="isProfileActive ? 'bg-[#D0D4F7]/10 shadow-[0_0_12px_rgba(208,212,247,0.18)] ring-1 ring-[#D0D4F7]/40' : ''"
          title="Artist Profile">
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

        <!-- Logout Button -->
        <button
          @click="handleLogout"
          class="flex items-center justify-center p-2 sm:p-2.5 rounded-full transition-all duration-300 cursor-pointer hover:bg-white/5"
          title="Log Out">
          <Icon
            name="ic:outline-vpn-key-off"
            class="text-xl sm:text-2xl text-[#C7C5CE] transition-all duration-300 hover:text-[#ff3c3c]" />
        </button>
      </div>
    </div>

    <!-- Mobile Sub-Nav Links (Mobile Screens < 640px) -->
    <div class="flex sm:hidden items-center justify-around px-4 py-2.5 border-t border-[#46464D]/30 bg-[#0E0E10]/90 backdrop-blur-md">
      <button
        @click="navigateTo('/Artisthome')"
        class="py-1 px-3 text-xs font-medium transition-all duration-300 cursor-pointer"
        :class="isDiscoverActive
          ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
          : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7]'">
        Discover
      </button>

      <button
        @click="navigateTo('/ArtistNavArtists')"
        class="py-1 px-3 text-xs font-medium transition-all duration-300 cursor-pointer"
        :class="isArtistsActive
          ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
          : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7]'">
        Artists
      </button>

      <button
        @click="navigateTo('/ArtistNavEvents')"
        class="py-1 px-3 text-xs font-medium transition-all duration-300 cursor-pointer"
        :class="isEventsActive
          ? 'text-[#D0D4F7] border-b-2 border-[#D0D4F7]'
          : 'text-[#C7C5CE] border-b-2 border-transparent hover:text-[#D0D4F7]'">
        Events
      </button>
    </div>
  </nav>
</template>
