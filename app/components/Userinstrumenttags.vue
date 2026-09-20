<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{
  selected: string[]
  isValid: boolean
  validationMessage?: string
}>()

const emit = defineEmits<{
  'update:selected': [value: string[]]
  complete: []
  back: []
}>()

const showError = ref(false)

const handleProceed = () => {
  if (props.selected.length > 0) {
    emit('complete')
  } else {
    showError.value = true
  }
}

const supabase = useSupabaseClient()
const instrumentOptions = ref<string[]>([])

onMounted(async () => {
  const { data, error } = await supabase
    .from('TAG_INSTRUMENT')
    .select('Name')
    .eq('Is_active', true)
    .order('Name', { ascending: true })

  if (!error) {
    instrumentOptions.value = (data ?? []).map((row: { Name: string }) => row.Name).filter(Boolean)
  }
})

const toggleTag = (tagName: string) => {
  const newSelected = props.selected.includes(tagName)
    ? props.selected.filter((name) => name !== tagName)
    : [...props.selected, tagName]
  emit('update:selected', newSelected)
}
</script>

<template>
    <div class="text-white w-full max-w-md flex flex-col gap-2">
        <div class="mb-8 sm:mb-1">
            <p class="font-bold text-2xl sm:text-3xl lg:text-4xl">Select Instruments</p>
            <p class="font-light">What instruments do you prefer to listen to? *</p>
        </div>
        <p class="font-extralight text-[15px] mt-5">Select <b>Preferred Instruments</b> that may apply:</p>
        <div v-if="instrumentOptions.length" class="text-white text-center grid grid-cols-3 gap-x-3 gap-y-3">
            <button
              v-for="tag in instrumentOptions"
              :key="tag"
              @click="toggleTag(tag)"
              :class="{ 'bg-[#D0D4F7] text-[#151A34] border-[#D0D4F7]': props.selected.includes(tag), 'bg-[#353437]/40 border-[#46464D]/30': !props.selected.includes(tag) }"
              class="py-2 border-2 rounded-lg cursor-pointer hover:border-[#D0D4F7] transition font-medium text-sm">
              {{ tag }}
            </button>
        </div>
        <div v-else class="mt-2 text-sm text-[#B0B4D7]">Loading instruments...</div>

        <div v-if="props.selected.length > 0" class="mt-4 text-sm text-[#B0B4D7]">
          Selected: {{ props.selected.length }} instrument(s)
        </div>
        <div v-if="showError && validationMessage" class="mt-2 text-sm text-amber-300">
          {{ validationMessage }}
        </div>

        <div class="flex items-center justify-between gap-2 mt-6">
            <button @click="emit('back')" class="bg-[#B4B8DA]/40 text-white p-2 w-[50%] rounded-lg hover:bg-[#B4B8DA]/60 transition cursor-pointer">Previous</button>
            <button 
              @click="handleProceed"
              class="bg-[#B4B8DA] text-[#444865] p-2 w-[50%] rounded-lg hover:bg-[#A0A4D0] transition cursor-pointer">Complete</button>
        </div>
    </div>
</template>