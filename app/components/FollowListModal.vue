<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSocialFollow, type FollowUserItem } from '~/composables/useSocialFollow'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    initialTab?: 'followers' | 'following'
    accountId: string
    title?: string
  }>(),
  {
    initialTab: 'followers',
    title: ''
  }
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const { fetchFollowersList, fetchFollowingList } = useSocialFollow()

const activeTab = ref<'followers' | 'following'>('followers')
const searchQuery = ref('')
const isLoading = ref(false)
const followers = ref<FollowUserItem[]>([])
const following = ref<FollowUserItem[]>([])

useModalScrollLock(() => props.isOpen)

watch(
  () => [props.isOpen, props.accountId, props.initialTab],
  async ([open, id, tab]) => {
    if (open && id) {
      activeTab.value = (tab as 'followers' | 'following') || 'followers'
      searchQuery.value = ''
      await loadList()
    }
  },
  { immediate: true }
)

const loadList = async () => {
  if (!props.accountId) return
  isLoading.value = true
  try {
    const [followersData, followingData] = await Promise.all([
      fetchFollowersList(props.accountId),
      fetchFollowingList(props.accountId)
    ])
    followers.value = followersData
    following.value = followingData
  } catch (err) {
    console.error('[FollowListModal] Error fetching lists:', err)
  } finally {
    isLoading.value = false
  }
}

const currentList = computed(() => {
  return activeTab.value === 'followers' ? followers.value : following.value
})

const filteredList = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return currentList.value
  return currentList.value.filter(
    (u) =>
      u.displayName.toLowerCase().includes(query) ||
      u.username.toLowerCase().includes(query)
  )
})

const handleUserClick = (user: FollowUserItem) => {
  if (user.profileRoute) {
    emit('close')
    router.push(user.profileRoute)
  }
}

const getInitials = (name: string) => {
  if (!name) return 'U'
  return name.charAt(0).toUpperCase()
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
          @click="emit('close')"
        />

        <!-- Modal Dialog -->
        <div
          class="relative z-10 w-full max-w-md bg-[#18181B] border border-[#2A2A2E] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden font-Geist text-white"
          @click.stop
        >
          <!-- Top Header -->
          <div class="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#2A2A2E]">
            <h2 class="text-base font-semibold font-Sora text-white">
              {{ title || 'Connections' }}
            </h2>
            <button
              @click="emit('close')"
              class="flex p-1 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Close"
            >
              <Icon name="ic:round-close" class="text-xl" />
            </button>
          </div>

          <!-- Tab Bar -->
          <div class="flex items-center border-b border-[#2A2A2E] bg-[#131315]/70 px-4 pt-1">
            <button
              @click="activeTab = 'followers'"
              class="flex-1 py-3 text-xs font-semibold tracking-wide transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer"
              :class="
                activeTab === 'followers'
                  ? 'border-[#D0D4F7] text-[#D0D4F7]'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              "
            >
              <span>Followers</span>
              <span class="text-[11px] px-1.5 py-0.2 rounded-full bg-[#1E1E24] text-gray-300">
                {{ followers.length }}
              </span>
            </button>

            <button
              @click="activeTab = 'following'"
              class="flex-1 py-3 text-xs font-semibold tracking-wide transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer"
              :class="
                activeTab === 'following'
                  ? 'border-[#D0D4F7] text-[#D0D4F7]'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              "
            >
              <span>Following</span>
              <span class="text-[11px] px-1.5 py-0.2 rounded-full bg-[#1E1E24] text-gray-300">
                {{ following.length }}
              </span>
            </button>
          </div>

          <!-- Search Bar -->
          <div class="px-5 py-3 border-b border-[#2A2A2E] bg-[#161618]">
            <div class="flex items-center gap-2.5 bg-[#202025] rounded-xl px-3 py-2 border border-[#2E2E34] focus-within:border-[#D0D4F7]/60 transition-colors">
              <Icon name="ic:baseline-search" class="text-gray-400 text-lg shrink-0" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by name or username..."
                class="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-hidden"
              />
              <button
                v-if="searchQuery"
                @click="searchQuery = ''"
                class="text-gray-500 hover:text-gray-300 text-sm cursor-pointer"
              >
                <Icon name="ic:round-close" />
              </button>
            </div>
          </div>

          <!-- Users List Area -->
          <div class="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-[#2A2A2E]/30">
            <!-- Loading State -->
            <div v-if="isLoading" class="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Icon name="ic:baseline-sync" class="animate-spin text-2xl text-[#D0D4F7]" />
              <span class="text-xs">Loading connections...</span>
            </div>

            <!-- Empty State -->
            <div
              v-else-if="filteredList.length === 0"
              class="py-12 px-4 flex flex-col items-center justify-center text-center gap-2 text-gray-500"
            >
              <Icon name="ic:outline-people-alt" class="text-3xl text-gray-600" />
              <p class="text-xs font-medium text-gray-300">
                {{ searchQuery ? 'No users matching your search' : (activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet') }}
              </p>
              <p v-if="!searchQuery" class="text-[11px] text-gray-500 max-w-xs">
                {{ activeTab === 'followers' ? '' : '' }}
              </p>
            </div>

            <!-- User Row List items (Strict flex row: [fetch profile pic] user name) -->
            <div
              v-else
              v-for="user in filteredList"
              :key="user.accountId"
              @click="handleUserClick(user)"
              class="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#1E1E24]/70 transition-all duration-150 cursor-pointer group"
            >
              <!-- Left: [fetch profile pic] + user name in flex row -->
              <div class="flex items-center gap-3.5 min-w-0">
                <!-- Profile Pic -->
                <div class="relative shrink-0 w-11 h-11 rounded-full overflow-hidden bg-[#24242A] border border-[#2E2E34] flex items-center justify-center">
                  <img
                    v-if="user.profilePicture"
                    :src="user.profilePicture"
                    :alt="user.displayName"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div
                    v-else
                    class="w-full h-full bg-linear-to-br from-[#2E2E35] to-[#1C1C22] flex items-center justify-center font-bold text-[#D0D4F7] text-sm select-none"
                  >
                    {{ getInitials(user.displayName) }}
                  </div>
                </div>

                <!-- User Name & Handle -->
                <div class="flex flex-col min-w-0 text-left">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-xs sm:text-sm font-semibold text-white truncate font-Sora group-hover:text-[#D0D4F7] transition-colors">
                      {{ user.displayName }}
                    </span>
                    <span
                      v-if="user.userType && user.userType !== 'User'"
                      class="text-[10px] px-1.5 py-0.2 rounded-md font-medium shrink-0"
                      :class="user.userType === 'Business' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-[#D0D4F7]/10 text-[#D0D4F7] border border-[#D0D4F7]/20'"
                    >
                      {{ user.userType }}
                    </span>
                  </div>
                  <span class="text-[11px] text-[#8E8B94] truncate">
                    @{{ user.username }}
                  </span>
                </div>
              </div>

              <!-- Right Arrow Indicator -->
              <div v-if="user.profileRoute" class="pr-1 text-gray-500 group-hover:text-white transition-colors">
                <Icon name="ic:baseline-chevron-right" class="text-xl" />
              </div>
            </div>
          </div>

          <!-- Bottom Footer -->
          <div class="p-3 border-t border-[#2A2A2E] bg-[#131315]/80 flex justify-end">
            <button
              @click="emit('close')"
              class="px-4 py-2 rounded-xl bg-[#202025] hover:bg-[#282830] text-xs font-semibold text-gray-200 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
