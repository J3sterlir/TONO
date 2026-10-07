<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { resolveSocialLink, normalizeUrl, type ResolvedLink } from '~/utils/linkResolver'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    businessId: string
    initialName?: string
    initialService?: string
    initialAddress?: string
    initialContact?: string
    initialLinks?: any
  }>(),
  {
    initialName: '',
    initialService: '',
    initialAddress: '',
    initialContact: '',
    initialLinks: () => [],
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', data: {
    name: string
    service: string
    address: string
    contact: string
    links: Array<{ url: string; label: string }>
  }): void
}>()

const supabase = useSupabaseClient()
const db = supabase as any

// Form State
const name = ref('')
const service = ref('')
const address = ref('')
const contact = ref('')

interface LinkItem {
  url: string
  label: string
}

const links = ref<LinkItem[]>([])
const newUrlInput = ref('')
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

// Common preset music business services for quick click
const serviceSuggestions = [
  'Recording Studio',
  'Audio Rental & Live Sound',
  'Luthier & Instrument Repair',
  'Music Store & Equipment',
  'Rehearsal Studio',
  'Music School & Lessons',
  'Event Production & Staging',
  'Mastering & Mixing Suite',
]

// Live preview of what the entered URL resolves to
const pendingLinkResolution = computed<ResolvedLink | null>(() => {
  const trimmed = newUrlInput.value.trim()
  if (!trimmed) return null
  return resolveSocialLink(trimmed)
})

const parseInitialLinks = (raw: any): LinkItem[] => {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((item: any) => {
      if (typeof item === 'string') {
        const resolved = resolveSocialLink(item)
        return { url: item, label: resolved.label }
      }
      const url = item?.url || item?.link || ''
      const label = item?.label || item?.name || resolveSocialLink(url).label
      return { url, label }
    }).filter((l: LinkItem) => Boolean(l.url))
  }
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([key, val]) => {
      const url = typeof val === 'string' ? val : (val as any)?.url || ''
      return { url, label: key }
    }).filter((l: LinkItem) => Boolean(l.url))
  }
  return []
}

useModalScrollLock(() => props.isOpen)

// Watchers for modal open/close
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      name.value = props.initialName || ''
      service.value = props.initialService || ''
      address.value = props.initialAddress || ''
      contact.value = props.initialContact || ''
      links.value = parseInitialLinks(props.initialLinks)
      newUrlInput.value = ''
      errorMessage.value = null
    }
  },
  { immediate: true }
)

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen && !isSaving.value) {
    emit('close')
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (import.meta.client) {
      if (open) {
        window.addEventListener('keydown', handleKeyDown)
      } else {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }
)

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeyDown)
  }
})

