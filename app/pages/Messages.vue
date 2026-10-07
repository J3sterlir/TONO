<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import {
  useMessaging,
  type MessageItem,
  type ConversationThread,
  type LinkPreviewData,
} from '~/composables/useMessaging'
import { useTonoAuth } from '~/composables/useTonoAuth'

definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const user = useSupabaseUser()
const { fetchCurrentUserProfile } = useTonoAuth()

// Dynamic Navigation Role
const currentUserRole = useState<'artist' | 'user' | 'business' | null>('tono_nav_role', () => null)

// Messaging Composable
const {
  threads,
  activeThread,
  messages,
  isLoadingThreads,
  isLoadingMessages,
  isSending,
  errorMessage,
  formatTimeAgo,
  formatClockTime,
  formatLastActive,
  fetchThreads,
  selectThread,
  sendMessage,
  editMessage,
  unsendMessage,
  setupRealtime,
  cleanupRealtime,
} = useMessaging()

// Mobile view state: 'list' (conversations list) | 'chat' (active chat thread)
const mobileView = ref<'list' | 'chat'>('list')

// Search filter in conversations
const searchQuery = ref('')
const filteredThreads = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return threads.value
  return threads.value.filter((t) => {
    return (
      t.participant.displayName.toLowerCase().includes(query) ||
      t.participant.username.toLowerCase().includes(query) ||
      t.lastMessageSnippet.toLowerCase().includes(query)
    )
  })
})

// Input text & staged attachments
const messageText = ref('')
const stagedFiles = ref<File[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const isCompressingPhotos = ref(false)
const inputToast = ref('')

// Lightbox for photos
const lightboxImageUrl = ref<string | null>(null)

// Editing state
const editingMessage = ref<MessageItem | null>(null)
const editInputText = ref('')

// Unsend confirm state
const unsendConfirmMessage = ref<MessageItem | null>(null)

// Disable background scroll while any modal/lightbox is active
useModalScrollLock(() => Boolean(editingMessage.value || unsendConfirmMessage.value || lightboxImageUrl.value))

// Scroll container reference
const messagesContainerRef = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
  }
}

// --- LINK PARSING & DYNAMIC LINK PREVIEW SYSTEM ---
interface ContentPart {
  text: string
  isUrl: boolean
  href?: string
}

// Comprehensive URL detection supporting http/https and www with balanced punctuation handling
const URL_PARSER_REGEX = /(?:https?:\/\/|www\.)[^\s<>()]+(?:\([^\s<>()]*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])/gi

const parseMessageContentParts = (content: string): ContentPart[] => {
  if (!content) return []
  const parts: ContentPart[] = []
  let lastIndex = 0
  const regex = new RegExp(URL_PARSER_REGEX.source, 'gi')
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: content.slice(lastIndex, match.index),
        isUrl: false,
      })
    }
    const matchedUrl = match[0]
    const href = matchedUrl.startsWith('http://') || matchedUrl.startsWith('https://')
      ? matchedUrl
      : `https://${matchedUrl}`

    parts.push({
      text: matchedUrl,
      isUrl: true,
      href,
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push({
      text: content.slice(lastIndex),
      isUrl: false,
    })
  }

  return parts
}

// Reactive store for link previews fetched dynamically (e.g. for existing messages)
const dynamicLinkPreviews = ref<Record<string, LinkPreviewData>>({})
const fetchingPreviewIds = new Set<string>()

const extractFirstUrl = (text: string): string | null => {
  if (!text) return null
  const regex = new RegExp(URL_PARSER_REGEX.source, 'i')
  const match = text.match(regex)
  return match ? match[0] : null
}

const resolveLinkPreview = (msg: MessageItem): LinkPreviewData | null => {
  if (msg.metadata?.link_preview && msg.metadata.link_preview.title) {
    return msg.metadata.link_preview
  }
  return dynamicLinkPreviews.value[msg.id] || null
}

const fetchMissingPreviews = async (msgList: MessageItem[]) => {
  for (const msg of msgList) {
    if (msg.isDeleted || !msg.content) continue
    if (msg.metadata?.link_preview && msg.metadata.link_preview.title) continue
    if (dynamicLinkPreviews.value[msg.id] || fetchingPreviewIds.has(msg.id)) continue

    const url = extractFirstUrl(msg.content)
    if (!url) continue

    fetchingPreviewIds.add(msg.id)
    try {
      let cleanUrl = url.replace(/[.,!?:;)\]]+$/, '')
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl
      }
      const res = await $fetch<any>('/api/link-preview', {
        query: { url: cleanUrl },
      })
      if (res?.success && res.preview) {
        dynamicLinkPreviews.value = {
          ...dynamicLinkPreviews.value,
          [msg.id]: res.preview,
        }
      }
    } catch {
      // Non-blocking
    } finally {
      fetchingPreviewIds.delete(msg.id)
    }
  }
}

// Watch messages length & active thread to auto scroll and fetch missing previews
watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
    if (messages.value.length > 0) {
      fetchMissingPreviews(messages.value)
    }
  }
)

watch(
  () => activeThread.value?.threadId,
  () => {
    if (messages.value.length > 0) {
      fetchMissingPreviews(messages.value)
    }
  }
)

