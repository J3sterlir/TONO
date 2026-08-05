<script setup lang="ts">
import { ref, computed } from 'vue'

// Flow state management
const currentStep = ref<'signin' | 'userSelect' | 'artistSelect' | 'bioAndLinks' | 'artistGenre' | 'artistInstrument' | 'bandGenre' | 'businessSetup' | 'userGenre' | 'userInstrument'>('signin')

// Form data
const signinForm = ref({
  email: '',
  username: '',
  city: '',
  barangay: '',
  password: '',
  confirmPassword: ''
})

const userType = ref<'Artist' | 'User' | null>(null)
const artistType = ref<'Solo' | 'Band' | null>(null)
const bioForm = ref({
  stageName: '',
  bio: '',
  facebook: '',
  instagram: '',
  youtube: ''
})

const businessForm = ref({
  businessName: '',
  businessAddress: '',
  businessService: '',
  isBusinessOwner: true
})

const selectedGenres = ref<string[]>([])
const selectedInstruments = ref<string[]>([])

// Validation checks
const isSigninValid = computed<boolean>(() => {
  return !!(signinForm.value.email &&
           signinForm.value.username &&
           signinForm.value.city &&
           signinForm.value.barangay &&
           signinForm.value.password &&
           signinForm.value.confirmPassword &&
           signinForm.value.password === signinForm.value.confirmPassword)
})

const isUserSelectValid = computed<boolean>(() => userType.value !== null)

const isArtistSelectValid = computed<boolean>(() => artistType.value !== null)

const isBioAndLinksValid = computed<boolean>(() => {
  return !!(bioForm.value.stageName && bioForm.value.bio)
})

const isBusinessSetupValid = computed<boolean>(() => {
  if (!businessForm.value.isBusinessOwner) return true
  return !!(businessForm.value.businessName &&
         businessForm.value.businessAddress &&
         businessForm.value.businessService)
})

const isGenreValid = computed<boolean>(() => selectedGenres.value.length > 0)
const isInstrumentValid = computed<boolean>(() => selectedInstruments.value.length > 0)

// Navigation methods
const goToArtistPath = () => {
  userType.value = 'Artist'
  currentStep.value = 'artistSelect'
}

const goToUserPath = () => {
  userType.value = 'User'
  if (businessForm.value.isBusinessOwner) {
    currentStep.value = 'businessSetup'
  } else {
    currentStep.value = 'userGenre'
  }
}

const proceedFromArtistSelect = () => {
  if (artistType.value === 'Solo') {
    currentStep.value = 'bioAndLinks'
  } else if (artistType.value === 'Band') {
    currentStep.value = 'bandGenre'
  }
}

const proceedFromBioAndLinks = () => {
  currentStep.value = 'artistGenre'
}

const proceedFromArtistGenre = () => {
  currentStep.value = 'artistInstrument'
}

const completeArtistFlow = () => {
  navigateTo('/artist-home')
}

const completeBandFlow = () => {
  navigateTo('/artist-home')
}

const proceedFromBusinessSetup = () => {
  if (businessForm.value.isBusinessOwner) {
    currentStep.value = 'userGenre'
  } else {
    currentStep.value = 'userGenre'
  }
}

const completeUserFlow = () => {
  navigateTo('/user-home')
}

const skipBusinessSetup = () => {
  businessForm.value.isBusinessOwner = false
  currentStep.value = 'userGenre'
}

const goBack = () => {
  switch(currentStep.value) {
    case 'userSelect':
      currentStep.value = 'signin'
      break
    case 'artistSelect':
      currentStep.value = 'userSelect'
      break
    case 'bioAndLinks':
      currentStep.value = 'artistSelect'
      break
    case 'artistGenre':
      currentStep.value = 'bioAndLinks'
      break
    case 'artistInstrument':
      currentStep.value = 'artistGenre'
      break
    case 'bandGenre':
      currentStep.value = 'artistSelect'
      break
    case 'businessSetup':
      currentStep.value = 'userSelect'
      break
    case 'userGenre':
      if (businessForm.value.isBusinessOwner) {
        currentStep.value = 'businessSetup'
      } else {
        currentStep.value = 'userSelect'
      }
      break
    case 'userInstrument':
      currentStep.value = 'userGenre'
      break
  }
}
</script>

