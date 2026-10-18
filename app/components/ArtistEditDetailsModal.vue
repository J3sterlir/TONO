<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { resolveSocialLink, normalizeUrl, type ResolvedLink } from '~/utils/linkResolver'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    artistId: string
    artistType: 'Solo' | 'Band'
    initialName?: string
    initialBio?: string
    initialGenres?: string[]
    initialInstruments?: string[]
    initialLinks?: any
  }>(),
  {
    initialName: '',
    initialBio: '',
    initialGenres: () => [],
    initialInstruments: () => [],
    initialLinks: () => [],
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', data: {
    name: string
    bio: string
    genres: string[]
    instruments: string[]
    links: Array<{ url: string; label: string }>
  }): void
}>()

const supabase = useSupabaseClient()
const db = supabase as any
const user = useSupabaseUser()

// Form State
const name = ref('')
const bio = ref('')
const selectedGenres = ref<string[]>([])
const selectedInstruments = ref<string[]>([])

interface LinkItem {
  url: string
  label: string
}

const links = ref<LinkItem[]>([])
const newUrlInput = ref('')

const pendingLinkResolution = computed<ResolvedLink | null>(() => {
  const trimmed = newUrlInput.value.trim()
  if (!trimmed) return null
  return resolveSocialLink(trimmed)
})

const parseInitialLinks = (raw: any): LinkItem[] => {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => {
        if (typeof item === 'string') {
          const resolved = resolveSocialLink(item)
          return { url: item, label: resolved.label }
        }
        const url = item?.url || item?.link || ''
        const label = item?.label || item?.name || resolveSocialLink(url).label
        return { url, label }
      })
      .filter((l: LinkItem) => Boolean(l.url))
  }
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .map(([key, val]) => {
        const url = typeof val === 'string' ? val : (val as any)?.url || ''
        return { url, label: key }
      })
      .filter((l: LinkItem) => Boolean(l.url))
  }
  return []
}

const addLink = () => {
  const url = normalizeUrl(newUrlInput.value)
  if (!url) return

  if (links.value.some((l) => l.url.toLowerCase() === url.toLowerCase())) {
    errorMessage.value = 'This link has already been added.'
    return
  }

  const resolved = resolveSocialLink(url)
  links.value.push({
    url,
    label: resolved.label,
  })

  newUrlInput.value = ''
  errorMessage.value = null
}

const removeLink = (index: number) => {
  links.value.splice(index, 1)
}

// Reference Options
const allGenres = ref<{ id: string; name: string; isPending?: boolean }[]>([])
const allInstruments = ref<{ id: string; name: string; isPending?: boolean }[]>([])
const isLoadingTags = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

// Tag Search Filters
const genreSearch = ref('')
const instrumentSearch = ref('')

// Custom Tag Inputs & Errors
const customGenreInput = ref('')
const isSubmittingCustomGenre = ref(false)
const customGenreError = ref<string | null>(null)

const customInstrumentInput = ref('')
const isSubmittingCustomInstrument = ref(false)
const customInstrumentError = ref<string | null>(null)

// Request Custom Genre
const requestCustomGenre = async () => {
  const trimmed = customGenreInput.value.trim().toUpperCase()
  if (!trimmed) return
  customGenreError.value = null

  // Local duplicate check
  const duplicate = allGenres.value.some(
    (g) => g.name.trim().toLowerCase() === trimmed.toLowerCase()
  ) || selectedGenres.value.some(
    (gName) => gName.trim().toLowerCase() === trimmed.toLowerCase()
  )

  if (duplicate) {
    customGenreError.value = 'Tag is already present'
    return
  }

  isSubmittingCustomGenre.value = true
  try {
    const res: any = await $fetch('/api/tags/request-custom', {
      method: 'POST',
      body: {
        tagName: trimmed,
        tagType: 'Genre'
      }
    })

    if (res?.tag) {
      if (!allGenres.value.some((g) => g.id === res.tag.id)) {
        allGenres.value.push({
          id: res.tag.id,
          name: res.tag.name,
          isPending: true
        })
        allGenres.value.sort((a, b) => a.name.localeCompare(b.name))
      }
      if (!selectedGenres.value.includes(res.tag.name)) {
        selectedGenres.value.push(res.tag.name)
      }
      customGenreInput.value = ''
      customGenreError.value = null
    }
  } catch (err: any) {
    customGenreError.value = err.data?.statusMessage || err.message || 'Tag is already present'
  } finally {
    isSubmittingCustomGenre.value = false
  }
}

