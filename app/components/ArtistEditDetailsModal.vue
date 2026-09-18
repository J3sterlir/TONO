<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    artistId: string
    artistType: 'Solo' | 'Band'
    initialName?: string
    initialBio?: string
    initialGenres?: string[]
    initialInstruments?: string[]
  }>(),
  {
    initialName: '',
    initialBio: '',
    initialGenres: () => [],
    initialInstruments: () => [],
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', data: {
    name: string
    bio: string
    genres: string[]
    instruments: string[]
  }): void
}>()

const supabase = useSupabaseClient()
const db = supabase as any

// Form State
const name = ref('')
const bio = ref('')
const selectedGenres = ref<string[]>([])
const selectedInstruments = ref<string[]>([])

// Reference Options
const allGenres = ref<{ id: string; name: string }[]>([])
const allInstruments = ref<{ id: string; name: string }[]>([])
const isLoadingTags = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

// Tag Search Filters
const genreSearch = ref('')
const instrumentSearch = ref('')

// Load tags from database
const loadTags = async () => {
  if (allGenres.value.length > 0) return
  isLoadingTags.value = true
  try {
    const { data: genresData, error: genreError } = await db
      .from('TAG_GENRE')
      .select('Genre_ID, Name')
      .eq('Is_active', true)
      .order('Name', { ascending: true })

    if (genreError) throw genreError
    allGenres.value = (genresData ?? []).map((row: any) => ({
      id: row.Genre_ID,
      name: row.Name,
    }))

    if (props.artistType === 'Solo') {
      const { data: instData, error: instError } = await db
        .from('TAG_INSTRUMENT')
        .select('Instrument_ID, Name')
        .eq('Is_active', true)
        .order('Name', { ascending: true })

      if (instError) throw instError
      allInstruments.value = (instData ?? []).map((row: any) => ({
        id: row.Instrument_ID,
        name: row.Name,
      }))
    }
  } catch (err: any) {
    console.error('Error fetching tags:', err)
  } finally {
    isLoadingTags.value = false
  }
}

