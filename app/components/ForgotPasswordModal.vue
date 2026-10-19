<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
  }>(),
  {
    isOpen: false
  }
)

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'close': []
  'success': [identifier: string]
}>()

useModalScrollLock(() => props.isOpen)

// Steps: 1 = Verify Account, 2 = Change Password, 3 = Success
const currentStep = ref<1 | 2 | 3>(1)

const identifier = ref('')
const verifiedUser = ref<{ username: string; maskedEmail: string } | null>(null)

const newPassword = ref('')
const confirmPassword = ref('')
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const isVerifying = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const resetForm = () => {
  currentStep.value = 1
  identifier.value = ''
  verifiedUser.value = null
  newPassword.value = ''
  confirmPassword.value = ''
  showNewPassword.value = false
  showConfirmPassword.value = false
  errorMessage.value = ''
  successMessage.value = ''
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      resetForm()
    }
  }
)

const handleClose = () => {
  emit('update:isOpen', false)
  emit('close')
}

// Step 1: Verify Account
const handleVerifyAccount = async () => {
  errorMessage.value = ''
  const trimmed = identifier.value.trim()

  if (!trimmed) {
    errorMessage.value = 'Please enter your email or username.'
    return
  }

  isVerifying.value = true

  try {
    const data = await $fetch<{ exists: boolean; username: string; maskedEmail: string }>('/api/auth/verify-account', {
      method: 'POST',
      body: { identifier: trimmed }
    })

    if (data?.exists) {
      verifiedUser.value = {
        username: data.username,
        maskedEmail: data.maskedEmail
      }
      errorMessage.value = ''
      currentStep.value = 2
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.statusMessage || err?.message || 'No account found with this email or username.'
  } finally {
    isVerifying.value = false
  }
}

// Step 2: Change Password
const handleChangePassword = async () => {
  errorMessage.value = ''

  if (!newPassword.value) {
    errorMessage.value = 'Please enter a new password.'
    return
  }

  if (newPassword.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters long.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  isSubmitting.value = true

  try {
    const data = await $fetch<{ success: boolean; message: string }>('/api/auth/reset-password-direct', {
      method: 'POST',
      body: {
        identifier: identifier.value.trim(),
        newPassword: newPassword.value
      }
    })

    if (data?.success) {
      successMessage.value = data.message || 'Password successfully updated!'
      currentStep.value = 3
      emit('success', identifier.value.trim())
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Failed to update password. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      @click="handleClose"
    />

    <!-- Modal Card (Strict Theme) -->
    <div
      class="relative w-full max-w-md bg-[#1B1B1D] border border-[#46464D]/40 rounded-2xl p-6 sm:p-8 shadow-2xl text-white z-10 animate-in fade-in zoom-in-95 duration-200"
    >
      <!-- Close Button -->
      <button
        type="button"
        @click="handleClose"
        class="absolute right-5 top-5 text-[#A0A0A5] hover:text-white transition-colors cursor-pointer p-1 rounded-full hover:bg-[#26262A]"
        aria-label="Close"
      >
        <Icon name="material-symbols:close" class="text-2xl" />
      </button>

      <!-- ================= STEP 1: Verify Account ================= -->
      <div v-if="currentStep === 1" class="flex flex-col gap-4">
        <!-- Header -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#D0D4F7]/15 border border-[#D0D4F7]/30 flex items-center justify-center text-[#D0D4F7]">
            <Icon name="ic:outline-lock-reset" class="text-2xl" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">Reset Password</h2>
            <p class="text-xs text-[#A0A0A5]">Step 1 of 2: Locate your account</p>
          </div>
        </div>

        <p class="text-sm text-[#A0A0A5] leading-relaxed mt-1">
          Enter your registered email address or username to verify your account and set a new password.
        </p>

        <!-- Form -->
        <form @submit.prevent="handleVerifyAccount" class="flex flex-col gap-4 mt-2">
          <div>
            <label class="block text-xs font-light text-[#A0A0A5] uppercase tracking-wider mb-1.5">
              Email or Username
            </label>
            <div class="relative">
              <Icon
                name="ic:outline-person"
                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-[#7A7A7D]"
              />
              <input
                v-model="identifier"
                type="text"
                placeholder="e.g. artist1 or user@example.com"
                autocomplete="username"
                class="w-full pl-11 pr-4 py-3 rounded-xl bg-[#131315] text-white border border-[#46464D]/40 focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] transition text-sm placeholder:text-[#52525B]"
              />
            </div>
          </div>

          <!-- Error Alert -->
          <div
            v-if="errorMessage"
            class="rounded-xl border border-red-500/50 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2"
          >
            <Icon name="material-symbols:error-outline" class="text-base shrink-0 mt-0.5 text-red-400" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Actions -->
          <button
            type="submit"
            :disabled="isVerifying || !identifier.trim()"
            class="w-full bg-[#D0D4F7] text-[#0E0E10] font-semibold py-3 px-6 rounded-full hover:bg-[#B0B4D7] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            <Icon v-if="isVerifying" name="line-md:loading-loop" class="text-xl" />
            <span>{{ isVerifying ? 'Verifying Account...' : 'Continue' }}</span>
          </button>
        </form>
      </div>

      <!-- ================= STEP 2: Change Password ================= -->
      <div v-else-if="currentStep === 2" class="flex flex-col gap-4">
        <!-- Header -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#D0D4F7]/15 border border-[#D0D4F7]/30 flex items-center justify-center text-[#D0D4F7]">
            <Icon name="ic:outline-vpn-key" class="text-2xl" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">Set New Password</h2>
            <p class="text-xs text-[#A0A0A5]">Step 2 of 2: Create a secure password</p>
          </div>
        </div>

        <!-- Verified Account Badge -->
        <div class="bg-[#131315] border border-[#46464D]/40 rounded-xl p-3 flex items-center justify-between">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-7 h-7 rounded-full bg-[#D0D4F7] text-[#0E0E10] flex items-center justify-center text-xs font-bold shrink-0">
              {{ (verifiedUser?.username || 'U').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-white truncate">@{{ verifiedUser?.username }}</p>
              <p class="text-xs text-[#A0A0A5] truncate">{{ verifiedUser?.maskedEmail }}</p>
            </div>
          </div>
          <button
            type="button"
            @click="currentStep = 1"
            class="text-xs text-[#D0D4F7] hover:underline cursor-pointer shrink-0 ml-2"
          >
            Change
          </button>
        </div>

        <!-- Password Form -->
        <form @submit.prevent="handleChangePassword" class="flex flex-col gap-3.5 mt-1">
          <!-- New Password -->
          <div>
            <label class="block text-xs font-light text-[#A0A0A5] uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div class="relative">
              <Icon
                name="ic:outline-lock"
                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-[#7A7A7D]"
              />
              <input
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                placeholder="At least 6 characters"
                autocomplete="new-password"
                class="w-full pl-11 pr-11 py-3 rounded-xl bg-[#131315] text-white border border-[#46464D]/40 focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] transition text-sm placeholder:text-[#52525B]"
              />
              <button
                type="button"
                @click="showNewPassword = !showNewPassword"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A7A7D] hover:text-white transition cursor-pointer"
              >
                <Icon :name="showNewPassword ? 'ic:outline-visibility-off' : 'ic:outline-visibility'" class="text-xl" />
              </button>
            </div>
          </div>

          <!-- Confirm Password -->
          <div>
            <label class="block text-xs font-light text-[#A0A0A5] uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div class="relative">
              <Icon
                name="ic:outline-lock"
                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-[#7A7A7D]"
              />
              <input
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Re-enter your password"
                autocomplete="new-password"
                class="w-full pl-11 pr-11 py-3 rounded-xl bg-[#131315] text-white border border-[#46464D]/40 focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] transition text-sm placeholder:text-[#52525B]"
              />
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A7A7D] hover:text-white transition cursor-pointer"
              >
                <Icon :name="showConfirmPassword ? 'ic:outline-visibility-off' : 'ic:outline-visibility'" class="text-xl" />
              </button>
            </div>
          </div>

          <!-- Password Match Feedback -->
          <div v-if="confirmPassword && newPassword !== confirmPassword" class="text-xs text-amber-400 flex items-center gap-1.5">
            <Icon name="material-symbols:warning-outline" class="text-sm shrink-0" />
            <span>Passwords do not match yet</span>
          </div>

          <!-- Error Alert -->
          <div
            v-if="errorMessage"
            class="rounded-xl border border-red-500/50 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2"
          >
            <Icon name="material-symbols:error-outline" class="text-base shrink-0 mt-0.5 text-red-400" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 mt-2">
            <button
              type="button"
              @click="currentStep = 1"
              class="w-1/3 border border-[#46464D]/40 text-white font-semibold py-3 px-4 rounded-full hover:bg-[#26262A] transition cursor-pointer text-center text-sm"
            >
              Back
            </button>
            <button
              type="submit"
              :disabled="isSubmitting || !newPassword || newPassword !== confirmPassword || newPassword.length < 6"
              class="w-2/3 bg-[#D0D4F7] text-[#0E0E10] font-semibold py-3 px-6 rounded-full hover:bg-[#B0B4D7] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              <Icon v-if="isSubmitting" name="line-md:loading-loop" class="text-xl" />
              <span>{{ isSubmitting ? 'Updating...' : 'Change Password' }}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- ================= STEP 3: Success State ================= -->
      <div v-else-if="currentStep === 3" class="flex flex-col items-center text-center gap-4 py-3">
        <div class="w-16 h-16 rounded-full bg-[#D0D4F7]/20 border border-[#D0D4F7]/40 flex items-center justify-center text-[#D0D4F7]">
          <Icon name="material-symbols:check-circle" class="text-4xl" />
        </div>

        <div>
          <h2 class="text-2xl font-bold text-white">Password Updated!</h2>
          <p class="text-sm text-[#A0A0A5] mt-1.5 leading-relaxed">
            Your password for <strong class="text-white">@{{ verifiedUser?.username }}</strong> has been successfully changed.
          </p>
        </div>

        <button
          type="button"
          @click="handleClose"
          class="w-full bg-[#D0D4F7] text-[#0E0E10] font-semibold py-3 px-6 rounded-full hover:bg-[#B0B4D7] transition cursor-pointer mt-2"
        >
          Back to Login
        </button>
      </div>
    </div>
  </div>
</template>
