<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import type { PostItem, PostCommentItem } from '~/composables/useArtistPosts'
import { formatPostTimestamp, formatPostRelativeTime, formatCount, parseCaptionSegments } from '~/utils/postHelpers'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    post: PostItem | null
    artistName?: string
    artistAvatar?: string | null
    artistUsername?: string
  }>(),
  {
    artistName: 'Artist',
    artistAvatar: '',
    artistUsername: '',
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'like-toggled', postId: string): void
  (e: 'comment-added', postId: string): void
}>()

const { posts, comments, isLoadingComments, fetchComments, addComment, toggleLike } = useArtistPosts()
const user = useSupabaseUser()
const { openReportModal } = useModerationReport()

const newCommentText = ref('')
const isPostingComment = ref(false)
const commentsContainerRef = ref<HTMLDivElement | null>(null)

// Local reactive like & comment count state kept in sync with props.post
const isLiked = ref(false)
const likeCount = ref(0)
const commentCount = ref(0)

watch(
  () => [props.post?.POST_ID, props.post?.userHasLiked, props.post?.likeCount, props.post?.commentCount],
  () => {
    if (props.post) {
      isLiked.value = Boolean(props.post.userHasLiked)
      likeCount.value = Number(props.post.likeCount) || 0
      commentCount.value = Number(props.post.commentCount) || 0
    }
  },
  { immediate: true }
)

// Load comments whenever a post is opened
watch(
  () => props.post?.POST_ID,
  async (newPostId) => {
    if (newPostId && props.isOpen) {
      await fetchComments(newPostId)
      scrollToBottom()
    }
  },
  { immediate: true }
)

const scrollToBottom = () => {
  nextTick(() => {
    if (commentsContainerRef.value) {
      commentsContainerRef.value.scrollTop = commentsContainerRef.value.scrollHeight
    }
  })
}

const handleLike = async () => {
  if (!user.value) {
    await navigateTo('/Login')
    return
  }
  const post = props.post
  if (!post) return
  const postId = post.POST_ID
  if (!postId) return

  // 1. Instantly toggle local modal state
  const prevLiked = isLiked.value
  const prevCount = likeCount.value
  const nextLiked = !prevLiked
  const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1))

  isLiked.value = nextLiked
  likeCount.value = nextCount

  // Also update props.post object if present
  post.userHasLiked = nextLiked
  post.likeCount = nextCount

  // 2. Notify parent component to update feed post in parallel
  emit('like-toggled', postId)

  // 3. Persist to server via toggleLike
  try {
    const success = await toggleLike(postId)
    if (!success) {
      // Revert if API rejected or failed
      isLiked.value = prevLiked
      likeCount.value = prevCount
      post.userHasLiked = prevLiked
      post.likeCount = prevCount
      emit('like-toggled', postId)
    }
  } catch (err) {
    console.error('Error toggling like in modal:', err)
    isLiked.value = prevLiked
    likeCount.value = prevCount
    post.userHasLiked = prevLiked
    post.likeCount = prevCount
    emit('like-toggled', postId)
  }
}

const handleAddComment = async () => {
  if (!user.value) {
    await navigateTo('/Login')
    return
  }
  const post = props.post
  if (!post || !newCommentText.value.trim() || isPostingComment.value) return
  const postId = post.POST_ID
  if (!postId) return

  isPostingComment.value = true

  try {
    const result = await addComment(postId, newCommentText.value)
    if (result.success) {
      newCommentText.value = ''
      commentCount.value += 1
      post.commentCount = commentCount.value
      emit('comment-added', postId)
      scrollToBottom()
    }
  } catch (err) {
    console.error('Error adding comment:', err)
  } finally {
    isPostingComment.value = false
  }
}

// Background scroll lock
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

useModalScrollLock(() => props.isOpen)

