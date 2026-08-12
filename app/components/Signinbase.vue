<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { cities, barangays } from 'select-philippines-address'

interface SigninFormData {
  email: string
  username: string
  city: string
  barangay: string
  password: string
  confirmPassword: string
}

interface CityOption {
  city_code: string
  city_name: string
}

interface BarangayOption {
  brgy_code: string
  brgy_name: string
}

const props = defineProps<{
  form: SigninFormData
  isValid: boolean
  validationMessage?: string
}>()

const emit = defineEmits<{
  'update:form': [value: SigninFormData]
  continue: []
}>()

const showPassword = ref(false)
const passwordMismatch = ref(false)

// Dropdown state
const isCityOpen = ref(false)
const isBarangayOpen = ref(false)

// PSGC logic
const CAM_SUR_PROV_CODE = '0517'
const citiesList = ref<CityOption[]>([])
const barangaysList = ref<BarangayOption[]>([])


const localCityCode = ref('')

onMounted(async () => {
  citiesList.value = await cities(CAM_SUR_PROV_CODE)
})

// Fetch barangays to local city changes
watch(localCityCode, async (newCode) => {
  if (newCode) {
    barangaysList.value = await barangays(newCode)
  } else {
    barangaysList.value = []
  }
})

// Emit the NAME to the payload, save the CODE locally
const selectCity = (cityObj: CityOption) => {
  localCityCode.value = cityObj.city_code
  
  emit('update:form', { 
    ...props.form, 
    city: cityObj.city_name, // Saves string instead of "051724000" code
    barangay: '' 
  })
  isCityOpen.value = false
  isBarangayOpen.value = false
}

// Emit the NAME to the payload
const selectBarangay = (brgyObj: BarangayOption) => {
  emit('update:form', { 
    ...props.form, 
    barangay: brgyObj.brgy_name 
  })
  isBarangayOpen.value = false
}

const handleContinue = () => {
  if (props.isValid) emit('continue')
}

const updateForm = (key: keyof SigninFormData, value: string) => {
  emit('update:form', { ...props.form, [key]: value })
}

const checkPasswordMatch = () => {
  passwordMismatch.value = props.form.password && props.form.confirmPassword 
    ? props.form.password !== props.form.confirmPassword 
    : false
}
</script>

