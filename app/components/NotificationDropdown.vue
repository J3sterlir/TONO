<template>
  <div ref="dropdownContainerRef" class="relative">
    <!-- ==================================================== -->
    <!-- 1. Trigger Bell Button                               -->
    <!-- ==================================================== -->
    <button
      type="button"
      @click="toggleDropdown"
      class="relative flex items-center justify-center p-2 sm:p-2.5 rounded-full transition-all duration-300 cursor-pointer hover:bg-white/5 group"
      :class="isOpen ? 'bg-white/10 ring-1 ring-[#D0D4F7]/40' : ''"
      aria-label="Open notifications"
      :title="unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'"
    >
      <Icon
        name="ic:baseline-notifications-none"
        class="text-xl sm:text-2xl transition-all duration-300 group-hover:scale-105"
        :class="isOpen ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] group-hover:text-[#D0D4F7]'"
      />

      <!-- Dynamic Unread Counter Badge -->
      <span
        v-if="unreadCount > 0"
        class="flex items-center justify-center absolute -top-0.5 -right-0.5 px-0.2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#D0D4F7] text-[#131315] shadow-md min-w-4.5 h-4.5 text-center leading-tight ring-2 ring-[#131315]"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- ==================================================== -->
    <!-- 2. Non-Intrusive Floating Live Toast Banner          -->
    <!-- Appears for 4.5s when live event arrives and closed   -->
    <!-- ==================================================== -->
    <Transition name="fade-slide">
      <div
        v-if="incomingAlert && !isOpen"
        @click="openAndHighlight(incomingAlert)"
        class="fixed top-20 right-4 z-50 max-w-sm bg-[#1C1C1F]/95 backdrop-blur-md border border-[#D0D4F7]/40 rounded-2xl p-3.5 shadow-2xl flex items-start gap-3 cursor-pointer hover:border-[#D0D4F7] transition-all"
      >
        <span class="w-2.5 h-2.5 rounded-full bg-[#D0D4F7] shadow-[0_0_8px_#D0D4F7] shrink-0 mt-1 animate-ping"></span>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-white truncate">{{ incomingAlert.title }}</p>
          <p class="text-[11px] text-gray-300 line-clamp-1" v-html="formatSubtitle(incomingAlert.subtitle)"></p>
          <span class="text-[10px] font-mono text-[#D0D4F7] mt-0.5 block">Click to view update</span>
        </div>
        <button
          type="button"
          @click.stop="incomingAlert = null"
          class="text-gray-400 hover:text-white p-1"
        >
          <Icon name="ic:round-close" class="text-sm" />
        </button>
      </div>
    </Transition>

    <!-- ==================================================== -->
    <!-- 3. Desktop Popover Dropdown (>= 640px)               -->
    <!-- ==================================================== -->
    <Transition name="dropdown-pop">
      <div
        v-if="isOpen && isDesktop"
        class="absolute right-0 top-full mt-2 w-105 max-w-[calc(100vw-2rem)] bg-[#1C1C1F] border border-[#2A2A2E] rounded-3xl shadow-2xl overflow-hidden font-Sora flex flex-col z-50"
      >
        <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#2A2A2E]/60">
          <div class="flex items-center gap-2.5">
            <h2 class="text-xl font-bold text-white tracking-tight">Notifications</h2>
            <span
              v-if="unreadCount > 0"
              class="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#D0D4F7]/15 text-[#D0D4F7] border border-[#D0D4F7]/30"
            >
              {{ unreadCount }} new
            </span>
          </div>
          <button
            type="button"
            @click="markAllAsRead"
            class="text-xs font-medium text-[#D0D4F7] hover:text-white hover:underline transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="unreadCount === 0"
          >
            Mark all as read
          </button>
        </div>

        <!-- Filter Tabs: All vs Unread -->
        <div class="flex items-center gap-2 px-5 py-3 border-b border-[#2A2A2E]/40">
          <button
            type="button"
            @click="filter = 'All'"
            class="px-4 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5"
            :class="filter === 'All'
              ? 'bg-[#D0D4F7]/20 border-[#D0D4F7]/50 text-[#D0D4F7] font-semibold shadow-sm'
              : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5'"
          >
            <span>All</span>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10">{{ notificationsList.length }}</span>
          </button>
          <button
            type="button"
            @click="filter = 'Unread'"
            class="px-4 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5"
            :class="filter === 'Unread'
              ? 'bg-[#D0D4F7]/20 border-[#D0D4F7]/50 text-[#D0D4F7] font-semibold shadow-sm'
              : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5'"
          >
            <span>Unread</span>
            <span v-if="unreadCount > 0" class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#D0D4F7]/30 text-[#D0D4F7] font-bold">{{ unreadCount }}</span>
          </button>
        </div>

        <!-- Feed List -->
        <div class="flex flex-col gap-4 p-4 overflow-y-auto max-h-140 scrollbar-thin scrollbar-thumb-[#2A2A2E]">
          <NotificationFeedContent
            :filtered-notifications="filteredNotifications"
            :new-notifications="newNotifications"
            :earlier-notifications="earlierNotifications"
            :confirming-action-item="confirmingActionItem"
            @mark-read="handleItemClick"
            @action-primary="handleActionPrimary"
            @action-secondary="handleActionSecondary"
            @confirm-guard-rail="executeGuardRail"
            @cancel-guard-rail="confirmingActionItem = null"
          />
        </div>
      </div>
    </Transition>

    <!-- ==================================================== -->
    <!-- 4. Mobile Full-Screen Modal (< 640px)                -->
    <!-- ==================================================== -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="isOpen && !isDesktop"
          class="fixed inset-0 z-50 bg-[#131315]/98 backdrop-blur-xl flex flex-col font-Sora p-4"
        >
          <!-- Mobile Top Navigation Header -->
          <div class="flex items-center justify-between pb-3 border-b border-[#2A2A2E]">
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold text-white">Notifications</h2>
              <span
                v-if="unreadCount > 0"
                class="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#D0D4F7]/20 text-[#D0D4F7] border border-[#D0D4F7]/40"
              >
                {{ unreadCount }}
              </span>
            </div>

            <div class="flex items-center gap-3">
              <button
                type="button"
                @click="markAllAsRead"
                class="text-xs font-semibold text-[#D0D4F7] hover:underline cursor-pointer disabled:opacity-40"
                :disabled="unreadCount === 0"
              >
                Mark all as read
              </button>

              <!-- Prominent Mobile Close Button (X) -->
              <button
                type="button"
                @click="isOpen = false"
                class="w-9 h-9 rounded-full bg-[#222228] border border-[#3A3A42] flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#303038] active:scale-95 transition-all cursor-pointer"
                title="Close notifications"
                aria-label="Close notifications"
              >
                <Icon name="ic:round-close" class="text-xl" />
              </button>
            </div>
          </div>

          <!-- Mobile Filter Tabs -->
          <div class="flex items-center gap-2 py-3 border-b border-[#2A2A2E]/50">
            <button
              type="button"
              @click="filter = 'All'"
              class="px-4 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5"
              :class="filter === 'All'
                ? 'bg-[#D0D4F7]/20 border-[#D0D4F7]/50 text-[#D0D4F7] font-semibold'
                : 'bg-transparent border-transparent text-gray-400 hover:text-white'"
            >
              <span>All</span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10">{{ notificationsList.length }}</span>
            </button>
            <button
              type="button"
              @click="filter = 'Unread'"
              class="px-4 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5"
              :class="filter === 'Unread'
                ? 'bg-[#D0D4F7]/20 border-[#D0D4F7]/50 text-[#D0D4F7] font-semibold'
                : 'bg-transparent border-transparent text-gray-400 hover:text-white'"
            >
              <span>Unread</span>
              <span v-if="unreadCount > 0" class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#D0D4F7]/30 text-[#D0D4F7] font-bold">{{ unreadCount }}</span>
            </button>
          </div>

          <!-- Mobile Scrollable Feed List -->
          <div class="flex-1 overflow-y-auto pt-3 pb-8 space-y-4">
            <NotificationFeedContent
              :filtered-notifications="filteredNotifications"
              :new-notifications="newNotifications"
              :earlier-notifications="earlierNotifications"
              :confirming-action-item="confirmingActionItem"
              @mark-read="handleItemClick"
              @action-primary="handleActionPrimary"
              @action-secondary="handleActionSecondary"
              @confirm-guard-rail="executeGuardRail"
              @cancel-guard-rail="confirmingActionItem = null"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useNotifications, type NotificationItem } from '~/composables/useNotifications'