<template>
    <title>Sign In</title>
    <div class="flex min-h-screen flex-col lg:flex-row">
        <div
            class="flex w-full justify-center items-center bg-[#131315] px-5 py-6 sm:px-6 sm:py-8 lg:basis-[40%] lg:px-0 lg:py-0">
            <div class="text-white w-full max-w-md flex flex-col gap-2">
                <div class="flex flex-row justify-between items-center">
                    <div class="flex items-center gap-1 mt-1 mb-3">
                        <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
                        <h1>TONO</h1>
                    </div>
                    <button class="text-white cursor-pointer text-start w-fit hover:text-[#B0B4D7]"
                        @click="navigateTo('/')">&larr;
                        Back</button>
                </div>

                <!-- Stage 1: Sign In -->
                <Signinbase 
                  v-if="currentStep === 'signin'"
                  :form="signinForm"
                  :is-valid="isSigninValid"
                  @continue="currentStep = 'userSelect'"
                />

                <!-- Stage 2: User Select -->
                <Userselect 
                  v-if="currentStep === 'userSelect'"
                  :user-type="userType"
                  @update:user-type="userType = $event"
                  @proceed="userType === 'Artist' ? goToArtistPath() : goToUserPath()"
                  @back="goBack"
                />

                <!-- Artist Path -->
                <Artistselect 
                  v-if="currentStep === 'artistSelect'"
                  :artist-type="artistType"
                  @update:artist-type="artistType = $event"
                  @proceed="proceedFromArtistSelect"
                  @back="goBack"
                />

                <Bioandlinks 
                  v-if="currentStep === 'bioAndLinks'"
                  :form="bioForm"
                  :is-valid="isBioAndLinksValid"
                  @proceed="proceedFromBioAndLinks"
                  @back="goBack"
                />

                <Artistgenretags 
                  v-if="currentStep === 'artistGenre'"
                  :selected="selectedGenres"
                  :is-valid="isGenreValid"
                  @update:selected="selectedGenres = $event"
                  @proceed="proceedFromArtistGenre"
                  @back="goBack"
                />

                <Artistinstrumenttags 
                  v-if="currentStep === 'artistInstrument'"
                  :selected="selectedInstruments"
                  :is-valid="isInstrumentValid"
                  @update:selected="selectedInstruments = $event"
                  @complete="completeArtistFlow"
                  @back="goBack"
                />

                <Bandgenretags 
                  v-if="currentStep === 'bandGenre'"
                  :selected="selectedGenres"
                  :is-valid="isGenreValid"
                  @update:selected="selectedGenres = $event"
                  @complete="completeBandFlow"
                  @back="goBack"
                />

                <!-- User Path -->
                <BuisnessSetup 
                  v-if="currentStep === 'businessSetup'"
                  :form="businessForm"
                  :is-valid="isBusinessSetupValid"
                  @update:form="businessForm = $event"
                  @proceed="proceedFromBusinessSetup"
                  @skip="skipBusinessSetup"
                  @back="goBack"
                />

                <Usergenretags 
                  v-if="currentStep === 'userGenre'"
                  :selected="selectedGenres"
                  :is-valid="isGenreValid"
                  @update:selected="selectedGenres = $event"
                  @proceed="currentStep = 'userInstrument'"
                  @back="goBack"
                />

                <Userinstrumenttags 
                  v-if="currentStep === 'userInstrument'"
                  :selected="selectedInstruments"
                  :is-valid="isInstrumentValid"
                  @update:selected="selectedInstruments = $event"
                  @complete="completeUserFlow"
                  @back="goBack"
                />

            </div>
        </div>

        <div
            class="hidden lg:flex lg:basis-[60%] justify-center items-center bg-blend-multiply bg-cover bg-center bg-[linear-gradient(0deg,rgba(18,18,20,0.95)_0%,rgba(93,93,94,0)_51%,rgba(255,255,255,0.1)_100%),url(https://images.unsplash.com/photo-1761474926416-ba16c9b39ea0)]">
            <div class="text-[#E5E1E4]">
                <div class="font-bold text-[4.5rem] backdrop-blur-[0.2rem]">
                    <h1>EXPLORE THE</h1>
                    <h1><mark class="bg-[#D0D4F7] text-[#151A34] rounded-2xl px-2">COMMUNITY</mark></h1>
                    <h1>EXPLORE YOUR</h1>
                    <h1><mark class="bg-[#D0D4F7] text-[#151A34] rounded-2xl px-2">COMMUNITY</mark></h1>
                </div>
            </div>
        </div>
    </div>
</template>