<template>
  <div id="step1" class="text-white w-full max-w-md flex flex-col gap-2">
    <p class="font-light">EMAIL</p>
    <div class="relative">
      <Icon name="ic:baseline-mail-outline" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
      <input type="email" placeholder="Enter your email" :value="props.form.email"
        @input="updateForm('email', ($event.target as HTMLInputElement).value)"
        class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
    </div>

    <p class="font-light">Username</p>
    <div class="relative">
      <Icon name="ic:outline-person" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
      <input type="text" placeholder="Enter your username" :value="props.form.username"
        @input="updateForm('username', ($event.target as HTMLInputElement).value)"
        class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
    </div>

    <!-- Dropdowns Section -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 mt-2">
      
      <!-- Custom City Dropdown -->
      <div class="flex flex-col gap-2 relative">
        <div>
          <p class="font-light">City</p>
        </div>
        <div class="relative cursor-pointer" @click="isCityOpen = !isCityOpen; isBarangayOpen = false">
          <Icon name="ic:round-home-work" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D] pointer-events-none" />
          <div class="placeholder:text-sm w-full pl-12 p-2 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent flex items-center justify-between">
            <span :class="{'text-gray-400': !props.form.city}">{{ props.form.city || 'Select City' }}</span>
            <Icon name="ic:baseline-keyboard-arrow-down" class="text-[#7A7A7D] text-xl" />
          </div>
        </div>

        <!-- .stop prevents click from triggering isCityOpen again -->
        <ul v-if="isCityOpen" 
            class="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-[#1E1E20] border border-[#3A3A3C] rounded-md z-50 shadow-lg scrollbar-thin scrollbar-thumb-[#3A3A3C]">
          <li v-for="city in citiesList" :key="city.city_code" 
              @click.stop="selectCity(city)"
              class="p-2 pl-4 hover:bg-[#3A3A3C] cursor-pointer text-sm transition-colors"
              :class="{'bg-[#3A3A3C]': props.form.city === city.city_name}">
            {{ city.city_name }}
          </li>
        </ul>
      </div>
      
      <!-- Custom Barangay Dropdown -->
      <div class="flex flex-col gap-2 relative">
        <div>
          <p class="font-light">Barangay</p>
        </div>
        <div class="relative" :class="{'cursor-pointer': props.form.city, 'cursor-not-allowed opacity-50': !props.form.city}" 
             @click="props.form.city ? (isBarangayOpen = !isBarangayOpen, isCityOpen = false) : null">
          <Icon name="ic:round-home" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D] pointer-events-none" />
          <div class="placeholder:text-sm w-full pl-12 p-2 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] flex items-center justify-between">
            <span :class="{'text-gray-400': !props.form.barangay}">{{ props.form.barangay || (props.form.city ? 'Select Barangay' : 'Select a City') }}</span>
            <Icon name="ic:baseline-keyboard-arrow-down" class="text-[#7A7A7D] text-xl" />
          </div>
        </div>

        <ul v-if="isBarangayOpen && props.form.city" 
            class="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-[#1E1E20] border border-[#3A3A3C] rounded-md z-50 shadow-lg scrollbar-thin scrollbar-thumb-[#3A3A3C]">
          <li v-for="brgy in barangaysList" :key="brgy.brgy_code" 
              @click.stop="selectBarangay(brgy)"
              class="p-2 pl-4 hover:bg-[#3A3A3C] cursor-pointer text-sm transition-colors"
              :class="{'bg-[#3A3A3C]': props.form.barangay === brgy.brgy_name}">
            {{ brgy.brgy_name }}
          </li>
        </ul>
      </div>
    </div>
    <!-- End Dropdowns Section -->

    <div class="flex justify-between items-center mt-2">
      <p class="font-light">PASSWORD</p>
    </div>
    <div class="relative">
      <Icon name="ic:outline-lock" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
      <input :type="showPassword ? 'text' : 'password'" placeholder="Enter your password" :value="props.form.password"
        @input="updateForm('password', ($event.target as HTMLInputElement).value); checkPasswordMatch()"
        class="placeholder:text-sm w-full pl-12 pr-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
      <button type="button" class="flex absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7A7D]"
        @click="showPassword = !showPassword">
        <Icon class="text-2xl" :name="showPassword ? 'ic:outline-visibility-off' : 'ic:outline-visibility'" />
      </button>
    </div>

    <div class="flex justify-between items-center mt-2">
      <p class="font-light">CONFIRM PASSWORD</p>
    </div>
    <div class="relative">
      <Icon name="ic:outline-lock" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
      <input :type="showPassword ? 'text' : 'password'" placeholder="Re-enter your password" :value="props.form.confirmPassword"
        @input="updateForm('confirmPassword', ($event.target as HTMLInputElement).value); checkPasswordMatch()"
        class="placeholder:text-sm w-full pl-12 pr-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
      <button type="button" class="flex absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7A7D]"
        @click="showPassword = !showPassword">
        <Icon class="text-2xl" :name="showPassword ? 'ic:outline-visibility-off' : 'ic:outline-visibility'" />
      </button>
    </div>

    <div v-if="passwordMismatch" class="text-red-400 text-sm mt-1">Passwords do not match</div>
    <div v-if="validationMessage" class="mt-1 text-sm text-amber-300">{{ validationMessage }}</div>
    
    <div class="flex items-center justify-center mt-3 sm:mt-4">
      <button :disabled="!isValid"
        :class="{ 'bg-[#A0A4D0] cursor-pointer': isValid, 'opacity-50 cursor-not-allowed': !isValid }"
        @click="handleContinue"
        class="bg-[#D0D4F7] text-[#151A34] w-full p-2.5 px-4 rounded-full hover:bg-[#B0B4D7] disabled:hover:bg-[#D0D4F7]">
        Continue
      </button>
    </div>
    
    <p class="mt-4 text-center text-[13px]">
      Already have an account? 
      <span class="text-[#D0D4F7] cursor-pointer" @click="navigateTo('/Login')">Log In</span>
    </p>
  </div>
</template>