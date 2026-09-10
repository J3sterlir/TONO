<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    currentPage?: number
    pageSize?: number
    totalItems?: number
    pageSizeOptions?: number[]
    itemLabel?: string
  }>(),
  {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    pageSizeOptions: () => [5, 10, 20, 50],
    itemLabel: 'items'
  }
)

const emit = defineEmits<{
  'update:currentPage': [page: number]
  'update:pageSize': [size: number]
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)))

const startIndex = computed(() => (props.totalItems === 0 ? 0 : (props.currentPage - 1) * props.pageSize + 1))
const endIndex = computed(() => Math.min(props.totalItems, props.currentPage * props.pageSize))

const displayedPages = computed(() => {
  const total = totalPages.value
  const current = props.currentPage

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | string)[] = []

  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i)
    pages.push('...')
    pages.push(total)
  } else if (current >= total - 3) {
    pages.push(1)
    pages.push('...')
    for (let i = total - 4; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    pages.push('...')
    pages.push(current - 1)
    pages.push(current)
    pages.push(current + 1)
    pages.push('...')
    pages.push(total)
  }

  return pages
})

const changePage = (page: number | string) => {
  if (typeof page === 'number' && page >= 1 && page <= totalPages.value && page !== props.currentPage) {
    emit('update:currentPage', page)
  }
}

const prevPage = () => {
  if (props.currentPage > 1) {
    emit('update:currentPage', props.currentPage - 1)
  }
}

const nextPage = () => {
  if (props.currentPage < totalPages.value) {
    emit('update:currentPage', props.currentPage + 1)
  }
}

const onPageSizeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const newSize = parseInt(target.value, 10)
  if (!isNaN(newSize) && newSize !== props.pageSize) {
    emit('update:pageSize', newSize)
    emit('update:currentPage', 1)
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800 bg-[#18181b]">
    <!-- Left: Limiter & Showing Range -->
    <div class="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
      <div class="flex items-center gap-2">
        <span class="text-zinc-400 font-medium">Rows per page:</span>
        <select
          :value="pageSize"
          @change="onPageSizeChange"
          class="bg-[#141416] border border-[#2A2A2E] text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#D0D4F7] transition-colors cursor-pointer font-medium">
          <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">
            {{ opt }}
          </option>
        </select>
      </div>

      <span class="text-zinc-600 hidden sm:inline">•</span>

      <span>
        Showing <strong class="text-zinc-200 font-semibold">{{ startIndex }}</strong> to
        <strong class="text-zinc-200 font-semibold">{{ endIndex }}</strong> of
        <strong class="text-zinc-200 font-semibold">{{ totalItems }}</strong>
        {{ itemLabel }}
      </span>
    </div>

    <!-- Right: Page Controls -->
    <div class="flex items-center gap-1.5">
      <!-- Previous Button -->
      <button
        @click="prevPage"
        :disabled="currentPage <= 1"
        class="flex items-center justify-center w-8 h-8 rounded-md border transition-colors cursor-pointer disabled:cursor-not-allowed"
        :class="currentPage <= 1 ? 'border-zinc-800/80 text-zinc-600 bg-zinc-900/30' : 'border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-800/70 bg-[#1C1C1F]'"
        title="Previous Page">
        <Icon name="ic:baseline-chevron-left" class="text-lg" />
      </button>

      <!-- Numbered Page Pills -->
      <template v-for="(p, index) in displayedPages" :key="index">
        <span v-if="p === '...'" class="px-2 text-xs text-zinc-500 select-none">
          ...
        </span>
        <button
          v-else
          @click="changePage(p)"
          class="flex items-center justify-center min-w-8 h-8 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer"
          :class="p === currentPage
            ? 'bg-[#D0D4F7] text-[#1E1E22] shadow-sm font-bold'
            : 'bg-[#1C1C1F] border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/80'">
          {{ p }}
        </button>
      </template>

      <!-- Next Button -->
      <button
        @click="nextPage"
        :disabled="currentPage >= totalPages"
        class="flex items-center justify-center w-8 h-8 rounded-md border transition-colors cursor-pointer disabled:cursor-not-allowed"
        :class="currentPage >= totalPages ? 'border-zinc-800/80 text-zinc-600 bg-zinc-900/30' : 'border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-800/70 bg-[#1C1C1F]'"
        title="Next Page">
        <Icon name="ic:baseline-chevron-right" class="text-lg" />
      </button>
    </div>
  </div>
</template>