// Add Link to list
const addLink = () => {
  const url = normalizeUrl(newUrlInput.value)
  if (!url) return

  // Prevent duplicate exact URLs
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

const updateLinkLabel = (index: number, newLabel: string) => {
  if (links.value[index]) {
    links.value[index].label = newLabel
  }
}

// Select a quick service suggestion
const selectService = (preset: string) => {
  service.value = preset
}

// Submit Form
const handleSubmit = async () => {
  if (!props.businessId) {
    errorMessage.value = 'Business ID is missing.'
    return
  }

  if (!name.value.trim()) {
    errorMessage.value = 'Business Name is required.'
    return
  }

  isSaving.value = true
  errorMessage.value = null

  try {
    const payload = {
      Business_Name: name.value.trim(),
      Business_Service: service.value.trim() || null,
      Business_Address: address.value.trim() || null,
      Contact_Information: contact.value.trim() || null,
      Links: links.value,
    }

    const { error } = await db
      .from('BUSINESS_PROFILE')
      .update(payload)
      .eq('BUSINESS_ID', props.businessId)

    if (error) throw error

    emit('saved', {
      name: payload.Business_Name,
      service: payload.Business_Service || '',
      address: payload.Business_Address || '',
      contact: payload.Contact_Information || '',
      links: links.value,
    })

    emit('close')
  } catch (err: any) {
    console.error('Error updating business profile details:', err)
    errorMessage.value = err?.message || 'Failed to update business details.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8"
      >
        <!-- Backdrop Overlay -->
        <div
          class="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
          @click="!isSaving && emit('close')"
        ></div>

        <!-- Modal Dialog -->
        <div
          class="relative w-full max-w-2xl max-h-[90vh] bg-[#161619] border border-[#3A3A3E] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white font-Sora"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-[#2A2A2E] shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-[#D0D4F7]/10 text-[#D0D4F7] flex items-center justify-center text-xl">
                <Icon name="mdi:store-edit-outline" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-white tracking-tight">Edit Business Details</h2>
                <p class="text-xs text-gray-400 font-Geist">Update your public presence, contacts, and social links</p>
              </div>
            </div>
            <button
              type="button"
              @click="!isSaving && emit('close')"
              class="w-9 h-9 rounded-full bg-[#1F1F24] hover:bg-[#282830] text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Icon name="ic:round-close" class="text-xl" />
            </button>
          </div>

          <!-- Form Body (Scrollable) -->
          <div class="p-6 overflow-y-auto space-y-6 font-Geist text-sm">
            <!-- Error Alert -->
            <div
              v-if="errorMessage"
              class="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5"
            >
              <Icon name="ic:round-error-outline" class="text-lg shrink-0 text-red-400" />
              <span>{{ errorMessage }}</span>
            </div>

            <!-- Field 1: Business Name -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold uppercase tracking-wider text-gray-300 font-Sora">
                Business Name <span class="text-red-400">*</span>
              </label>
              <input
                v-model="name"
                type="text"
                placeholder="e.g. Starlight Sound Studios"
                class="w-full px-4 py-3 rounded-xl bg-[#1F1F24] border border-[#3A3A3E] focus:border-[#D0D4F7] focus:outline-none text-white text-sm transition-colors"
              />
            </div>

            <!-- Field 2: Business Service -->
            <div class="space-y-2">
              <label class="block text-xs font-semibold uppercase tracking-wider text-gray-300 font-Sora">
                Primary Business Service
              </label>
              <input
                v-model="service"
                type="text"
                placeholder="e.g. Recording Studio, Audio Rental, Instrument Repair"
                class="w-full px-4 py-3 rounded-xl bg-[#1F1F24] border border-[#3A3A3E] focus:border-[#D0D4F7] focus:outline-none text-white text-sm transition-colors"
              />
              <!-- Quick Suggestions Pill Bar -->
              <div class="flex flex-wrap gap-1.5 pt-1">
                <button
                  v-for="preset in serviceSuggestions"
                  :key="preset"
                  type="button"
                  @click="selectService(preset)"
                  class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  :class="service === preset ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#1F1F24] text-gray-400 hover:text-white hover:bg-[#2A2A32] border border-[#3A3A3E]/60'"
                >
                  {{ preset }}
                </button>
              </div>
            </div>

            <!-- Field 3: Address & Location -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold uppercase tracking-wider text-gray-300 font-Sora">
                Business Address
              </label>
              <div class="relative">
                <Icon name="ic:baseline-location-on" class="absolute left-3.5 top-3.5 text-base text-[#D0D4F7]" />
                <input
                  v-model="address"
                  type="text"
                  placeholder="e.g. Magsaysay Ave, Naga City, Camarines Sur"
                  class="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1F1F24] border border-[#3A3A3E] focus:border-[#D0D4F7] focus:outline-none text-white text-sm transition-colors"
                />
              </div>
            </div>

            <!-- Field 4: Contact Information -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold uppercase tracking-wider text-gray-300 font-Sora">
                Contact Information
              </label>
              <div class="relative">
                <Icon name="ic:outline-phone" class="absolute left-3.5 top-3.5 text-base text-[#D0D4F7]" />
                <input
                  v-model="contact"
                  type="text"
                  placeholder="e.g. +63 912 345 6789 • booking@starlight.ph"
                  class="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1F1F24] border border-[#3A3A3E] focus:border-[#D0D4F7] focus:outline-none text-white text-sm transition-colors"
                />
              </div>
              <p class="text-[11px] text-gray-400">
                This appears prominently in your hero contact badge and on the Contact tab.
              </p>
            </div>

            <!-- Field 5: Social Media & Web Links (With Universal Resolver) -->
            <div class="space-y-3 pt-2 border-t border-[#2A2A2E]">
              <div class="flex items-center justify-between">
                <div>
                  <label class="block text-xs font-semibold uppercase tracking-wider text-gray-300 font-Sora">
                    Social Media & Web Links
                  </label>
                  <p class="text-[11px] text-gray-400">
                    Paste Facebook, YouTube, SoundCloud, Instagram, Spotify, or website URLs. Handles are resolved automatically!
                  </p>
                </div>
                <span class="text-xs font-mono text-gray-500">{{ links.length }} {{ links.length === 1 ? 'link' : 'links' }}</span>
              </div>

              <!-- Add New Link Input -->
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <Icon name="lucide:link" class="absolute left-3.5 top-3.5 text-base text-gray-400" />
                  <input
                    v-model="newUrlInput"
                    type="text"
                    placeholder="Paste link: facebook.com/..., youtube.com/@..., soundcloud.com/..."
                    class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1F1F24] border border-[#3A3A3E] focus:border-[#D0D4F7] focus:outline-none text-white text-xs transition-colors"
                    @keydown.enter.prevent="addLink"
                  />
                </div>
                <button
                  type="button"
                  @click="addLink"
                  :disabled="!newUrlInput.trim()"
                  class="px-4 py-2.5 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] font-semibold text-xs transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5"
                >
                  <Icon name="ic:baseline-plus" class="text-base" />
                  <span>Add Link</span>
                </button>
              </div>

              <!-- Realtime Link Resolver Preview Badge -->
              <div
                v-if="pendingLinkResolution && pendingLinkResolution.url"
                class="p-2.5 rounded-xl bg-[#1A1A1E] border border-[#D0D4F7]/40 flex items-center justify-between gap-3 text-xs"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Icon :name="pendingLinkResolution.icon" class="text-base text-[#D0D4F7] shrink-0" />
                  <span class="text-gray-400 font-medium shrink-0">{{ pendingLinkResolution.platform }}:</span>
                  <span class="text-white font-semibold truncate">{{ pendingLinkResolution.label }}</span>
                </div>
                <span class="text-[10px] text-[#D0D4F7] px-2 py-0.5 rounded-full bg-[#D0D4F7]/10 shrink-0">
                  Auto-Resolved
                </span>
              </div>

              <!-- Existing Links List -->
              <div v-if="links.length > 0" class="space-y-2 pt-1">
                <div
                  v-for="(linkItem, index) in links"
                  :key="index"
                  class="flex items-center gap-3 p-3 rounded-xl bg-[#1F1F24] border border-[#2E2E34] hover:border-[#3A3A3E] transition-all group"
                >
                  <!-- Icon for this resolved link -->
                  <div class="w-8 h-8 rounded-lg bg-[#2A2A30] flex items-center justify-center text-base shrink-0 text-[#D0D4F7]">
                    <Icon :name="resolveSocialLink(linkItem.url).icon" />
                  </div>

                  <!-- Details and custom label input -->
                  <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <input
                      :value="linkItem.label"
                      @input="updateLinkLabel(index, ($event.target as HTMLInputElement).value)"
                      type="text"
                      placeholder="Display label / handle"
                      class="bg-transparent border-none focus:outline-none text-white font-semibold text-xs p-0 m-0 w-full placeholder:text-gray-500"
                    />
                    <a
                      :href="linkItem.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-[11px] text-gray-400 hover:text-[#D0D4F7] truncate max-w-full inline-flex items-center gap-1 transition-colors"
                      :title="linkItem.url"
                    >
                      <span class="truncate">{{ linkItem.url }}</span>
                      <Icon name="lucide:external-link" class="text-[10px] shrink-0" />
                    </a>
                  </div>

                  <!-- Remove Action -->
                  <button
                    type="button"
                    @click="removeLink(index)"
                    class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                    title="Remove link"
                  >
                    <Icon name="ic:round-delete-outline" class="text-lg" />
                  </button>
                </div>
              </div>

              <div v-else class="p-4 rounded-xl border border-dashed border-[#2E2E34] text-center text-xs text-gray-500">
                No social links added yet. Paste a link above to add your official pages.
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2A2A2E] bg-[#131315] shrink-0">
            <button
              type="button"
              @click="!isSaving && emit('close')"
              class="px-5 py-2.5 rounded-xl border border-[#3A3A3E] text-gray-300 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleSubmit"
              :disabled="isSaving || !name.trim()"
              class="px-6 py-2.5 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon v-if="isSaving" name="svg-spinners:ring-resize" class="text-base" />
              <span>{{ isSaving ? 'Saving...' : 'Save Changes' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
