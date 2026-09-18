<script setup lang="ts">
import { computed } from 'vue'
import { parseMediaUrl } from '~/utils/embedHelper'

const props = withDefaults(
  defineProps<{
    url: string
    title?: string
    maxHeight?: string
  }>(),
  {
    title: 'Embedded Media Player',
    maxHeight: '',
  }
)

const media = computed(() => parseMediaUrl(props.url))
</script>

<template>
  <div class="w-full h-fit">
    <!-- 1. Video Player (YouTube, Google Drive, Vimeo - 16:9 Fluid Aspect Ratio) -->
    <div
      v-if="media.aspect === 'video' && media.embedUrl"
      class="relative w-full aspect-video rounded-xl overflow-hidden bg-black/60 shadow-lg border border-[#46464D]/40"
      :style="maxHeight ? { maxHeight } : {}">
      <iframe
        :src="media.embedUrl"
        :title="title || media.platformName"
        class="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        loading="lazy" />
    </div>

    <!-- 2. Spotify Compact Track Player (80px height - exact fit, removes dead space) -->
    <div
      v-else-if="media.type === 'spotify' && media.aspect === 'audio-compact' && media.embedUrl"
      class="w-full h-20 rounded-xl overflow-hidden bg-[#121214] shadow-md border border-[#46464D]/40">
      <iframe
        :src="media.embedUrl"
        :title="title || media.platformName"
        width="100%"
        height="80"
        class="w-full h-20 block border-0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy" />
    </div>

    <!-- 3. SoundCloud Audio Player (166px height) -->
    <div
      v-else-if="media.type === 'soundcloud' && media.embedUrl"
      class="w-full h-41.5 rounded-xl overflow-hidden bg-[#121214] shadow-md border border-[#46464D]/40">
      <iframe
        :src="media.embedUrl"
        :title="title || media.platformName"
        width="100%"
        height="166"
        class="w-full h-41.5 block border-0"
        allow="autoplay; encrypted-media"
        loading="lazy" />
    </div>

    <!-- 4. Other Compact Audio Player (Fallback 152px) -->
    <div
      v-else-if="media.aspect === 'audio-compact' && media.embedUrl"
      class="w-full h-38 rounded-xl overflow-hidden bg-[#121214] shadow-md border border-[#46464D]/40">
      <iframe
        :src="media.embedUrl"
        :title="title || media.platformName"
        width="100%"
        height="152"
        class="w-full h-38 block border-0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy" />
    </div>

    <!-- 5. Tall Audio Player (Spotify Album / Playlist) -->
    <div
      v-else-if="media.aspect === 'audio-tall' && media.embedUrl"
      class="w-full h-88 sm:h-95 rounded-xl overflow-hidden bg-[#121214] shadow-md border border-[#46464D]/40">
      <iframe
        :src="media.embedUrl"
        :title="title || media.platformName"
        class="w-full h-full border-0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy" />
    </div>

    <!-- 4. Consistent Fallback Placeholder (When link cannot be embedded or is invalid) -->
    <div
      v-else
      class="relative w-full aspect-video rounded-xl overflow-hidden bg-[#141418] border border-[#46464D]/50 flex flex-col items-center justify-center p-6 text-center shadow-lg gap-2.5">
      <div class="w-12 h-12 rounded-full bg-[#1E1E24] border border-[#46464D]/60 flex items-center justify-center text-[#D0D4F7]">
        <Icon :name="media.platformIcon || 'ic:outline-link'" class="text-2xl" />
      </div>
      <div>
        <h4 class="font-Sora text-xs sm:text-sm font-semibold text-white">
          Preview Unavailable
        </h4>
        <p class="text-[11px] sm:text-xs text-gray-400 max-w-sm mt-1">
          Ensure video/link is set to <span class="text-white font-medium">Public</span> or <span class="text-white font-medium">Unlisted</span> (or 'Anyone with the link' on Google Drive).
        </p>
      </div>

      <a
        v-if="url"
        :href="url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1E1E24] hover:bg-[#2A2A32] border border-[#46464D]/60 text-[11px] text-[#D0D4F7] hover:text-white transition-colors cursor-pointer mt-1">
        <span>Open External Link</span>
        <Icon name="ic:outline-open-in-new" class="text-xs" />
      </a>
    </div>
  </div>
</template>