watch(
  () => props.isOpen,
  (open) => {
    if (import.meta.client) {
      if (open) {
        window.addEventListener('keydown', handleKeyDown)
      } else {
        window.removeEventListener('keydown', handleKeyDown)
        newCommentText.value = ''
      }
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeyDown)
  }
})
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
        v-if="isOpen && post"
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8"
      >
        <!-- A. Backdrop Overlay -->
        <div
          class="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
          @click="emit('close')"
        />

        <!-- B. Modal Container: Adaptive layout based on Media existence -->
        <div
          class="relative z-10 flex flex-col bg-[#18181B] border border-[#2A2A2E] rounded-2xl shadow-2xl overflow-hidden font-Sora text-white"
          :class="
            post.Media
              ? 'md:flex-row h-[85vh] max-h-212.5 w-auto max-w-[92vw]'
              : 'w-full max-w-xl h-auto max-h-[85vh]'
          "
          @click.stop
        >
          <!-- 1. Left: Image Container (ONLY SHOWN IF POST HAS MEDIA) -->
          <div
            v-if="post.Media"
            class="flex items-center justify-center bg-black min-w-0 overflow-hidden flex-1 md:flex-initial"
          >
            <img
              :src="post.Media"
              alt="Post Media"
              class="h-full w-auto max-h-full max-w-full object-contain select-none"
            />
          </div>

          <!-- 2. Content & Comments Sidebar / Single-Column Body -->
          <div
            class="flex flex-col bg-[#18181B] shrink-0"
            :class="
              post.Media
                ? 'w-full md:w-95 lg:w-105 border-t md:border-t-0 md:border-l border-[#2A2A2E] h-full justify-between'
                : 'w-full h-full justify-between'
            "
          >
            <!-- Header: Author Details & Close -->
            <div class="flex items-center justify-between px-5 py-3.5 border-b border-[#2A2A2E] shrink-0">
              <div class="flex items-center gap-3">
                <div
                  class="w-9 h-9 rounded-full overflow-hidden bg-[#24242A] border border-[#2E2E34] shrink-0 flex items-center justify-center"
                >
                  <img
                    v-if="artistAvatar"
                    :src="artistAvatar"
                    :alt="artistName"
                    class="w-full h-full object-cover"
                  />
                  <Icon v-else name="ic:baseline-person" class="text-lg text-[#B4B8DA]" />
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-semibold text-white truncate font-Sora">
                      {{ artistName }}
                    </span>
                    <span
                      v-if="post.Location"
                      class="text-[11px] text-gray-400 font-Geist flex items-center gap-0.5"
                    >
                      <Icon name="ic:outline-location-on" class="text-xs text-[#D0D4F7]" />
                      {{ post.Location }}
                    </span>
                  </div>
                  <span class="text-[11px] text-[#C7C5CE] font-HankenGrotesk">
                    {{ formatPostTimestamp(post.Created_at) }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-1">
                <button
                  v-if="user && post.ARTIST_ID && post.ARTIST_ID !== user.id"
                  type="button"
                  @click="openReportModal({ targetType: 'Post', targetId: post.POST_ID, targetAccountId: post.ARTIST_ID, targetName: artistName, previewSnippet: post.Caption || (post.Media ? '[Media Post]' : undefined) })"
                  class="flex items-center text-gray-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Report Post"
                >
                  <Icon name="ic:round-flag" class="text-lg" />
                </button>
                <button
                  type="button"
                  @click="emit('close')"
                  class="flex text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  title="Close"
                >
                  <Icon name="ic:round-close" class="text-xl" />
                </button>
              </div>
            </div>

            <!-- Middle Scroll Area: Post Caption & Comments History -->
            <div
              ref="commentsContainerRef"
              class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4"
            >
              <!-- Caption Callout Box -->
              <div
                v-if="post.Caption"
                class="p-4 rounded-xl"
                :class="post.Media ? 'bg-[#202025]/50' : 'bg-[#222228]'"
              >
                <p class="text-sm sm:text-base text-gray-200 leading-relaxed font-Geist whitespace-pre-line">
                  <template v-for="(seg, idx) in parseCaptionSegments(post.Caption)" :key="idx">
                    <a
                      v-if="seg.isUrl"
                      :href="seg.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-[#9d87cb] hover:underline break-all"
                      @click.stop
                    >{{ seg.text }}</a>
                    <span v-else>{{ seg.text }}</span>
                  </template>
                </p>
              </div>

              <!-- Likes & Comments Counter Row -->
              <div class="flex items-center justify-between py-2 border-b border-[#2A2A2E] text-xs">
                <div class="flex items-center gap-4">
                  <!-- Like Button -->
                  <button
                    type="button"
                    @click="handleLike"
                    class="flex items-center gap-1.5 cursor-pointer transition-colors"
                    :class="isLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'"
                  >
                    <Icon
                      :name="isLiked ? 'ic:baseline-favorite' : 'ic:baseline-favorite-border'"
                      class="text-lg text-[#D0D4F7] transition-transform active:scale-125"
                    />
                    <span
                      class="font-medium font-Sora"
                      :class="isLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE]'"
                    >
                      {{ formatCount(likeCount) }} {{ likeCount === 1 ? 'like' : 'likes' }}
                    </span>
                  </button>

                  <!-- Comments Count -->
                  <span class="flex items-center gap-1.5 text-[#C7C5CE]">
                    <Icon name="ic:sharp-chat-bubble-outline" class="text-lg text-[#D0D4F7]" />
                    <span class="font-medium font-Sora">
                      {{ formatCount(commentCount) }} {{ commentCount === 1 ? 'comment' : 'comments' }}
                    </span>
                  </span>
                </div>
              </div>

              <!-- Comments Section Header -->
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider font-Sora pt-1">
                Comments
              </div>

              <!-- Loading Comments -->
              <div v-if="isLoadingComments" class="py-6 flex justify-center">
                <Icon name="ic:round-autorenew" class="text-2xl text-[#D0D4F7] animate-spin" />
              </div>

              <!-- Empty Comments State -->
              <div
                v-else-if="comments.length === 0"
                class="py-8 flex flex-col items-center justify-center text-center gap-2 text-gray-500"
              >
                <Icon name="ic:outline-chat" class="text-3xl text-gray-600" />
                <p class="text-xs font-Geist">No comments yet. Be the first to join the conversation!</p>
              </div>

              <!-- Comments List -->
              <div v-else class="space-y-3.5">
                <div
                  v-for="comment in comments"
                  :key="comment.Comment_ID"
                  class="group relative flex items-start gap-3"
                >
                  <!-- Commenter Avatar -->
                  <div
                    class="h-8 w-8 rounded-full overflow-hidden bg-[#24242A] border border-[#2E2E34] shrink-0 flex items-center justify-center"
                  >
                    <img
                      v-if="comment.Profile_Picture"
                      :src="comment.Profile_Picture"
                      :alt="comment.Username"
                      class="w-full h-full object-cover"
                    />
                    <Icon v-else name="ic:baseline-person" class="text-sm text-[#B4B8DA]" />
                  </div>

                  <!-- Comment Text & Meta -->
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-2">
                      <div class="flex items-baseline gap-2 min-w-0">
                        <span class="text-xs font-semibold text-white font-Sora hover:underline cursor-pointer truncate">
                          {{ comment.Username }}
                        </span>
                        <span class="text-[10.5px] text-[#C7C5CE] font-HankenGrotesk shrink-0">
                          {{ formatPostRelativeTime(comment.Created_at) }}
                        </span>
                      </div>
                      <button
                        v-if="user && comment.ACCOUNT_ID && comment.ACCOUNT_ID !== user.id"
                        type="button"
                        @click="openReportModal({ targetType: 'Comment', targetId: comment.Comment_ID, targetAccountId: comment.ACCOUNT_ID, targetName: comment.Username, previewSnippet: comment.Content })"
                        class="opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-rose-400 p-1 rounded-sm hover:bg-rose-500/10 cursor-pointer shrink-0"
                        title="Report Comment"
                      >
                        <Icon name="ic:round-flag" class="text-xs" />
                      </button>
                    </div>
                    <p class="text-xs text-gray-300 font-Geist leading-relaxed wrap-break-word">
                      {{ comment.Content }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer: Add Comment Input -->
            <div class="p-3 border-t border-[#2A2A2E] bg-[#161618] shrink-0">
              <form
                @submit.prevent="handleAddComment"
                class="flex items-center gap-2 bg-[#222226] rounded-xl px-3.5 py-2.5 border border-[#2E2E34] focus-within:border-[#D0D4F7]/60 transition-colors"
              >
                <input
                  v-model="newCommentText"
                  type="text"
                  placeholder="Add a comment..."
                  maxlength="500"
                  class="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-hidden font-Geist"
                />
                <button
                  type="submit"
                  :disabled="!newCommentText.trim() || isPostingComment"
                  class="text-xs font-semibold transition-colors shrink-0"
                  :class="
                    newCommentText.trim() && !isPostingComment
                      ? 'text-[#D0D4F7] hover:text-white cursor-pointer'
                      : 'text-gray-600 cursor-not-allowed'
                  "
                >
                  <Icon
                    v-if="isPostingComment"
                    name="ic:round-autorenew"
                    class="text-sm animate-spin"
                  />
                  <span v-else>Post</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