import NotificationFeedContent from '~/components/NotificationFeedContent.vue'

const props = withDefaults(
  defineProps<{
    currentRole?: 'Artist' | 'User' | 'Business'
  }>(),
  {
    currentRole: 'User'
  }
)

const dropdownContainerRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const isDesktop = ref(true)

const user = useSupabaseUser()

const {
  notificationsList,
  filteredNotifications,
  newNotifications,
  earlierNotifications,
  unreadCount,
  incomingAlert,
  filter,
  fetchNotifications,
  subscribeToRealtime,
  unsubscribe,
  markAsRead,
  markAllAsRead,
  handleBandInvite,
  routeToContract
} = useNotifications()

// Inline Guard Rail State: which item has active confirmation prompt
const confirmingActionItem = ref<{ id: string; action: 'Accept' | 'Decline'; item: NotificationItem } | null>(null)

// Check viewport width for responsive popover vs fullscreen modal
const updateViewport = () => {
  if (typeof window !== 'undefined') {
    isDesktop.value = window.innerWidth >= 640
  }
}

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    incomingAlert.value = null
    // Refresh notifications when user opens the dropdown
    await fetchNotifications()
  }
}

const openAndHighlight = (item: NotificationItem) => {
  isOpen.value = true
  incomingAlert.value = null
  markAsRead(item)
}

