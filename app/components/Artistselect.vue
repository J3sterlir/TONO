<script setup lang="ts">
defineProps<{
  artistType: 'Solo' | 'Band' | null
  validationMessage?: string
}>()

const emit = defineEmits<{
  'update:artist-type': [value: 'Solo' | 'Band']
  proceed: []
  back: []
}>()
</script>

<template>
    <div class="text-white w-full max-w-md flex flex-col gap-2">
        <div class="mb-8 sm:mb-1">
            <p class="font-bold text-2xl sm:text-3xl lg:text-4xl">Get Started!</p>
            <p class="font-light">Create your TONO account and browse our catalog of artists</p>
        </div>
        <div id="step2" class="text-white flex flex-col">
            <h1 class="text-center font-light text-[22px] mt-5">Artist Setup</h1>

            <p class="font-extralight text-[15px] mt-5">ARTIST CATEGORY</p>
            <div class="flex flex-col gap-4 mt-2">
                <div 
                  @click="emit('update:artist-type', 'Solo')"
                  :class="{ 'border-[#D0D4F7] bg-[#2A2A2D]': artistType === 'Solo' }"
                  class="flex border-2 border-[#46464D]/30 bg-[#1B1B1D] rounded-lg px-5 py-5 cursor-pointer hover:border-[#D0D4F7] hover:bg-[#2A2A2D] transition">
                    <input type="radio" name="artist" value="Solo" id="solo" class="mr-3 w-5" :checked="artistType === 'Solo'">
                    <div class="ms-2 text-sm select-none">
                        <label for="solo" class="font-medium text-heading mb-1 text-[18px]">Solo</label>
                    </div>
                </div>

                <div 
                  @click="emit('update:artist-type', 'Band')"
                  :class="{ 'border-[#D0D4F7] bg-[#2A2A2D]': artistType === 'Band' }"
                  class="flex border-2 border-[#46464D]/30 bg-[#1B1B1D] rounded-lg px-5 py-5 cursor-pointer hover:border-[#D0D4F7] hover:bg-[#2A2A2D] transition">
                    <input type="radio" name="artist" value="Band" id="band" class="mr-3 w-5" :checked="artistType === 'Band'">
                    <div class="ms-2 text-sm select-none">
                        <label for="band" class="font-medium text-heading mb-1 text-[18px]">Band</label>
                    </div>
                </div>

                <div v-if="validationMessage" class="mt-3 text-sm text-amber-300">
                    {{ validationMessage }}
                </div>
                <div class="flex items-center justify-between gap-2 mt-6">
                    <button @click="emit('back')" class="bg-[#B4B8DA]/40 text-white p-2 w-[50%] rounded-lg hover:bg-[#B4B8DA]/60 transition">Previous</button>
                    <button 
                      :disabled="!artistType"
                      @click="emit('proceed')"
                      :class="{ 'bg-[#A0A4D0] cursor-pointer': artistType, 'opacity-50 cursor-not-allowed': !artistType }"
                      class="bg-[#B4B8DA] text-[#444865] p-2 w-[50%] rounded-lg hover:bg-[#A0A4D0] transition disabled:hover:bg-[#B4B8DA]">Next</button>
                </div>
            </div>
        </div>
    </div>
</template>