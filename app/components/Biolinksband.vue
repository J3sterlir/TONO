<script setup lang="ts">
interface BioFormData {
  stageName: string
  bio: string
  facebook: string
  instagram: string
  youtube: string
    specialty: string
    additionalLinks: string[]
}

const props = defineProps<{
  form: BioFormData
  isValid: boolean
  validationMessage?: string
}>()

const emit = defineEmits<{
    'update:form': [value: BioFormData]
  proceed: []
  back: []
}>()

import { ref } from 'vue'

const showError = ref(false)

const handleProceed = () => {
  if (props.isValid) {
    emit('proceed')
  } else {
    showError.value = true
  }
}

const updateForm = (key: keyof BioFormData, value: string | string[]) => {
    emit('update:form', { ...props.form, [key]: value })
}

const addLink = () => {
    updateForm('additionalLinks', [...props.form.additionalLinks, ''])
}

const updateLink = (index: number, value: string) => {
    const nextLinks = [...props.form.additionalLinks]
    nextLinks[index] = value
    updateForm('additionalLinks', nextLinks)
}
</script>

<template>
    <div class="text-white w-full max-w-md flex flex-col gap-2">
        <h1 class="text-[30px] font-bold">Bio & Social Links</h1>
        <p class="font-light">Tell the world who you are and where to find your music.</p>

        <p class="font-light mt-5">Band Name *</p>
        <div class="relative">
            <Icon name="ic:outline-person" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="text" placeholder="Enter your Band Name"
                :value="props.form.stageName"
                @input="updateForm('stageName', ($event.target as HTMLInputElement).value)"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>

        <p class="font-light mt-5">Bio (optional)</p>
        <div class="relative">
            <Icon name="material-symbols:edit-note-outline"
                class="absolute left-3 top-[1.2rem] text-2xl text-[#7A7A7D]" />
            <textarea
                :value="props.form.bio"
                @input="updateForm('bio', ($event.target as HTMLTextAreaElement).value)"
                class="w-full h-32 pl-12 p-1.5 placeholder:text-sm rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent"
                placeholder="Enter your Bio"></textarea>
        </div>

        <p class="font-light mt-1">Social Links (optional)</p>
        <div class="relative">
            <Icon name="simple-icons:facebook" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="url" placeholder="Facebook Link"
                :value="props.form.facebook"
                @input="updateForm('facebook', ($event.target as HTMLInputElement).value)"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>
        <div class="relative">
            <Icon name="simple-icons:instagram" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="url" placeholder="Instagram Link"
                :value="props.form.instagram"
                @input="updateForm('instagram', ($event.target as HTMLInputElement).value)"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>
        <div class="relative">
            <Icon name="simple-icons:youtube" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="url" placeholder="YouTube Link"
                :value="props.form.youtube"
                @input="updateForm('youtube', ($event.target as HTMLInputElement).value)"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>
        
        <div v-for="(link, index) in props.form.additionalLinks" :key="index" class="relative">
            <Icon name="mdi:link" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="url" :placeholder="`Link ${index + 4}`"
                :value="link"
                @input="updateLink(index, ($event.target as HTMLInputElement).value)"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>

        <div
            @click="addLink"
            class="cursor-pointer text-center outline-dashed rounded-md outline py-2 text-sm text-[#46464D] hover:text-[#B0B4D7] transition">
            + Add Another Link
        </div>

        <div v-if="showError && validationMessage" class="mt-2 text-sm text-amber-300">
            {{ validationMessage }}
        </div>

        <div class="flex items-center justify-between gap-2 mt-6">
            <button @click="emit('back')" class="bg-[#B4B8DA]/40 text-white p-2 w-[50%] rounded-lg hover:bg-[#B4B8DA]/60 transition cursor-pointer">Previous</button>
            <button 
              @click="handleProceed"
              class="bg-[#B4B8DA] text-[#444865] p-2 w-[50%] rounded-lg hover:bg-[#A0A4D0] transition cursor-pointer">Next</button>
        </div>
    </div>
</template>