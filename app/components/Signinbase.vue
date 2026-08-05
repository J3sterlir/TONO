<script setup lang="ts">
import { ref } from 'vue'

interface SigninFormData {
  email: string
  username: string
  city: string
  barangay: string
  password: string
  confirmPassword: string
}

const props = defineProps<{
  form: SigninFormData
  isValid: boolean
}>()

const emit = defineEmits<{
  continue: []
}>()

const showPassword = ref(false)
const passwordMismatch = ref(false)

const handleContinue = () => {
  if (props.isValid) {
    emit('continue')
  }
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
                        <Icon name="ic:baseline-mail-outline"
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
                        <input type="email" placeholder="Enter your email"
                            v-model="form.email"
                            class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
                    </div>
                    <p class="font-light">Username</p>
                    <div class="relative">
                        <Icon name="ic:outline-person"
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
                        <input type="text" placeholder="Enter your username"
                            v-model="form.username"
                            class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
                    </div>
                    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                        <div class="flex flex-col gap-2">
                            <div>
                                <p class="font-light">City</p>
                            </div>
                            <div class="relative">
                                <Icon name="ic:round-home-work"
                                    class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
                                <input type="text" placeholder="Enter your city"
                                    v-model="form.city"
                                    class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
                            </div>
                        </div>
                        <div class="flex flex-col gap-2">
                            <div>
                                <p class="font-light">Barangay</p>
                            </div>
                            <div class="relative">
                                <Icon name="ic:round-home"
                                    class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
                                <input type="text" placeholder="Enter your barangay"
                                    v-model="form.barangay"
                                    class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <p class="font-light">PASSWORD</p>
                    </div>
                    <div class="relative">
                        <Icon name="ic:outline-lock"
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />

                        <input :type="showPassword ? 'text' : 'password'" placeholder="Enter your password"
                            v-model="form.password"
                            @input="checkPasswordMatch"
                            class="placeholder:text-sm w-full pl-12 pr-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />

                        <button type="button" class="flex absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7A7D]"
                            @click="showPassword = !showPassword">
                            <Icon class="text-2xl"
                                :name="showPassword ? 'ic:outline-visibility-off' : 'ic:outline-visibility'" />
                        </button>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <p class="font-light">CONFIRM PASSWORD</p>
                    </div>
                    <div class="relative">
                        <Icon name="ic:outline-lock"
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />

                        <input :type="showPassword ? 'text' : 'password'" placeholder="Re-enter your password"
                            v-model="form.confirmPassword"
                            @input="checkPasswordMatch"
                            class="placeholder:text-sm w-full pl-12 pr-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />

                        <button type="button" class="flex absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7A7D]"
                            @click="showPassword = !showPassword">
                            <Icon class="text-2xl"
                                :name="showPassword ? 'ic:outline-visibility-off' : 'ic:outline-visibility'" />
                        </button>
                    </div>
                    <div v-if="passwordMismatch" class="text-red-400 text-sm">Passwords do not match</div>
                    <div class="flex items-center justify-center">
                        <button
                            :disabled="!isValid"
                            :class="{ 'bg-[#A0A4D0] cursor-pointer': isValid, 'opacity-50 cursor-not-allowed': !isValid }"
                            @click="handleContinue"
                            class="bg-[#D0D4F7] text-[#151A34] w-full p-2.5 px-4 rounded-full mt-3 sm:mt-4 hover:bg-[#B0B4D7] disabled:hover:bg-[#D0D4F7]">Continue</button>
                    </div>
                    <p class="mt-4 text-center text-[13px]">Already have an account? <span
                            class="text-[#D0D4F7] cursor-pointer" @click="navigateTo('/Login')">Log In</span></p>
                </div>
</template>