// Request Custom Instrument
const requestCustomInstrument = async () => {
  const trimmed = customInstrumentInput.value.trim().toUpperCase()
  if (!trimmed) return
  customInstrumentError.value = null

  // Local duplicate check
  const duplicate = allInstruments.value.some(
    (i) => i.name.trim().toLowerCase() === trimmed.toLowerCase()
  ) || selectedInstruments.value.some(
    (iName) => iName.trim().toLowerCase() === trimmed.toLowerCase()
  )

  if (duplicate) {
    customInstrumentError.value = 'Tag is already present'
    return
  }

  isSubmittingCustomInstrument.value = true
  try {
    const res: any = await $fetch('/api/tags/request-custom', {
      method: 'POST',
      body: {
        tagName: trimmed,
        tagType: 'Instrument'
      }
    })

    if (res?.tag) {
      if (!allInstruments.value.some((i) => i.id === res.tag.id)) {
        allInstruments.value.push({
          id: res.tag.id,
          name: res.tag.name,
          isPending: true
        })
        allInstruments.value.sort((a, b) => a.name.localeCompare(b.name))
      }
      if (!selectedInstruments.value.includes(res.tag.name)) {
        selectedInstruments.value.push(res.tag.name)
      }
      customInstrumentInput.value = ''
      customInstrumentError.value = null
    }
  } catch (err: any) {
    customInstrumentError.value = err.data?.statusMessage || err.message || 'Tag is already present'
  } finally {
    isSubmittingCustomInstrument.value = false
  }
}

// Load tags from database
const loadTags = async () => {
  isLoadingTags.value = true
  try {
    // 1. Fetch only ACTIVE genres & instruments (globally approved for all accounts)
    const { data: genresData, error: genreError } = await db
      .from('TAG_GENRE')
      .select('Genre_ID, Name, Is_active')
      .eq('Is_active', true)
      .order('Name', { ascending: true })

    if (genreError) throw genreError

    const loadedGenres = (genresData ?? []).map((row: any) => ({
      id: row.Genre_ID,
      name: row.Name,
      isPending: false
    }))

    const loadedInstruments: { id: string; name: string; isPending?: boolean }[] = []
    if (props.artistType === 'Solo') {
      const { data: instData, error: instError } = await db
        .from('TAG_INSTRUMENT')
        .select('Instrument_ID, Name, Is_active')
        .eq('Is_active', true)
        .order('Name', { ascending: true })

      if (instError) throw instError
      for (const row of instData ?? []) {
        loadedInstruments.push({
          id: row.Instrument_ID,
          name: row.Name,
          isPending: false
        })
      }
    }

    // 2. Fetch pending tag requests ONLY for the current account
    const userId = user.value?.id || (await supabase.auth.getUser()).data.user?.id
    if (userId) {
      const { data: userPendingRequests, error: reqError } = await db
        .from('TAG_REQUEST')
        .select('Request_ID, Tag_Name, Type, Genre_ID, Instrument_ID, Status')
        .eq('ACCOUNT_ID', userId)
        .eq('Status', 'Pending')

      if (!reqError && userPendingRequests?.length) {
        for (const req of userPendingRequests) {
          if (req.Type === 'Genre' && req.Genre_ID) {
            if (!loadedGenres.some((g: any) => g.id === req.Genre_ID || g.name.toLowerCase() === (req.Tag_Name || '').toLowerCase())) {
              loadedGenres.push({
                id: req.Genre_ID,
                name: req.Tag_Name,
                isPending: true
              })
            }
          } else if (req.Type === 'Instrument' && req.Instrument_ID && props.artistType === 'Solo') {
            if (!loadedInstruments.some((i: any) => i.id === req.Instrument_ID || i.name.toLowerCase() === (req.Tag_Name || '').toLowerCase())) {
              loadedInstruments.push({
                id: req.Instrument_ID,
                name: req.Tag_Name,
                isPending: true
              })
            }
          }
        }
      }
    }

    // 3. Fallback: If initialGenres has any tag not yet in loadedGenres (e.g. artist's own pending tag), include it
    if (props.initialGenres?.length) {
      const missingGenres = props.initialGenres.filter(
        (name: string) => !loadedGenres.some((g: { id: string; name: string }) => g.name.toLowerCase() === name.toLowerCase())
      )
      if (missingGenres.length > 0) {
        const { data: missingRows } = await db
          .from('TAG_GENRE')
          .select('Genre_ID, Name, Is_active')
          .in('Name', missingGenres)
        for (const row of missingRows || []) {
          if (!loadedGenres.some((g: { id: string; name: string }) => g.id === row.Genre_ID)) {
            loadedGenres.push({
              id: row.Genre_ID,
              name: row.Name,
              isPending: !row.Is_active
            })
          }
        }
      }
    }

    // 4. Fallback: If initialInstruments has any tag not yet in loadedInstruments, include it
    if (props.artistType === 'Solo' && props.initialInstruments?.length) {
      const missingInst = props.initialInstruments.filter(
        (name: string) => !loadedInstruments.some((i: { id: string; name: string }) => i.name.toLowerCase() === name.toLowerCase())
      )
      if (missingInst.length > 0) {
        const { data: missingRows } = await db
          .from('TAG_INSTRUMENT')
          .select('Instrument_ID, Name, Is_active')
          .in('Name', missingInst)
        for (const row of missingRows || []) {
          if (!loadedInstruments.some((i: { id: string; name: string }) => i.id === row.Instrument_ID)) {
            loadedInstruments.push({
              id: row.Instrument_ID,
              name: row.Name,
              isPending: !row.Is_active
            })
          }
        }
      }
    }

    loadedGenres.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
    loadedInstruments.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))

    allGenres.value = loadedGenres
    allInstruments.value = loadedInstruments
  } catch (err: any) {
    console.error('Error fetching tags:', err)
  } finally {
    isLoadingTags.value = false
  }
}

