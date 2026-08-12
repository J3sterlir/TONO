<script setup lang="ts">
interface BusinessFormData {
  businessName: string
  businessAddress: string
  businessService: string
  cellphone: number
  isBusinessOwner: boolean
}

const props = defineProps<{
  form: BusinessFormData
  isValid: boolean
}>()

const emit = defineEmits<{
  'update:form': [value: BusinessFormData]
  proceed: []
  skip: []
  back: []
}>()

const updateForm = (key: keyof BusinessFormData, value: any) => {
  emit('update:form', { ...props.form, [key]: value })
}
</script>

<template>
    <div class="text-white w-full max-w-md flex flex-col gap-2">
        <h1 class="text-[22px] font-bold">Business Setup</h1>
        <p class="font-light">Complete your profile to start showcasing your services.</p>

        <p class="font-light mt-5">BUSINESS NAME *</p>
        <div class="relative">
            <Icon name="material-symbols:store-outline" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="text" placeholder="Enter your business name"
                :value="form.businessName"
                @input="updateForm('businessName', ($event.target as HTMLInputElement).value)"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>

        <p class="font-light mt-5">BUSINESS ADDRESS *</p>
        <div class="relative">
            <Icon name="material-symbols:location-on-outline" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="text" placeholder="Enter your business address"
                :value="form.businessAddress"
                @input="updateForm('businessAddress', ($event.target as HTMLInputElement).value)"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>

        <p class="font-light mt-5">CELLPHONE NUMBER *</p>
        <div class="relative">
            <Icon name="ic:baseline-local-phone" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="text" placeholder="Enter your cellphone number"
                :value="form.cellphone"
                @input="updateForm('cellphone', ($event.target as HTMLInputElement).value)"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>

        <p class="font-light mt-5">BUSINESS SERVICE *</p>
        <div class="relative">
            <Icon name="solar:user-speak-linear" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
            <input type="text" placeholder="Enter your service"
                :value="form.businessService"
                @input="updateForm('businessService', ($event.target as HTMLInputElement).value)"
                class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>

        <div class="flex items-center justify-between gap-2 mt-6">
            <button @click="emit('back')" class="bg-[#B4B8DA]/40 text-white p-2 w-[50%] rounded-lg hover:bg-[#B4B8DA]/60 transition cursor-pointer">Previous</button>
            <button 
              :disabled="!isValid"
              @click="emit('proceed')"
              :class="{ 'bg-[#A0A4D0] cursor-pointer': isValid, 'opacity-50 cursor-not-allowed': !isValid }"
              class="bg-[#B4B8DA] text-[#444865] p-2 w-[50%] rounded-lg hover:bg-[#A0A4D0] transition  disabled:hover:bg-[#B4B8DA]">Next</button>
        </div>

        <button @click="emit('skip')" class="mt-4 text-center text-[#B0B4D7] hover:text-[#D0D4F7] hover:underline transition text-sm cursor-pointer">
            I am not a <b>Business Owner</b>
        </button>
    </div>
</template>