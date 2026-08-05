<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  selected: string[]
  isValid: boolean
}>()

const emit = defineEmits<{
  'update:selected': [value: string[]]
  complete: []
  back: []
}>()

const bandName = ref('')
const selectedTags = ref<string[]>([])

const toggleTag = (tagId: string) => {
  const newSelected = selectedTags.value.includes(tagId)
    ? selectedTags.value.filter(id => id !== tagId)
    : [...selectedTags.value, tagId]
  selectedTags.value = newSelected
  emit('update:selected', newSelected)
}
</script>

<template>
    <div class="text-white w-full max-w-md flex flex-col gap-2">
        <h1 class="text-center font-bold text-[22px] mt-5">Band Setup</h1>
        <p class="font-light mt-5">Band Name *</p>
        <div class="relative">
            <Icon name="material-symbols:groups-2-outline" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="text" placeholder="Enter your Band Name"
                v-model="bandName"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>

        <p class="font-extralight text-[15px] mt-5">Select the genres that best define your sound. *</p>

        <p class="text-[#C7C5CE]/70 font-light text-[15px] mt-1">SELECT GENRE TAGS</p>
        <div class="text-white text-center grid grid-cols-3 gap-x-3 gap-y-3">
            <button
              v-for="i in 9"
              :key="i"
              @click="toggleTag(`tag-${i}`)"
              :class="{ 'bg-[#D0D4F7] text-[#151A34] border-[#D0D4F7]': selectedTags.includes(`tag-${i}`), 'bg-[#353437]/40 border-[#46464D]/30': !selectedTags.includes(`tag-${i}`) }"
              class="py-2 border-2 rounded-lg cursor-pointer hover:border-[#D0D4F7] transition font-medium text-sm">
              Tag {{ i }}
            </button>
        </div>

        <div v-if="selectedTags.length > 0" class="mt-4 text-sm text-[#B0B4D7]">
          Selected: {{ selectedTags.length }} genre(s)
        </div>

        <div class="flex items-center justify-between gap-2 mt-6">
            <button @click="emit('back')" class="bg-[#B4B8DA]/40 text-white p-2 w-[50%] rounded-lg hover:bg-[#B4B8DA]/60 transition">Previous</button>
            <button 
              :disabled="bandName.trim() === '' || selectedTags.length === 0"
              @click="emit('complete')"
              :class="{ 'bg-[#A0A4D0] cursor-pointer': bandName.trim() !== '' && selectedTags.length > 0, 'opacity-50 cursor-not-allowed': bandName.trim() === '' || selectedTags.length === 0 }"
              class="bg-[#B4B8DA] text-[#444865] p-2 w-[50%] rounded-lg hover:bg-[#A0A4D0] transition disabled:hover:bg-[#B4B8DA]">Complete</button>
        </div>
    </div>
</template>