useModalScrollLock(() => props.isOpen)

// Reset / Initialize on modal open
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      name.value = props.initialName || ''
      bio.value = props.initialBio || ''
      selectedGenres.value = [...(props.initialGenres || [])]
      selectedInstruments.value = [...(props.initialInstruments || [])]
      links.value = parseInitialLinks(props.initialLinks)
      newUrlInput.value = ''
      genreSearch.value = ''
      instrumentSearch.value = ''
      errorMessage.value = null
      loadTags()
    }
  },
  { immediate: true }
)

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

    // 1. Update ARTIST record (Bio & Links)
    const { error: artistError } = await db
      .from('ARTIST')
      .update({
        Bio: trimmedBio || null,
        Links: links.value,
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
      links: [...links.value],
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
                class="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5"
                :class="selectedGenres.includes(genre.name)
                  ? 'bg-[#D0D4F7] text-black border-[#D0D4F7] font-semibold shadow-xs'
                  : 'bg-[#1E1E24] text-gray-300 border-[#46464D]/50 hover:border-[#D0D4F7]/60 hover:text-white'">
                <span>{{ genre.name }}</span>
                <span v-if="genre.isPending" class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                  Pending Review
                </span>
              </button>
              <span v-if="filteredGenres.length === 0" class="text-xs text-gray-500 py-1">
                No matching genres found.
              </span>
            </div>

            <!-- Custom Genre Request Bar -->
            <div class="flex items-center gap-2 pt-1">
              <input
                type="text"
                v-model="customGenreInput"
                @keydown.enter.prevent="requestCustomGenre"
                placeholder="Can't find your genre? Request custom tag..."
                class="flex-1 px-3 py-1.5 bg-[#141416] border border-[#46464D]/50 rounded-lg text-xs text-white uppercase placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7]"
              />
              <button
                type="button"
                @click="requestCustomGenre"
                :disabled="!customGenreInput.trim() || isSubmittingCustomGenre"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#282830] text-gray-200 hover:bg-[#D0D4F7] hover:text-[#2A2F4A] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 border border-[#46464D]/40 shrink-0">
                <Icon v-if="isSubmittingCustomGenre" name="ic:baseline-sync" class="animate-spin text-sm" />
                <Icon v-else name="ic:round-add" class="text-sm" />
                <span>Request Custom</span>
              </button>
            </div>
            <p v-if="customGenreError" class="text-[11px] text-rose-400 font-medium">
              {{ customGenreError }}
            </p>
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
                class="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5"
                :class="selectedInstruments.includes(inst.name)
                  ? 'bg-[#D0D4F7] text-black border-[#D0D4F7] font-semibold shadow-xs'
                  : 'bg-[#1E1E24] text-gray-300 border-[#46464D]/50 hover:border-[#D0D4F7]/60 hover:text-white'">
                <span>{{ inst.name }}</span>
                <span v-if="inst.isPending" class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                  Pending Review
                </span>
              </button>
              <span v-if="filteredInstruments.length === 0" class="text-xs text-gray-500 py-1">
                No matching instruments found.
              </span>
            </div>

            <!-- Custom Instrument Request Bar -->
            <div class="flex items-center gap-2 pt-1">
              <input
                type="text"
                v-model="customInstrumentInput"
                @keydown.enter.prevent="requestCustomInstrument"
                placeholder="Can't find your instrument? Request custom tag..."
                class="flex-1 px-3 py-1.5 bg-[#141416] border border-[#46464D]/50 rounded-lg text-xs text-white uppercase placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7]"
              />
              <button
                type="button"
                @click="requestCustomInstrument"
                :disabled="!customInstrumentInput.trim() || isSubmittingCustomInstrument"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#282830] text-gray-200 hover:bg-[#D0D4F7] hover:text-[#2A2F4A] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 border border-[#46464D]/40 shrink-0">
                <Icon v-if="isSubmittingCustomInstrument" name="ic:baseline-sync" class="animate-spin text-sm" />
                <Icon v-else name="ic:round-add" class="text-sm" />
                <span>Request Custom</span>
              </button>
            </div>
            <p v-if="customInstrumentError" class="text-[11px] text-rose-400 font-medium">
              {{ customInstrumentError }}
            </p>
          </div>

          <!-- Social & External Media Links -->
          <div class="space-y-3 pt-2 border-t border-[#46464D]/30">
            <div class="flex items-center justify-between">
              <label class="block text-xs sm:text-sm font-semibold text-gray-200 font-Sora">
                Social Media & External Links
              </label>
              <span class="text-xs text-[#D0D4F7] font-medium">
                {{ links.length }} link{{ links.length === 1 ? '' : 's' }}
              </span>
            </div>

            <p class="text-xs text-gray-400 font-Geist">
              Paste URLs for Facebook, YouTube, Instagram, Spotify, SoundCloud, Bandcamp, TikTok, or personal website.
            </p>

            <!-- Add URL Input Bar -->
            <div class="flex items-center gap-2">
              <div class="flex relative flex-1">
                <Icon name="ic:outline-link" class="absolute left-3 top-2.5 text-gray-400 text-base" />
                <input
                  type="url"
                  v-model="newUrlInput"
                  @keydown.enter.prevent="addLink"
                  placeholder="https://instagram.com/yourhandle or youtube.com/@channel"
                  class="items-center w-full pl-9 pr-3.5 py-2 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7]"
                />
              </div>
              <button
                type="button"
                @click="addLink"
                :disabled="!newUrlInput.trim()"
                class="px-3.5 py-2 rounded-xl bg-[#282830] text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0 border border-[#46464D]/40"

                :class="!newUrlInput.trim()
    ? 'bg-[#1C1C1F] text-gray-500 border-[#2A2A2E] cursor-not-allowed opacity-50'
    : 'bg-[#282830] text-white border-[#46464D]/40 hover:bg-[#D0D4F7] hover:text-black cursor-pointer shadow-sm'"
              >
                <Icon name="ic:round-add" class="text-base" />
                <span>Add</span>
              </button>
            </div>

            <!-- Live URL Preview Pill -->
            <div
              v-if="pendingLinkResolution"
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141416] border border-[#D0D4F7]/40 text-xs text-[#D0D4F7]"
            >
              <Icon :name="pendingLinkResolution.icon" class="text-sm shrink-0" />
              <span class="font-medium">{{ pendingLinkResolution.platform }}:</span>
              <span class="truncate text-gray-300">{{ pendingLinkResolution.handle || pendingLinkResolution.url }}</span>
            </div>

            <!-- Current Links List -->
            <div v-if="links.length > 0" class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              <div
                v-for="(link, idx) in links"
                :key="idx"
                class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#141416] border border-[#46464D]/40 group"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <Icon :name="resolveSocialLink(link.url).icon" class="text-base text-[#D0D4F7] shrink-0" />
                  <div class="min-w-0 flex items-center gap-2">
                    <span class="text-xs font-medium text-white truncate max-w-44">
                      {{ resolveSocialLink(link.url).handle || resolveSocialLink(link.url).label }}
                    </span>
                    <span class="text-[11px] text-gray-500 font-mono truncate hidden sm:inline">
                      {{ link.url }}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  @click="removeLink(idx)"
                  class="flex p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                  title="Remove link"
                >
                  <Icon name="ic:round-close" class="text-sm" />
                </button>
              </div>
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
