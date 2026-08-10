<script setup lang="ts">
const props = defineProps<{
  selected: string[]
  isValid: boolean
}>()

const emit = defineEmits<{
  'update:selected': [value: string[]]
  proceed: []
  back: []
}>()

const toggleTag = (tagId: string) => {
  const newSelected = props.selected.includes(tagId)
    ? props.selected.filter(id => id !== tagId)
    : [...props.selected, tagId]
  emit('update:selected', newSelected)
}
</script>

<template>
    <div class="text-white w-full max-w-md flex flex-col gap-2">
        <div class="mb-8 sm:mb-1">
            <p class="font-bold text-2xl sm:text-3xl lg:text-4xl">Select Genres</p>
            <p class="font-light">What genres do you prefer to listen to? *</p>
        </div>
        <p class="font-extralight text-[15px] mt-5">Select <b>Preferred Genres</b> that may apply:</p>
        <div class="text-white text-center grid grid-cols-3 gap-x-3 gap-y-3">
            <button
              v-for="i in 9"
              :key="i"
              @click="toggleTag(`tag-${i}`)"
              :class="{ 'bg-[#D0D4F7] text-[#151A34] border-[#D0D4F7]': props.selected.includes(`tag-${i}`), 'bg-[#353437]/40 border-[#46464D]/30': !props.selected.includes(`tag-${i}`) }"
              class="py-2 border-2 rounded-lg cursor-pointer hover:border-[#D0D4F7] transition font-medium text-sm">
              Tag {{ i }}
            </button>
        </div>

        <div v-if="props.selected.length > 0" class="mt-4 text-sm text-[#B0B4D7]">
          Selected: {{ props.selected.length }} genre(s)
        </div>

        <div class="flex items-center justify-between gap-2 mt-6">
            <button @click="emit('back')" class="bg-[#B4B8DA]/40 text-white p-2 w-[50%] rounded-lg hover:bg-[#B4B8DA]/60 transition">Previous</button>
            <button 
              :disabled="props.selected.length === 0"
              @click="emit('proceed')"
              :class="{ 'bg-[#A0A4D0] cursor-pointer': props.selected.length > 0, 'opacity-50 cursor-not-allowed': props.selected.length === 0 }"
              class="bg-[#B4B8DA] text-[#444865] p-2 w-[50%] rounded-lg hover:bg-[#A0A4D0] transition disabled:hover:bg-[#B4B8DA]">Next</button>
        </div>
    </div>
</template>