// File selection handler
const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const selected = Array.from(target.files)
  for (const file of selected) {
    // Photos: auto compressed later, but reject if > 25MB raw to avoid canvas crash
    if (file.type && file.type.startsWith('image/')) {
      if (file.size > 25 * 1024 * 1024) {
        showInputToast(`Image "${file.name}" is too large (>25MB).`)
        continue
      }
      stagedFiles.value.push(file)
    } else {
      // Documents: strictly <= 10MB
      if (file.size > 10 * 1024 * 1024) {
        showInputToast(`Document "${file.name}" exceeds the 10MB limit.`)
        continue
      }
      stagedFiles.value.push(file)
    }
  }

  // Reset file input
  target.value = ''
}

const removeStagedFile = (index: number) => {
  stagedFiles.value.splice(index, 1)
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const showInputToast = (msg: string) => {
  inputToast.value = msg
  setTimeout(() => {
    inputToast.value = ''
  }, 4000)
}

// Live detected link in input
const detectedLink = computed(() => {
  const match = messageText.value.match(/(https?:\/\/[^\s]+)/i)
  return match ? match[0] : null
})

// Sending message
const handleSendMessage = async () => {
  const text = messageText.value.trim()
  if (!text && stagedFiles.value.length === 0) return
  if (!activeThread.value) return

  isCompressingPhotos.value = stagedFiles.value.some((f) => f.type.startsWith('image/'))

  const success = await sendMessage(text, stagedFiles.value)
  isCompressingPhotos.value = false

  if (success) {
    messageText.value = ''
    stagedFiles.value = []
    scrollToBottom()
  } else if (errorMessage.value) {
    showInputToast(errorMessage.value)
  }
}

// Open chat from list
const handleSelectThread = async (threadId: string) => {
  await selectThread(threadId)
  mobileView.value = 'chat'
  // Sync URL query
  router.replace({ query: { ...route.query, threadId } })
  scrollToBottom()
}

// Back arrow click on mobile
const handleMobileBack = () => {
  mobileView.value = 'list'
  // Remove threadId from query
  const query = { ...route.query }
  delete query.threadId
  router.replace({ query })
}

// Editing actions
const openEditModal = (msg: MessageItem) => {
  if (!msg.canEditOrUnsend) {
    showInputToast('Editing window has expired (10-minute limit).')
    return
  }
  editingMessage.value = msg
  editInputText.value = msg.content
}

const handleSaveEdit = async () => {
  if (!editingMessage.value) return
  if (!editInputText.value.trim()) return

  const targetMsg = editingMessage.value
  const success = await editMessage(targetMsg.id, editInputText.value.trim())
  if (success) {
    delete dynamicLinkPreviews.value[targetMsg.id]
    editingMessage.value = null
    editInputText.value = ''
    fetchMissingPreviews(messages.value)
  }
}

// Unsend actions
const openUnsendConfirm = (msg: MessageItem) => {
  if (!msg.canEditOrUnsend) {
    showInputToast('Unsend window has expired (10-minute limit).')
    return
  }
  unsendConfirmMessage.value = msg
}

const handleConfirmUnsend = async () => {
  if (!unsendConfirmMessage.value) return
  const success = await unsendMessage(unsendConfirmMessage.value.id)
  if (success) {
    unsendConfirmMessage.value = null
  }
}

// Menu dropdown state (click to open, click outside to close)
const currentUserId = ref<string>('')
const activeMenuMessageId = ref<string | null>(null)

const toggleActionMenu = (id: string) => {
  activeMenuMessageId.value = activeMenuMessageId.value === id ? null : id
}

const handleWindowClick = () => {
  activeMenuMessageId.value = null
}

// Check initial role and threads on mount
onMounted(async () => {
  const supabase = useSupabaseClient()
  const uid = user.value?.id || (await supabase.auth.getUser()).data.user?.id
  if (uid) {
    currentUserId.value = uid
    try {
      const profile = await fetchCurrentUserProfile(uid)
      if (profile?.artistProfile) {
        currentUserRole.value = 'artist'
      } else if (profile?.businessProfile) {
        currentUserRole.value = 'business'
      } else {
        currentUserRole.value = 'user'
      }
    } catch {
      currentUserRole.value = 'user'
    }

    await fetchThreads()
    setupRealtime()

    // Deep link from query params (e.g. /Messages?threadId=xxx)
    const queryThreadId = route.query.threadId as string
    if (queryThreadId) {
      await selectThread(queryThreadId)
      mobileView.value = 'chat'
      scrollToBottom()
    }
  }

  if (import.meta.client) {
    window.addEventListener('click', handleWindowClick)
  }
})

// Watch route query changes (e.g. back/forward button or external navigation)
watch(
  () => route.query.threadId,
  async (newThreadId) => {
    if (newThreadId && typeof newThreadId === 'string') {
      if (activeThread.value?.threadId !== newThreadId) {
        await selectThread(newThreadId)
        mobileView.value = 'chat'
        scrollToBottom()
      }
    } else {
      activeThread.value = null
      mobileView.value = 'list'
    }
  }
)

onBeforeUnmount(() => {
  cleanupRealtime()
  if (import.meta.client) {
    window.removeEventListener('click', handleWindowClick)
  }
})
</script>

<template>
  <div class="flex flex-col h-screen bg-[#0E0E10] text-white font-HankenGrotesk overflow-hidden select-text">
    <!-- Dynamic Top Navigation according to logged in user role -->
    <ArtistNav v-if="currentUserRole === 'artist'" />
    <BusinessNav v-else-if="currentUserRole === 'business'" />
    <UserNav v-else-if="currentUserRole === 'user'" />
    <nav v-else class="h-16 bg-[#131315]/90 border-b border-[#46464D]/75"></nav>

    <!-- Main Container: Dual-Pane on Desktop, Single-Pane State Machine on Mobile -->
    <div class="flex flex-1 overflow-hidden relative">
      <!-- 1. LEFT PANE: Conversations List -->
      <aside
        class="flex-col bg-[#131315] border-r border-[#46464D]/60 transition-all duration-300 md:flex md:w-80 lg:w-96 shrink-0 h-full"
        :class="mobileView === 'list' ? 'flex w-full' : 'hidden md:flex'"
      >
        <!-- Header & Search -->
        <div class="p-4 sm:p-5 flex flex-col gap-4 border-b border-[#46464D]/30">
          <div class="flex items-center justify-between">
            <h1 class="text-xl sm:text-2xl font-bold font-Sora tracking-tight text-white flex items-center gap-2">
              <span>Messages</span>
              <span
                v-if="threads.length > 0"
                class="text-xs font-mono px-2 py-0.5 rounded-full bg-[#D0D4F7]/15 text-[#D0D4F7]"
              >
                {{ threads.length }}
              </span>
            </h1>
          </div>

          <!-- Search Input -->
          <div class="relative w-full">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search conversations..."
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1C1C1F] border border-[#46464D]/40 text-sm text-[#E5E1E4] placeholder-[#8E8B94] focus:outline-none focus:border-[#D0D4F7]/70 transition-colors"
            />
            <Icon
              name="mdi:magnify"
              class="absolute left-3 top-3 text-lg text-[#8E8B94]"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-3 top-3 text-sm text-[#8E8B94] hover:text-white cursor-pointer"
            >
              <Icon name="mdi:close" />
            </button>
          </div>
        </div>

        <!-- Conversations Stream -->
        <div class="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
          <!-- Loading Skeletons -->
          <div v-if="isLoadingThreads" class="p-4 space-y-3">
            <div v-for="i in 4" :key="i" class="flex items-center gap-3 p-3 rounded-2xl bg-white/5 animate-pulse">
              <div class="w-12 h-12 rounded-full bg-[#2A2A2E] shrink-0"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3.5 bg-[#2A2A2E] rounded-md w-28"></div>
                <div class="h-3 bg-[#2A2A2E] rounded-md w-44"></div>
              </div>
            </div>
          </div>

          <!-- Empty State (No threads or filtered out) -->
          <div
            v-else-if="filteredThreads.length === 0"
            class="flex flex-col items-center justify-center text-center p-8 h-64 text-[#8E8B94]"
          >
            <div class="w-12 h-12 rounded-full bg-[#1C1C1F] flex items-center justify-center mb-3">
              <Icon name="mdi:message-outline" class="text-2xl text-[#D0D4F7]/60" />
            </div>
            <p class="text-sm font-medium text-white mb-1">
              {{ searchQuery ? 'No matching conversations' : 'No messages yet' }}
            </p>
            <p class="text-xs text-[#8E8B94] max-w-xs">
              {{
                searchQuery
                  ? 'Try searching with a different name or keyword.'
                  : 'Browse local artists and click "Chat Now" on their profile to start chatting!'
              }}
            </p>
          </div>

          <!-- Thread Items -->
          <div
            v-else
            v-for="thread in filteredThreads"
            :key="thread.threadId"
            @click="handleSelectThread(thread.threadId)"
            class="flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer transition-all duration-200 border"
            :class="
              activeThread?.threadId === thread.threadId
                ? 'bg-[#b4b8da]/15 border-[#d0d4f7]/30 shadow-sm'
                : 'border-transparent hover:bg-white/5'
            "
          >
            <!-- Avatar -->
            <div class="relative shrink-0">
              <img
                v-if="thread.participant.avatarUrl"
                :src="thread.participant.avatarUrl"
                :alt="thread.participant.displayName"
                class="w-12 h-12 rounded-full object-cover ring-1 ring-white/10"
              />
              <div
                v-else
                class="w-12 h-12 rounded-full bg-linear-to-br from-[#353437] to-[#1C1C1F] border border-white/10 flex items-center justify-center font-bold text-[#D0D4F7]"
              >
                {{ thread.participant.displayName.charAt(0).toUpperCase() }}
              </div>
              <!-- Online / Active badge -->
              <span
                v-if="thread.participant.isOnline"
                class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#131315] shadow-xs"
                title="Online"
              ></span>
              <span
                v-else
                class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#8E8B94]/50 border-2 border-[#131315]"
                :title="formatLastActive(thread.participant)"
              ></span>
            </div>

            <!-- Content preview -->
            <div class="flex flex-col flex-1 min-w-0 gap-0.5">
              <div class="flex items-center justify-between w-full">
                <div class="flex items-center gap-1.5 min-w-0">
                  <p class="text-sm font-semibold text-[#e5e1e4] truncate">
                    {{ thread.participant.displayName }}
                  </p>
                  <Icon
                    v-if="thread.participant.isVerified"
                    name="ic:round-verified"
                    class="text-emerald-400 text-xs shrink-0"
                  />
                </div>
                <span class="text-[11px] font-medium text-[#8E8B94] shrink-0 ml-2">
                  {{ formatTimeAgo(thread.lastMessageAt) }}
                </span>
              </div>

              <div class="flex items-center justify-between w-full">
                <p
                  class="text-xs truncate"
                  :class="thread.unreadCount > 0 ? 'text-white font-semibold' : 'text-[#8E8B94]'"
                >
                  <template v-if="thread.lastMessageSenderId === currentUserId || (user?.id && thread.lastMessageSenderId === user?.id)">
                    <span class="text-[#D0D4F7] font-medium">You: </span>
                  </template>
                  <template v-else-if="thread.lastMessageSenderId">
                    <span class="text-gray-300 font-medium">{{ thread.participant.displayName || thread.participant.username }}: </span>
                  </template>
                  <span>{{ thread.lastMessageSnippet }}</span>
                </p>
                <!-- Unread count badge -->
                <span
                  v-if="thread.unreadCount > 0"
                  class="flex items-center justify-center min-w-4 h-4 px-1.5 rounded-full bg-[#D0D4F7] text-[#0E0E10] text-[10px] font-bold shrink-0 ml-2 shadow-xs"
                >
                  {{ thread.unreadCount }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 2. RIGHT PANE: Active Chat Thread Stream -->
      <main
        class="flex-col flex-1 h-full bg-[#0E0E10] relative"
        :class="mobileView === 'chat' ? 'flex w-full' : 'hidden md:flex'"
      >
        <!-- A. Empty State (No Active Thread Selected on Desktop) -->
        <div
          v-if="!activeThread"
          class="hidden md:flex flex-col items-center justify-center text-center p-8 h-full bg-linear-to-b from-[#131315]/50 to-[#0E0E10]"
        >
          <div class="w-20 h-20 rounded-full bg-[#1C1C1F] border border-[#46464D]/40 flex items-center justify-center mb-4 shadow-xl">
            <Icon name="mdi:message-text-outline" class="text-4xl text-[#D0D4F7]" />
          </div>
          <h2 class="text-xl font-bold font-Sora text-white mb-2">Select a Conversation</h2>
          <p class="text-sm text-[#8E8B94] max-w-sm mb-6 leading-relaxed">
            Choose an ongoing chat from your list on the left, or visit an artist's public page and click
            <span class="text-[#D0D4F7] font-medium">"Chat Now"</span> to start a new discussion.
          </p>
          <NuxtLink
            to="/UserNavArtists"
            class="px-5 py-2.5 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs sm:text-sm font-semibold transition-all shadow-md cursor-pointer"
          >
            Explore Artists
          </NuxtLink>
        </div>

        <!-- B. Active Conversation Container -->
        <div v-else class="flex flex-col h-full w-full">
          <!-- Active Chat Header -->
          <header class="h-18 w-full px-4 sm:px-6 bg-[#131315] border-b border-[#46464D]/60 flex items-center justify-between shrink-0 z-10">
            <div class="flex items-center gap-3 min-w-0">
              <!-- Mobile Back Button -->
              <button
                @click="handleMobileBack"
                class="flex md:hidden p-2 -ml-1 text-[#8E8B94] hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                title="Back to conversations"
              >
                <Icon name="mdi:arrow-left" class="text-2xl" />
              </button>

              <!-- Participant Avatar -->
              <div class="relative shrink-0">
                <img
                  v-if="activeThread.participant.avatarUrl"
                  :src="activeThread.participant.avatarUrl"
                  :alt="activeThread.participant.displayName"
                  class="w-10 h-10 rounded-full object-cover ring-1 ring-[#D0D4F7]/40 shadow-sm"
                />
                <div
                  v-else
                  class="w-10 h-10 rounded-full bg-[#353437] flex items-center justify-center font-bold text-[#D0D4F7]"
                >
                  {{ activeThread.participant.displayName.charAt(0).toUpperCase() }}
                </div>
              </div>

              <!-- Info -->
              <div class="flex flex-col min-w-0 text-left">
                <div class="flex items-center gap-1.5">
                  <span class="font-Sora font-semibold text-sm sm:text-base text-[#e5e1e4] truncate max-w-44 sm:max-w-xs">
                    {{ activeThread.participant.displayName }}
                  </span>
                  <Icon
                    v-if="activeThread.participant.isVerified"
                    name="ic:round-verified"
                    class="text-emerald-400 text-sm shrink-0"
                  />
                </div>
                <div class="flex items-center gap-1.5 text-xs text-[#8E8B94]">
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    :class="activeThread.participant.isOnline ? 'bg-green-500 shadow-xs shadow-green-500/50' : 'bg-[#8E8B94]/50'"
                  ></span>
                  <span
                    class="font-medium text-[11px]"
                    :class="activeThread.participant.isOnline ? 'text-green-400' : 'text-[#8E8B94]'"
                  >
                    {{ formatLastActive(activeThread.participant) }}
                  </span>
                  <span v-if="activeThread.participant.isArtist" class="text-[#8E8B94] text-[11px]">• Artist</span>
                </div>
              </div>
            </div>

            <!-- Header Actions -->
            <div class="flex items-center gap-2">
              <NuxtLink
                v-if="activeThread.participant.isArtist"
                :to="`/artist/${activeThread.participant.username}`"
                class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C1F] hover:bg-[#28282D] border border-[#46464D]/50 text-xs text-[#D0D4F7] font-medium transition-colors"
                title="View artist public profile"
              >
                <Icon name="mdi:account-outline" class="text-sm" />
                <span>View Profile</span>
              </NuxtLink>
            </div>
          </header>

          <!-- Chat Messages Scrollable Stream -->
          <div
            ref="messagesContainerRef"
            class="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 scrollbar-hide"
          >
            <!-- Loading Messages Spinner -->
            <div v-if="isLoadingMessages" class="flex justify-center items-center py-12">
              <Icon name="svg-spinners:ring-resize" class="text-3xl text-[#D0D4F7]" />
            </div>

            <!-- Empty Thread State -->
            <div
              v-else-if="messages.length === 0"
              class="flex flex-col items-center justify-center text-center py-16 text-[#8E8B94]"
            >
              <div class="w-14 h-14 rounded-full bg-[#1C1C1F] border border-white/10 flex items-center justify-center mb-3">
                <Icon name="mdi:chat-processing-outline" class="text-2xl text-[#D0D4F7]" />
              </div>
              <p class="text-base font-semibold text-white mb-1">
                Say hello to {{ activeThread.participant.displayName }}!
              </p>
              <p class="text-xs text-[#8E8B94] max-w-sm">
                This is the beginning of your conversation. Send a message, photos, or documents below.
              </p>
            </div>

            <!-- Messages List -->
            <template v-else>
              <div v-for="msg in messages" :key="msg.id" class="w-full">
                <!-- Receiver (Current User Message - Right side) -->
                <div v-if="msg.isMine" class="w-full flex justify-end items-end gap-2 group">
                  <!-- Action Dropdown Trigger (Click to open, close on click outside) -->
                  <div
                    class="transition-opacity duration-150 flex items-center gap-1 mb-1 text-[#8E8B94]"
                    :class="activeMenuMessageId === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                  >
                    <div v-if="msg.canEditOrUnsend" class="relative">
                      <button
                        type="button"
                        @click.stop="toggleActionMenu(msg.id)"
                        title="Message options"
                        class="flex p-1.5 hover:text-white hover:bg-[#2A2A2E] rounded-full transition-colors cursor-pointer"
                      >
                        <Icon name="mdi:dots-horizontal" class="text-base" />
                      </button>

                      <!-- Action Menu Popup (Click-based) -->
                      <div
                        v-if="activeMenuMessageId === msg.id"
                        @click.stop
                        class="absolute bottom-full right-0 mb-1 flex flex-col w-32 p-1.5 bg-[#1C1C1F] border border-[#46464D]/60 rounded-xl shadow-xl z-20"
                      >
                        <button
                          @click="openEditModal(msg); activeMenuMessageId = null"
                          class="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-left text-gray-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Icon name="mdi:pencil-outline" class="text-sm" />
                          <span>Edit</span>
                        </button>

                        <button
                          @click="openUnsendConfirm(msg); activeMenuMessageId = null"
                          class="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Icon name="mdi:delete-outline" class="text-sm" />
                          <span>Unsend</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Outgoing Bubble -->
                  <div class="flex flex-col items-end max-w-[85%] sm:max-w-[70%] space-y-1.5">
                    <!-- Unsent message view -->
                    <div
                      v-if="msg.isDeleted"
                      class="px-4 py-2.5 rounded-2xl rounded-br-xs bg-[#1C1C1F]/60 border border-[#46464D]/40 text-[#8E8B94] italic text-xs flex items-center gap-1.5"
                    >
                      <Icon name="mdi:cancel" class="text-sm text-[#8E8B94]" />
                      <span>This message was unsent</span>
                      <span class="text-[10px] text-[#8E8B94]/60 ml-2">{{ formatClockTime(msg.createdAt) }}</span>
                    </div>

                    <!-- Regular Outgoing Content -->
                    <div
                      v-else
                      class="relative px-4 py-3 rounded-2xl rounded-br-xs bg-[#D0D4F7] text-[#0E0E10] shadow-sm text-left"
                    >
                      <!-- Attached Photos -->
                      <div v-if="msg.attachments.some(a => a.type.startsWith('image/'))" class="mb-2 space-y-1.5">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <template v-for="att in msg.attachments" :key="att.id">
                            <div
                              v-if="att.type.startsWith('image/')"
                              @click="lightboxImageUrl = att.url"
                              class="rounded-xl overflow-hidden cursor-pointer group/img relative border border-black/10 bg-black/5"
                            >
                              <img
                                :src="att.url"
                                :alt="att.name"
                                class="w-full max-h-60 object-cover group-hover/img:scale-105 transition-transform duration-200"
                              />
                            </div>
                          </template>
                        </div>
                      </div>

                      <!-- Attached Documents -->
                      <div v-if="msg.attachments.some(a => !a.type.startsWith('image/'))" class="mb-2 space-y-1">
                        <template v-for="att in msg.attachments" :key="att.id">
                          <a
                            v-if="!att.type.startsWith('image/')"
                            :href="att.url"
                            target="_blank"
                            download
                            class="flex items-center gap-2.5 p-2 rounded-xl bg-black/10 hover:bg-black/15 border border-black/10 text-[#0E0E10] transition-colors"
                          >
                            <Icon name="mdi:file-document-outline" class="text-xl shrink-0 text-[#2B2762]" />
                            <div class="flex-1 min-w-0">
                              <p class="text-xs font-semibold truncate">{{ att.name }}</p>
                              <p class="text-[10px] text-[#0E0E10]/70 font-mono">{{ formatFileSize(att.size) }}</p>
                            </div>
                            <Icon name="mdi:download" class="text-base shrink-0" />
                          </a>
                        </template>
                      </div>

                      <!-- Text Content -->
                      <p v-if="msg.content" class="text-sm font-medium leading-relaxed wrap-break-word whitespace-pre-wrap">
                        <template v-for="(part, idx) in parseMessageContentParts(msg.content)" :key="idx">
                          <a
                            v-if="part.isUrl"
                            :href="part.href"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="underline underline-offset-2 font-semibold text-[#181145] hover:text-black transition-colors break-all"
                            @click.stop
                          >{{ part.text }}</a>
                          <span v-else>{{ part.text }}</span>
                        </template>
                      </p>

                      <!-- Open Graph Link Card Preview -->
                      <div v-if="resolveLinkPreview(msg)" class="mt-2.5">
                        <a
                          :href="resolveLinkPreview(msg)!.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="block rounded-xl overflow-hidden bg-black/10 hover:bg-black/15 border border-black/10 transition-all duration-200 group/preview"
                          @click.stop
                        >
                          <div v-if="resolveLinkPreview(msg)!.image" class="relative overflow-hidden bg-black/20 max-h-48">
                            <img
                              :src="resolveLinkPreview(msg)!.image"
                              :alt="resolveLinkPreview(msg)!.title"
                              class="w-full h-36 object-cover group-hover/preview:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div
                              v-if="resolveLinkPreview(msg)!.site_name?.toLowerCase().includes('youtube')"
                              class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/preview:bg-black/30 transition-colors"
                            >
                              <div class="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg">
                                <Icon name="mdi:play" class="text-xl" />
                              </div>
                            </div>
                          </div>
                          <div class="p-2.5 text-left">
                            <span class="text-[10px] uppercase font-bold text-[#3E388D] tracking-wider block">
                              {{ resolveLinkPreview(msg)!.site_name || 'Link' }}
                            </span>
                            <h4 class="text-xs font-bold text-[#0E0E10] line-clamp-1 group-hover/preview:text-[#181145] transition-colors">
                              {{ resolveLinkPreview(msg)!.title }}
                            </h4>
                            <p v-if="resolveLinkPreview(msg)!.description" class="text-[11px] text-[#0E0E10]/80 line-clamp-2 mt-0.5 leading-relaxed">
                              {{ resolveLinkPreview(msg)!.description }}
                            </p>
                          </div>
                        </a>
                      </div>

                      <!-- Footer: Timestamp, Edited tag & Read status -->
                      <div class="flex items-center justify-end gap-1.5 mt-1 select-none text-[10px] text-[#0E0E10]/70 font-medium">
                        <span v-if="msg.isEdited" class="italic">(edited)</span>
                        <span>{{ formatClockTime(msg.createdAt) }}</span>
                        <Icon
                          name="mdi:check-all"
                          class="text-sm"
                          :class="msg.isRead ? 'text-[#3E388D]' : 'text-[#0E0E10]/40'"
                          :title="msg.isRead ? 'Read' : 'Delivered'"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Sender (Recipient Message - Left side) -->
                <div v-else class="w-full flex justify-start items-end gap-3 group">
                  <!-- Avatar -->
                  <div class="shrink-0 mb-1">
                    <img
                      v-if="activeThread.participant.avatarUrl"
                      :src="activeThread.participant.avatarUrl"
                      :alt="activeThread.participant.displayName"
                      class="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <div
                      v-else
                      class="w-8 h-8 rounded-full bg-[#353437] flex items-center justify-center font-bold text-xs text-[#D0D4F7]"
                    >
                      {{ activeThread.participant.displayName.charAt(0).toUpperCase() }}
                    </div>
                  </div>

                  <!-- Incoming Bubble -->
                  <div class="flex flex-col items-start max-w-[85%] sm:max-w-[70%]">
                    <span class="text-[11px] text-[#8E8B94] font-medium ml-1 mb-1">
                      {{ activeThread.participant.displayName }}
                    </span>

                    <!-- Unsent state -->
                    <div
                      v-if="msg.isDeleted"
                      class="px-4 py-2.5 rounded-2xl rounded-bl-xs bg-[#1C1C1F]/60 border border-[#46464D]/40 text-[#8E8B94] italic text-xs flex items-center gap-1.5"
                    >
                      <Icon name="mdi:cancel" class="text-sm text-[#8E8B94]" />
                      <span>This message was unsent</span>
                      <span class="text-[10px] text-[#8E8B94]/60 ml-2">{{ formatClockTime(msg.createdAt) }}</span>
                    </div>

                    <!-- Regular Incoming Content -->
                    <div
                      v-else
                      class="relative px-4 py-3 rounded-2xl rounded-bl-xs bg-[#242428] border border-[#46464D]/30 shadow-sm text-left"
                    >
                      <!-- Attached Photos -->
                      <div v-if="msg.attachments.some(a => a.type.startsWith('image/'))" class="mb-2 space-y-1.5">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <template v-for="att in msg.attachments" :key="att.id">
                            <div
                              v-if="att.type.startsWith('image/')"
                              @click="lightboxImageUrl = att.url"
                              class="rounded-xl overflow-hidden cursor-pointer group/img relative border border-white/10 bg-black/40"
                            >
                              <img
                                :src="att.url"
                                :alt="att.name"
                                class="w-full max-h-60 object-cover group-hover/img:scale-105 transition-transform duration-200"
                              />
                            </div>
                          </template>
                        </div>
                      </div>

                      <!-- Attached Documents -->
                      <div v-if="msg.attachments.some(a => !a.type.startsWith('image/'))" class="mb-2 space-y-1">
                        <template v-for="att in msg.attachments" :key="att.id">
                          <a
                            v-if="!att.type.startsWith('image/')"
                            :href="att.url"
                            target="_blank"
                            download
                            class="flex items-center gap-2.5 p-2 rounded-xl bg-[#1C1C1F] hover:bg-[#28282D] border border-white/10 text-white transition-colors"
                          >
                            <Icon name="mdi:file-document-outline" class="text-xl shrink-0 text-[#D0D4F7]" />
                            <div class="flex-1 min-w-0">
                              <p class="text-xs font-semibold truncate text-[#E5E1E4]">{{ att.name }}</p>
                              <p class="text-[10px] text-[#8E8B94] font-mono">{{ formatFileSize(att.size) }}</p>
                            </div>
                            <Icon name="mdi:download" class="text-base shrink-0 text-[#D0D4F7]" />
                          </a>
                        </template>
                      </div>

                      <!-- Text Content -->
                      <p v-if="msg.content" class="text-sm text-[#E5E1E4] leading-relaxed wrap-break-word whitespace-pre-wrap">
                        <template v-for="(part, idx) in parseMessageContentParts(msg.content)" :key="idx">
                          <a
                            v-if="part.isUrl"
                            :href="part.href"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="underline underline-offset-2 font-medium text-[#D0D4F7] hover:text-white transition-colors break-all"
                            @click.stop
                          >{{ part.text }}</a>
                          <span v-else>{{ part.text }}</span>
                        </template>
                      </p>

                      <!-- Open Graph Link Card Preview -->
                      <div v-if="resolveLinkPreview(msg)" class="mt-2.5">
                        <a
                          :href="resolveLinkPreview(msg)!.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="block rounded-xl overflow-hidden bg-[#1C1C1F] hover:bg-[#26262B] border border-[#46464D]/50 transition-all duration-200 group/preview"
                          @click.stop
                        >
                          <div v-if="resolveLinkPreview(msg)!.image" class="relative overflow-hidden bg-black/30 max-h-48">
                            <img
                              :src="resolveLinkPreview(msg)!.image"
                              :alt="resolveLinkPreview(msg)!.title"
                              class="w-full h-36 object-cover group-hover/preview:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div
                              v-if="resolveLinkPreview(msg)!.site_name?.toLowerCase().includes('youtube')"
                              class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/preview:bg-black/30 transition-colors"
                            >
                              <div class="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg">
                                <Icon name="mdi:play" class="text-xl" />
                              </div>
                            </div>
                          </div>
                          <div class="p-2.5 text-left">
                            <span class="text-[10px] uppercase font-bold text-[#D0D4F7] tracking-wider block">
                              {{ resolveLinkPreview(msg)!.site_name || 'Link' }}
                            </span>
                            <h4 class="text-xs font-bold text-white line-clamp-1 group-hover/preview:text-[#D0D4F7] transition-colors">
                              {{ resolveLinkPreview(msg)!.title }}
                            </h4>
                            <p v-if="resolveLinkPreview(msg)!.description" class="text-[11px] text-[#8E8B94] line-clamp-2 mt-0.5 leading-relaxed">
                              {{ resolveLinkPreview(msg)!.description }}
                            </p>
                          </div>
                        </a>
                      </div>

                      <!-- Footer: Timestamp & Edited tag -->
                      <div class="flex items-center justify-end gap-1.5 mt-1 select-none text-[10px] text-[#8E8B94]">
                        <span v-if="msg.isEdited" class="italic">(edited)</span>
                        <span>{{ formatClockTime(msg.createdAt) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Staged Files Preview Strip (Above Input Bar) -->
          <div
            v-if="stagedFiles.length > 0"
            class="px-4 sm:px-6 py-2 bg-[#17171A] border-t border-[#46464D]/30 flex items-center gap-2 overflow-x-auto scrollbar-hide"
          >
            <div
              v-for="(f, idx) in stagedFiles"
              :key="idx"
              class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#202025] border border-[#46464D]/50 text-xs text-white shrink-0 shadow-xs"
            >
              <Icon
                :name="f.type.startsWith('image/') ? 'mdi:image-outline' : 'mdi:file-document-outline'"
                class="text-base text-[#D0D4F7]"
              />
              <span class="truncate max-w-36">{{ f.name }}</span>
              <span class="text-[10px] text-[#8E8B94] font-mono">({{ formatFileSize(f.size) }})</span>
              <button
                @click="removeStagedFile(idx)"
                class="p-0.5 hover:text-red-400 cursor-pointer ml-1"
                title="Remove"
              >
                <Icon name="mdi:close" class="text-sm" />
              </button>
            </div>
            <span class="text-[11px] text-[#8E8B94] italic shrink-0 ml-1">
              Photos auto-compressed to &le; 1.5MB
            </span>
          </div>

          <!-- Toast in Input Area -->
          <div
            v-if="inputToast"
            class="px-4 py-1.5 bg-red-950/80 border-t border-red-800 text-red-200 text-xs text-center flex items-center justify-center gap-2"
          >
            <Icon name="mdi:alert-circle-outline" class="text-sm" />
            <span>{{ inputToast }}</span>
          </div>

          <!-- Input Bar Container -->
          <div class="px-4 sm:px-8 pt-3 pb-6 bg-[#131315] border-t border-[#46464D]/50 shrink-0">
            <!-- Hidden File Input (10MB docs, images compressed to <= 1.5MB) -->
            <input
              ref="fileInputRef"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.zip,audio/*"
              class="hidden"
              @change="handleFileSelect"
            />

            <div
              class="flex justify-between items-center gap-2 px-4 py-2 rounded-2xl bg-[#1C1C1F] border border-[#42424A]/50 focus-within:border-[#D0D4F7]/60 transition-colors shadow-inner"
            >
              <!-- Attachment Button -->
              <button
                @click="triggerFileInput"
                type="button"
                class="flex items-center p-1.5 rounded-lg text-[#C7C5CE] hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                title="Attach photo (&le;1.5MB) or document (&le;10MB)"
              >
                <Icon name="mdi:plus-circle-outline" class="text-2xl" />
              </button>

              <!-- Text Input -->
              <div class="flex-1 min-w-0 px-2">
                <input
                  v-model="messageText"
                  type="text"
                  :placeholder="`Type a message to ${activeThread.participant.displayName}...`"
                  @keydown.enter.prevent="handleSendMessage"
                  class="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm sm:text-[15px] text-[#E5E1E4] placeholder-[#8E8B94]"
                />
              </div>

              <!-- Send Button -->
              <button
                @click="handleSendMessage"
                :disabled="isSending || (!messageText.trim() && stagedFiles.length === 0)"
                class="flex items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                :class="
                  messageText.trim() || stagedFiles.length > 0
                    ? 'bg-[#D0D4F7] text-[#0E0E10] hover:bg-white shadow-md'
                    : 'text-[#8E8B94] hover:bg-white/5'
                "
                title="Send message (Enter)"
              >
                <Icon v-if="isSending" name="svg-spinners:ring-resize" class="text-xl" />
                <Icon v-else name="mdi:send" class="text-xl" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Edit Message Modal -->
    <div
      v-if="editingMessage"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div class="w-full max-w-md bg-[#18181B] border border-[#46464D]/80 rounded-2xl p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-[#46464D]/40 pb-3">
          <h3 class="font-Sora font-bold text-base text-white flex items-center gap-2">
            <Icon name="mdi:pencil-outline" class="text-[#D0D4F7]" />
            <span>Edit Message</span>
          </h3>
        </div>

        <textarea
          v-model="editInputText"
          rows="4"
          class="w-full p-3 rounded-xl bg-[#202025] border border-[#46464D]/60 text-sm text-[#E5E1E4] focus:outline-none focus:border-[#D0D4F7] resize-none"
        ></textarea>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button
            @click="editingMessage = null"
            class="px-4 py-2 rounded-xl text-xs font-medium text-[#8E8B94] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="handleSaveEdit"
            :disabled="!editInputText.trim()"
            class="px-5 py-2 rounded-xl text-xs font-semibold bg-[#D0D4F7] hover:bg-white text-[#0E0E10] transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>

    <!-- Unsend Confirmation Modal -->
    <div
      v-if="unsendConfirmMessage"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div class="w-full max-w-md bg-[#18181B] border border-red-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
            <Icon name="mdi:delete-alert-outline" class="text-2xl" />
          </div>
          <div>
            <h3 class="font-Sora font-bold text-base text-white">Unsend for Everyone?</h3>
            <p class="text-xs text-[#8E8B94]">
              This will remove the message for all participants in this chat.
            </p>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-[#202025] border border-[#46464D]/40 text-xs text-[#C7C5CE] italic line-clamp-2">
          "{{ unsendConfirmMessage.content }}"
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button
            @click="unsendConfirmMessage = null"
            class="px-4 py-2 rounded-xl text-xs font-medium text-[#8E8B94] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="handleConfirmUnsend"
            class="px-5 py-2 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-400 text-white transition-all shadow-md cursor-pointer"
          >
            Unsend Message
          </button>
        </div>
      </div>
    </div>

    <!-- Photo Lightbox Modal -->
    <div
      v-if="lightboxImageUrl"
      @click="lightboxImageUrl = null"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out animate-in fade-in duration-150"
    >
      <button
        @click="lightboxImageUrl = null"
        class="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
      >
        <Icon name="mdi:close" class="text-2xl" />
      </button>
      <img
        :src="lightboxImageUrl"
        alt="Enlarged photo"
        class="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
      />
    </div>
  </div>
</template>