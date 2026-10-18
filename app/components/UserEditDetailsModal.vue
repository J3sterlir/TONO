<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    accountId: string
    initialUsername?: string
    initialCity?: string
    initialBarangay?: string
    initialGenres?: string[]
    initialInstruments?: string[]
  }>(),
  {
    initialUsername: '',
    initialCity: '',
    initialBarangay: '',
    initialGenres: () => [],
    initialInstruments: () => [],
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', data: {
    username: string
    city: string
    barangay: string
    genres: string[]
    instruments: string[]
  }): void
}>()

const supabase = useSupabaseClient()
const db = supabase as any
const user = useSupabaseUser()

// Form State
const username = ref('')
const city = ref('')
const barangay = ref('')
const selectedGenres = ref<string[]>([])
const selectedInstruments = ref<string[]>([])

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
    const [genreRes, instRes] = await Promise.all([
      db.from('TAG_GENRE').select('Genre_ID, Name, Is_active').eq('Is_active', true).order('Name', { ascending: true }),
      db.from('TAG_INSTRUMENT').select('Instrument_ID, Name, Is_active').eq('Is_active', true).order('Name', { ascending: true })
    ])

    if (genreRes.error) throw genreRes.error
    if (instRes.error) throw instRes.error

    const loadedGenres = (genreRes.data ?? []).map((row: any) => ({
      id: row.Genre_ID,
      name: row.Name,
      isPending: false
    }))

    const loadedInstruments = (instRes.data ?? []).map((row: any) => ({
      id: row.Instrument_ID,
      name: row.Name,
      isPending: false
    }))

    // 2. Fetch pending tag requests ONLY for the current account
    const userId = props.accountId || user.value?.id || (await supabase.auth.getUser()).data.user?.id
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
          } else if (req.Type === 'Instrument' && req.Instrument_ID) {
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

    // 3. Fallback: If initialGenres has any tag not yet in loadedGenres, include it
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
    if (props.initialInstruments?.length) {
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
      username.value = props.initialUsername || ''
      city.value = props.initialCity || ''
      barangay.value = props.initialBarangay || ''
      selectedGenres.value = [...(props.initialGenres || [])]
      selectedInstruments.value = [...(props.initialInstruments || [])]
      genreSearch.value = ''
      instrumentSearch.value = ''
      customGenreInput.value = ''
      customGenreError.value = null
      customInstrumentInput.value = ''
      customInstrumentError.value = null
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

// Validation
const isUsernameValid = computed(() => username.value.trim().length >= 2)
const canSave = computed(() => isUsernameValid.value && !isSaving.value)

// Save Handler
const handleSave = async () => {
  if (!canSave.value) return
  if (!props.accountId) {
    errorMessage.value = 'Account ID not found. Please refresh the page.'
    return
  }

  isSaving.value = true
  errorMessage.value = null

  try {
    const trimmedUsername = username.value.trim()
    const trimmedCity = city.value.trim()
    const trimmedBarangay = barangay.value.trim()

    // 1. Check username uniqueness if changed
    if (trimmedUsername.toLowerCase() !== props.initialUsername?.toLowerCase()) {
      const { data: existingUser, error: checkErr } = await db
        .from('USER_ACCOUNT')
        .select('ACCOUNT_ID')
        .eq('Username', trimmedUsername)
        .neq('ACCOUNT_ID', props.accountId)
        .maybeSingle()

      if (checkErr) throw checkErr
      if (existingUser) {
        errorMessage.value = 'This username is already taken. Please choose another.'
        isSaving.value = false
        return
      }
    }

    // 2. Update USER_ACCOUNT record
    const { error: userError } = await db
      .from('USER_ACCOUNT')
      .update({
        Username: trimmedUsername,
        City: trimmedCity || null,
        Barangay: trimmedBarangay || null
      })
      .eq('ACCOUNT_ID', props.accountId)

    if (userError) throw userError

    // 3. Sync ACCOUNT_PREF_GENRE
    const selectedGenreIds = allGenres.value
      .filter((g) => selectedGenres.value.includes(g.name))
      .map((g) => g.id)

    // Delete existing pref genres
    const { error: delGenreError } = await db
      .from('ACCOUNT_PREF_GENRE')
      .delete()
      .eq('ACCOUNT_ID', props.accountId)
    if (delGenreError) throw delGenreError

    if (selectedGenreIds.length > 0) {
      const rows = selectedGenreIds.map((id) => ({
        ACCOUNT_ID: props.accountId,
        Genre_ID: id
      }))
      const { error: insGenreError } = await db.from('ACCOUNT_PREF_GENRE').insert(rows)
      if (insGenreError) throw insGenreError
    }

    // 4. Sync ACCOUNT_PREF_INSTRUMENTS
    const selectedInstIds = allInstruments.value
      .filter((i) => selectedInstruments.value.includes(i.name))
      .map((i) => i.id)

    // Delete existing pref instruments
    const { error: delInstError } = await db
      .from('ACCOUNT_PREF_INSTRUMENTS')
      .delete()
      .eq('ACCOUNT_ID', props.accountId)
    if (delInstError) throw delInstError

    if (selectedInstIds.length > 0) {
      const rows = selectedInstIds.map((id) => ({
        ACCOUNT_ID: props.accountId,
        Instrument_ID: id
      }))
      const { error: insInstError } = await db.from('ACCOUNT_PREF_INSTRUMENTS').insert(rows)
      if (insInstError) throw insInstError
    }

    emit('saved', {
      username: trimmedUsername,
      city: trimmedCity,
      barangay: trimmedBarangay,
      genres: selectedGenres.value,
      instruments: selectedInstruments.value
    })
    emit('close')
  } catch (err: any) {
    console.error('Error saving user profile details:', err)
    errorMessage.value = err.message || 'Failed to save changes. Please try again.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      @click.self="$emit('close')">
      <div
        class="bg-[#141416] border border-[#2A2A2E] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-Geist">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-[#2A2A2E] flex items-center justify-between bg-[#1C1C1F]">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-[#D0D4F7]/10 flex items-center justify-center text-[#D0D4F7]">
              <Icon name="ic:outline-edit" class="text-lg" />
            </div>
            <div>
              <h2 class="text-sm sm:text-base font-bold text-white font-Sora">
                Update Profile Details
              </h2>
              <p class="text-[11px] text-gray-400">
                Modify your personal information and music preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="$emit('close')"
            class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
            <Icon name="ic:baseline-close" class="text-xl" />
          </button>
        </div>

        <!-- Body Form -->
        <div class="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          <!-- Error Alert Banner -->
          <div
            v-if="errorMessage"
            class="px-4 py-2.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
            <Icon name="ic:baseline-error-outline" class="text-base shrink-0 text-rose-400" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Basic Info Section -->
          <div class="space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-gray-400 font-Sora">
              Account Information
            </h3>

            <!-- Username Field -->
            <div class="space-y-1.5">
              <label class="block text-xs sm:text-sm font-semibold text-gray-200 font-Sora">
                Username <span class="text-[#D0D4F7]">*</span>
              </label>
              <input
                type="text"
                v-model="username"
                maxlength="50"
                placeholder="Enter your username"
                class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7]" />
              <p v-if="!isUsernameValid && username.length > 0" class="text-[11px] text-amber-400">
                Username must be at least 2 characters.
              </p>
            </div>

            <!-- Location Fields (City & Barangay) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div class="space-y-1.5">
                <label class="block text-xs sm:text-sm font-semibold text-gray-200 font-Sora">
                  City / Municipality
                </label>
                <input
                  type="text"
                  v-model="city"
                  placeholder="e.g. Quezon City"
                  class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7]" />
              </div>
              <div class="space-y-1.5">
                <label class="block text-xs sm:text-sm font-semibold text-gray-200 font-Sora">
                  Barangay
                </label>
                <input
                  type="text"
                  v-model="barangay"
                  placeholder="e.g. Diliman"
                  class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7]" />
              </div>
            </div>
          </div>

          <!-- Genre Preferences Section -->
          <div class="space-y-2.5 pt-3 border-t border-[#46464D]/30">
            <div class="flex items-center justify-between">
              <div>
                <label class="block text-xs sm:text-sm font-semibold text-gray-200 font-Sora">
                  Genre Preferences
                </label>
                <p class="text-[11px] text-gray-400">
                  Select the genres you love to tailor your recommendations
                </p>
              </div>
              <span class="text-xs text-[#D0D4F7] font-medium shrink-0">
                {{ selectedGenres.length }} selected
              </span>
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

          <!-- Instrument Preferences Section -->
          <div class="space-y-2.5 pt-3 border-t border-[#46464D]/30">
            <div class="flex items-center justify-between">
              <div>
                <label class="block text-xs sm:text-sm font-semibold text-gray-200 font-Sora">
                  Instrument Preferences
                </label>
                <p class="text-[11px] text-gray-400">
                  Select instruments you play or enjoy listening to
                </p>
              </div>
              <span class="text-xs text-[#D0D4F7] font-medium shrink-0">
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
        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-4 bg-[#1C1C1F] border-t border-[#2A2A2E] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            @click="$emit('close')"
            :disabled="isSaving"
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            @click="handleSave"
            :disabled="!canSave"
            class="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-md cursor-pointer"
            :class="!canSave
              ? 'bg-[#2A2A32] text-gray-500 cursor-not-allowed opacity-60'
              : 'bg-[#D0D4F7] hover:bg-[#B0B4D7] text-[#141416] hover:shadow-lg'">
            <Icon v-if="isSaving" name="ic:baseline-sync" class="animate-spin text-base" />
            <span>{{ isSaving ? 'Saving...' : 'Save Changes' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
