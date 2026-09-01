<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  userType: 'Artist' | 'User' | null
  validationMessage?: string
}>()

const emit = defineEmits<{
    'update:user-type': [value: 'Artist' | 'User']
  proceed: []
  back: []
}>()

const showError = ref(false)

const handleProceed = () => {
  if (props.userType) {
    emit('proceed')
  } else {
    showError.value = true
  }
}
</script>

<template>
    <div class="text-white w-full max-w-md flex flex-col gap-2">
        <div class="mb-8 sm:mb-1">
            <p class="font-bold text-2xl sm:text-3xl lg:text-4xl">Get Started!</p>
            <p class="font-light">Create your TONO account and browse our catalog of artists</p>
        </div>

        <div id="step2" class="text-white flex flex-col">
            <div class="mt-4">
                <p class="text-[17px] font-extralight">
                    Continue as...
                </p>
            </div>
            <div class="flex flex-col gap-4 mt-2">
                <div 
                                    @click="emit('update:user-type', 'Artist')"
                  :class="{ 'border-[#D0D4F7] bg-[#2A2A2D]': userType === 'Artist' }"
                  class="flex border-2 border-[#46464D]/30 bg-[#1B1B1D] rounded-lg px-5 py-5 cursor-pointer hover:border-[#D0D4F7] hover:bg-[#2A2A2D] transition">
                    <input type="radio" name="user" value="Artist" id="artist-radio" class="mr-3 w-5" :checked="userType === 'Artist'">
                    <div class="ms-2 text-sm select-none">
                        <label for="artist-radio" class="font-medium text-heading mb-1 text-[18px]">Artist</label>
                        <p id="helper-radio-text" class="text-[15px] font-light text-body">Performers,
                            producers,
                            and songwriters</p>
                    </div>
                </div>

                <div 
                                    @click="emit('update:user-type', 'User')"
                  :class="{ 'border-[#D0D4F7] bg-[#2A2A2D]': userType === 'User' }"
                  class="flex border-2 border-[#46464D]/30 bg-[#1B1B1D] rounded-lg px-5 py-5 cursor-pointer hover:border-[#D0D4F7] hover:bg-[#2A2A2D] transition">
                    <input type="radio" name="user" value="User" id="user-radio" class="mr-3 w-5" :checked="userType === 'User'">
                    <div class="ms-2 text-sm select-none">
                        <label for="user-radio" class="font-medium text-heading mb-1 text-[18px]">User</label>
                        <p id="helper-radio-text" class="text-[15px] font-light text-body">Music enthusiasts and
                            Business Owners</p>
                    </div>
                </div>
            </div>
            <div v-if="showError && validationMessage" class="mt-3 text-sm text-amber-300">
                {{ validationMessage }}
            </div>
            <div class="flex items-center justify-between gap-2 mt-6">
                    <button @click="emit('back')" class="bg-[#B4B8DA]/40 text-white p-2 w-[50%] rounded-lg hover:bg-[#B4B8DA]/60 transition cursor-pointer">Previous</button>
                    <button 
                      @click="handleProceed"
                      class="bg-[#B4B8DA] text-[#444865] p-2 w-[50%] rounded-lg hover:bg-[#A0A4D0] transition cursor-pointer">Next</button>
                </div>
        </div>
    </div>
</template>