// Reset / Initialize on modal open
watch(
  () => props.isOpen,
  (open) => {
    if (import.meta.client) {
      document.body.style.overflow = open ? 'hidden' : ''
    }

    if (open) {
      name.value = props.initialName || ''
      bio.value = props.initialBio || ''
      selectedGenres.value = [...(props.initialGenres || [])]
      selectedInstruments.value = [...(props.initialInstruments || [])]
      genreSearch.value = ''
      instrumentSearch.value = ''
      errorMessage.value = null
      loadTags()
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})

// Filtered Tag Lists
const filteredGenres = computed(() => {
  const query = genreSearch.value.trim().toLowerCase()
  if (!query) return allGenres.value
  return allGenres.value.filter((g) => g.name.toLowerCase().includes(query))
})

const filteredInstruments = computed(() => {
  const query = instrumentSearch.value.trim().toLowerCase()
  if (!query) return allInstruments.value
  return allInstruments.value.filter((i) => i.name.toLowerCase().includes(query))
})

// Toggle Tags
const toggleGenre = (genreName: string) => {
  if (selectedGenres.value.includes(genreName)) {
    selectedGenres.value = selectedGenres.value.filter((g) => g !== genreName)
  } else {
    selectedGenres.value.push(genreName)
  }
}

const toggleInstrument = (instName: string) => {
  if (selectedInstruments.value.includes(instName)) {
    selectedInstruments.value = selectedInstruments.value.filter((i) => i !== instName)
  } else {
    selectedInstruments.value.push(instName)
  }
}

// Validation: MUST have at least 1 genre tag
const hasMinGenres = computed(() => selectedGenres.value.length >= 1)
const isNameValid = computed(() => name.value.trim().length >= 2)
const canSave = computed(() => isNameValid.value && hasMinGenres.value && !isSaving.value)

// Save Handler
const handleSave = async () => {
  if (!canSave.value) return
  if (!props.artistId) {
    errorMessage.value = 'Artist ID not found. Please refresh the page.'
    return
  }

  isSaving.value = true
  errorMessage.value = null

  try {
    const trimmedName = name.value.trim()
    const trimmedBio = bio.value.trim()

    // 1. Update ARTIST record (Bio only; stage name belongs to SOLO_ARTIST.Artist_Name or BAND.Band_Name)
    const { error: artistError } = await db
      .from('ARTIST')
      .update({
        Bio: trimmedBio || null,
      })
      .eq('ARTIST_ID', props.artistId)

    if (artistError) throw artistError

    // 2. Update SOLO_ARTIST or BAND record
    if (props.artistType === 'Solo') {
      const { error: soloError } = await db
        .from('SOLO_ARTIST')
        .update({ Artist_Name: trimmedName })
        .eq('ARTIST_ID', props.artistId)
      if (soloError) throw soloError
    } else {
      const { error: bandError } = await db
        .from('BAND')
        .update({ Band_Name: trimmedName })
        .eq('ARTIST_ID', props.artistId)
      if (bandError) throw bandError
    }

    // 3. Sync Genre Tags
    const selectedGenreIds = allGenres.value
      .filter((g) => selectedGenres.value.includes(g.name))
      .map((g) => g.id)

    if (props.artistType === 'Solo') {
      // Delete existing solo genres
      const { error: delGenreError } = await db
        .from('SOLO_GENRES')
        .delete()
        .eq('ARTIST_ID', props.artistId)
      if (delGenreError) throw delGenreError

      // Insert new solo genres
      if (selectedGenreIds.length > 0) {
        const rows = selectedGenreIds.map((id) => ({
          ARTIST_ID: props.artistId,
          Genre_ID: id,
        }))
        const { error: insGenreError } = await db.from('SOLO_GENRES').insert(rows)
        if (insGenreError) throw insGenreError
      }
    } else {
      // Delete existing band genres
      const { error: delBandGenreError } = await db
        .from('BAND_GENRES')
        .delete()
        .eq('ARTIST_ID', props.artistId)
      if (delBandGenreError) throw delBandGenreError

      // Insert new band genres
      if (selectedGenreIds.length > 0) {
        const rows = selectedGenreIds.map((id) => ({
          ARTIST_ID: props.artistId,
          Genre_ID: id,
        }))
        const { error: insBandGenreError } = await db.from('BAND_GENRES').insert(rows)
        if (insBandGenreError) throw insBandGenreError
      }
    }

    // 4. Sync Instrument Tags (for Solo)
    if (props.artistType === 'Solo') {
      const selectedInstIds = allInstruments.value
        .filter((i) => selectedInstruments.value.includes(i.name))
        .map((i) => i.id)

      // Delete existing solo instruments
      const { error: delInstError } = await db
        .from('SOLO_INSTRUMENTS')
        .delete()
        .eq('ARTIST_ID', props.artistId)
      if (delInstError) throw delInstError

      // Insert new solo instruments
      if (selectedInstIds.length > 0) {
        const rows = selectedInstIds.map((id) => ({
          ARTIST_ID: props.artistId,
          Instrument_ID: id,
        }))
        const { error: insInstError } = await db.from('SOLO_INSTRUMENTS').insert(rows)
        if (insInstError) throw insInstError
      }
    }

    emit('saved', {
      name: trimmedName,
      bio: trimmedBio,
      genres: [...selectedGenres.value],
      instruments: [...selectedInstruments.value],
    })

    emit('close')
  } catch (err: any) {
    console.error('Failed to update artist profile:', err)
    errorMessage.value = err.message || 'Failed to update profile details. Please try again.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center overscroll-contain justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md transition-opacity">
      <!-- Modal Container -->
      <div
        class="relative w-full max-w-2xl bg-[#131315] border border-[#46464D]/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white animate-in fade-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-[#46464D]/40 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-[#1E1E24] flex items-center justify-center border border-[#46464D]/50 shrink-0">
              <Icon name="ic:outline-edit" class="text-xl text-[#D0D4F7]" />
            </div>
            <div>
              <h2 class="font-Sora font-semibold text-base sm:text-lg text-white">
                Update Profile Details
              </h2>
              <span class="text-xs text-gray-400 font-Geist">
                {{ artistType === 'Band' ? 'Band Name, Story & Genres' : 'Stage Name, Bio & Musical Tags' }}
              </span>
            </div>
          </div>

          <button
            @click="$emit('close')"
            :disabled="isSaving"
            class="flex p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Close">
            <Icon name="ic:round-close" class="text-xl" />
          </button>
        </div>

        <!-- Scrollable Form Body -->
        <div class="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 scrollbar-thin">
          <!-- Error Alert Banner -->
          <div
            v-if="errorMessage"
            class="px-4 py-2.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs sm:text-sm flex items-center gap-2">
            <Icon name="ic:outline-error-outline" class="text-lg shrink-0 text-red-400" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Artist / Band Name Input -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              {{ artistType === 'Band' ? 'Band Name' : 'Artist / Stage Name' }}
              <span class="text-[#D0D4F7]">*</span>
            </label>
            <input
              type="text"
              v-model="name"
              maxlength="60"
              placeholder="e.g. Neon Horizon"
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
            <p v-if="name.trim().length < 2" class="text-[11px] text-amber-300/90 mt-1">
              Name must be at least 2 characters.
            </p>
          </div>

          <!-- Bio / Story Textarea -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs sm:text-sm font-semibold text-gray-200 font-Sora">
                Bio & Story
              </label>
              <span class="text-[11px] text-gray-400 font-mono">
                {{ bio.length }} / 500
              </span>
            </div>
            <textarea
              v-model="bio"
              maxlength="500"
              rows="4"
              placeholder="Tell listeners and organizers about your musical background, style, and passion..."
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all resize-none leading-relaxed"></textarea>
          </div>

          <!-- Genre Tags Section -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs sm:text-sm font-semibold text-gray-200 font-Sora">
                Genre Tags <span class="text-[#D0D4F7]">*</span>
              </label>
              <span class="text-xs text-[#D0D4F7] font-medium">
                {{ selectedGenres.length }} selected
              </span>
            </div>

            <!-- Minimum Tag Validation Warning -->
            <div
              v-if="selectedGenres.length === 0"
              class="px-3.5 py-2 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center gap-2">
              <Icon name="ic:outline-warning-amber" class="text-base shrink-0 text-amber-400" />
              <span>An artist must have at least one genre tag selected.</span>
            </div>

            <!-- Search Filter for Genres -->
            <div class="relative">
              <Icon name="ic:outline-search" class="absolute left-3 top-2.5 text-gray-400 text-base" />
              <input
                type="text"
                v-model="genreSearch"
                placeholder="Search genres..."
                class="w-full pl-9 pr-3.5 py-1.5 bg-[#1E1E24] border border-[#46464D]/40 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7]" />
            </div>

            <!-- Genre Tag Chips -->
            <div v-if="isLoadingTags" class="text-xs text-gray-400 py-3 flex items-center gap-2">
              <Icon name="ic:baseline-sync" class="animate-spin text-sm text-[#D0D4F7]" />
              <span>Loading available genres...</span>
            </div>
            <div
              v-else
              class="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-[#0E0E10] border border-[#46464D]/40 rounded-xl scrollbar-thin">
              <button
                v-for="genre in filteredGenres"
                :key="genre.id"
                type="button"
                @click="toggleGenre(genre.name)"
                class="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border"
                :class="selectedGenres.includes(genre.name)
                  ? 'bg-[#D0D4F7] text-black border-[#D0D4F7] font-semibold shadow-xs'
                  : 'bg-[#1E1E24] text-gray-300 border-[#46464D]/50 hover:border-[#D0D4F7]/60 hover:text-white'">
                {{ genre.name }}
              </button>
              <span v-if="filteredGenres.length === 0" class="text-xs text-gray-500 py-1">
                No matching genres found.
              </span>
            </div>
          </div>

          <!-- Instrument Tags Section (Solo Artists Only) -->
          <div v-if="artistType === 'Solo'" class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs sm:text-sm font-semibold text-gray-200 font-Sora">
                Instrument Tags
              </label>
              <span class="text-xs text-[#D0D4F7] font-medium">
                {{ selectedInstruments.length }} selected
              </span>
            </div>

            <!-- Search Filter for Instruments -->
            <div class="relative">
              <Icon name="ic:outline-search" class="absolute left-3 top-2.5 text-gray-400 text-base" />
              <input
                type="text"
                v-model="instrumentSearch"
                placeholder="Search instruments..."
                class="w-full pl-9 pr-3.5 py-1.5 bg-[#1E1E24] border border-[#46464D]/40 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7]" />
            </div>

            <!-- Instrument Tag Chips -->
            <div
              class="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-[#0E0E10] border border-[#46464D]/40 rounded-xl scrollbar-thin">
              <button
                v-for="inst in filteredInstruments"
                :key="inst.id"
                type="button"
                @click="toggleInstrument(inst.name)"
                class="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border"
                :class="selectedInstruments.includes(inst.name)
                  ? 'bg-[#D0D4F7] text-black border-[#D0D4F7] font-semibold shadow-xs'
                  : 'bg-[#1E1E24] text-gray-300 border-[#46464D]/50 hover:border-[#D0D4F7]/60 hover:text-white'">
                {{ inst.name }}
              </button>
              <span v-if="filteredInstruments.length === 0" class="text-xs text-gray-500 py-1">
                No matching instruments found.
              </span>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="px-5 sm:px-7 py-3.5 bg-[#18181D] border-t border-[#46464D]/40 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            @click="$emit('close')"
            :disabled="isSaving"
            class="px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 border border-[#46464D]/70 text-xs sm:text-sm font-medium text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50">
            Cancel
          </button>

          <button
            type="button"
            @click="handleSave"
            :disabled="!canSave"
            class="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D0D4F7] hover:bg-[#B8BCF0] text-black text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-lg hover:shadow-[#D0D4F7]/20 disabled:opacity-40 disabled:cursor-not-allowed">
            <Icon
              v-if="isSaving"
              name="ic:baseline-sync"
              class="text-base animate-spin text-black" />
            <Icon
              v-else
              name="ic:round-check"
              class="text-base text-black" />
            <span>{{ isSaving ? 'Saving Changes...' : 'Save Changes' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