const handleItemClick = (item: NotificationItem) => {
  markAsRead(item)
  if (item.actionLink && !confirmingActionItem.value) {
    isOpen.value = false
    navigateTo(item.actionLink)
  }
}

// Safely sanitize and format markdown bold tags (**text**) into white highlighted text
const formatSubtitle = (text?: string): string => {
  if (!text) return ''
  const sanitized = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  return sanitized.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
}

// Click outside detection for desktop popover
const handleDocumentClick = (event: MouseEvent) => {
  if (!isOpen.value || !isDesktop.value) return
  if (dropdownContainerRef.value && !dropdownContainerRef.value.contains(event.target as Node)) {
    isOpen.value = false
    confirmingActionItem.value = null
  }
}

// Esc key listener to close dropdown/modal
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
    confirmingActionItem.value = null
  }
}

// Handle notification actions (Accept/Decline with Guard Rails or Review Contract)
const handleActionPrimary = (item: NotificationItem) => {
  if (item.actionPrimary === 'Accept' && (item.type === 'band_invite' || item.entityType === 'BAND_MEMBERS')) {
    confirmingActionItem.value = { id: item.id, action: 'Accept', item }
    return
  }

  if (item.actionPrimary === 'Review Contract' || item.actionPrimary === 'View Contract') {
    isOpen.value = false
    routeToContract(item, props.currentRole)
    return
  }

  if (item.actionLink) {
    isOpen.value = false
    markAsRead(item)
    navigateTo(item.actionLink)
    return
  }

  markAsRead(item)
}

const handleActionSecondary = (item: NotificationItem) => {
  if (item.actionSecondary === 'Decline' && (item.type === 'band_invite' || item.entityType === 'BAND_MEMBERS')) {
    confirmingActionItem.value = { id: item.id, action: 'Decline', item }
    return
  }

  markAsRead(item)
}

// Execute Guard Rail Confirmation
const executeGuardRail = async (action: 'Accept' | 'Decline', item: NotificationItem) => {
  const isAccept = action === 'Accept'
  await handleBandInvite(item, isAccept)
  confirmingActionItem.value = null
}

// Body scroll lock on mobile when modal is active
watch(isOpen, (open) => {
  if (typeof document !== 'undefined') {
    if (open && !isDesktop.value) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
})

// Auto-refresh when tab gains focus
const handleVisibilityChange = async () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    await fetchNotifications()
  }
}

// React to user auth state changes / async session hydration
watch(
  () => user.value?.id,
  async (newId) => {
    if (newId) {
      await fetchNotifications()
      await subscribeToRealtime()
    } else {
      unsubscribe()
      notificationsList.value = []
    }
  },
  { immediate: true }
)

onMounted(async () => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
  document.addEventListener('pointerdown', handleDocumentClick)
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  await fetchNotifications()
  await subscribeToRealtime()
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateViewport)
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', handleDocumentClick)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    document.body.style.overflow = ''
  }
  unsubscribe()
})
</script>

<style scoped>
.dropdown-pop-enter-active,
.dropdown-pop-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-pop-enter-from,
.dropdown-pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
