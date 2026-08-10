<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

type Step = 'signin' | 'userSelect' | 'artistSelect' | 'bioAndLinks' | 'artistGenre' | 'artistInstrument' | 'bandGenre' | 'businessSetup' | 'userGenre' | 'userInstrument'

type SignupDraft = {
  account: {
    email: string
    username: string
    city: string
    barangay: string
    password: string
    confirmPassword: string
  }
  role: {
    userType: 'Artist' | 'User' | null
    artistType: 'Solo' | 'Band' | null
  }
  artistProfile: {
    stageName: string
    bio: string
    facebook: string
    instagram: string
    youtube: string
    specialty: string
    bandName: string
    additionalLinks: string[]
  }
  businessProfile: {
    businessName: string
    businessAddress: string
    businessService: string
    isBusinessOwner: boolean
  }
  preferences: {
    genres: string[]
    instruments: string[]
  }
}

const STORAGE_KEY = 'tono-signup-draft'

const createDraft = (): SignupDraft => ({
  account: {
    email: '',
    username: '',
    city: '',
    barangay: '',
    password: '',
    confirmPassword: '',
  },
  role: {
    userType: null,
    artistType: null,
  },
  artistProfile: {
    stageName: '',
    bio: '',
    facebook: '',
    instagram: '',
    youtube: '',
    specialty: '',
    bandName: '',
    additionalLinks: [],
  },
  businessProfile: {
    businessName: '',
    businessAddress: '',
    businessService: '',
    isBusinessOwner: true,
  },
  preferences: {
    genres: [],
    instruments: [],
  },
})

const currentStep = ref<Step>('signin')
const signupDraft = reactive<SignupDraft>(createDraft())

if (import.meta.client) {
  const storedDraft = localStorage.getItem(STORAGE_KEY)
  if (storedDraft) {
    try {
      const parsed = JSON.parse(storedDraft) as Partial<SignupDraft>
      Object.assign(signupDraft.account, parsed.account)
      Object.assign(signupDraft.role, parsed.role)
      Object.assign(signupDraft.artistProfile, parsed.artistProfile)
      Object.assign(signupDraft.businessProfile, parsed.businessProfile)
      Object.assign(signupDraft.preferences, parsed.preferences)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
}

watch(
  signupDraft,
  (draft) => {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  },
  { deep: true },
)

const isSigninValid = computed<boolean>(() => {
  const { email, username, city, barangay, password, confirmPassword } = signupDraft.account
  return !!(email && username && city && barangay && password && confirmPassword && password === confirmPassword)
})

const isUserSelectValid = computed<boolean>(() => signupDraft.role.userType !== null)
const isArtistSelectValid = computed<boolean>(() => signupDraft.role.artistType !== null)
const isBioAndLinksValid = computed<boolean>(() => !!(signupDraft.artistProfile.stageName && signupDraft.artistProfile.bio))
const isBusinessSetupValid = computed<boolean>(() => {
  if (!signupDraft.businessProfile.isBusinessOwner) return true
  return !!(signupDraft.businessProfile.businessName && signupDraft.businessProfile.businessAddress && signupDraft.businessProfile.businessService)
})
const isGenreValid = computed<boolean>(() => signupDraft.preferences.genres.length > 0)
const isInstrumentValid = computed<boolean>(() => signupDraft.preferences.instruments.length > 0)

const setStep = (step: Step) => {
  currentStep.value = step
}

const goToArtistPath = () => {
  signupDraft.role.userType = 'Artist'
  setStep('artistSelect')
}

const goToUserPath = () => {
  signupDraft.role.userType = 'User'
  setStep(signupDraft.businessProfile.isBusinessOwner ? 'businessSetup' : 'userGenre')
}

const proceedFromArtistSelect = () => {
  if (signupDraft.role.artistType === 'Solo') {
    setStep('bioAndLinks')
  } else if (signupDraft.role.artistType === 'Band') {
    setStep('bandGenre')
  }
}

const proceedFromBioAndLinks = () => {
  setStep('artistGenre')
}

const proceedFromArtistGenre = () => {
  setStep('artistInstrument')
}

const submitDraft = (targetRoute: string) => {
  if (!import.meta.client) return
  console.log('Signup draft ready for submit:', JSON.parse(JSON.stringify(signupDraft)))
  localStorage.removeItem(STORAGE_KEY)
  navigateTo(targetRoute)
}

const completeArtistFlow = () => {
  submitDraft('/artist-home')
}

const completeBandFlow = () => {
  submitDraft('/artist-home')
}

const proceedFromBusinessSetup = () => {
  setStep('userGenre')
}

const completeUserFlow = () => {
  submitDraft('/user-home')
}

const skipBusinessSetup = () => {
  signupDraft.businessProfile.isBusinessOwner = false
  setStep('userGenre')
}

const goBack = () => {
  switch (currentStep.value) {
    case 'userSelect':
      setStep('signin')
      break
    case 'artistSelect':
      setStep('userSelect')
      break
    case 'bioAndLinks':
      setStep('artistSelect')
      break
    case 'artistGenre':
      setStep('bioAndLinks')
      break
    case 'artistInstrument':
      setStep('artistGenre')
      break
    case 'bandGenre':
      setStep('artistSelect')
      break
    case 'businessSetup':
      setStep('userSelect')
      break
    case 'userGenre':
      setStep(signupDraft.businessProfile.isBusinessOwner ? 'businessSetup' : 'userSelect')
      break
    case 'userInstrument':
      setStep('userGenre')
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
                  v-model:form="signupDraft.account"
                  :is-valid="isSigninValid"
                  @continue="setStep('userSelect')"
                />

                <!-- Stage 2: User Select -->
                <Userselect 
                  v-if="currentStep === 'userSelect'"
                  :user-type="signupDraft.role.userType"
                  @update:user-type="signupDraft.role.userType = $event"
                  @proceed="signupDraft.role.userType === 'Artist' ? goToArtistPath() : goToUserPath()"
                  @back="goBack"
                />

                <!-- Artist Path -->
                <Artistselect 
                  v-if="currentStep === 'artistSelect'"
                  :artist-type="signupDraft.role.artistType"
                  @update:artist-type="signupDraft.role.artistType = $event"
                  @proceed="proceedFromArtistSelect"
                  @back="goBack"
                />

                <Bioandlinks 
                  v-if="currentStep === 'bioAndLinks'"
                  v-model:form="signupDraft.artistProfile"
                  :is-valid="isBioAndLinksValid"
                  @proceed="proceedFromBioAndLinks"
                  @back="goBack"
                />

                <Artistgenretags 
                  v-if="currentStep === 'artistGenre'"
                  :selected="signupDraft.preferences.genres"
                  :is-valid="isGenreValid"
                  @update:selected="signupDraft.preferences.genres = $event"
                  @proceed="proceedFromArtistGenre"
                  @back="goBack"
                />

                <Artistinstrumenttags 
                  v-if="currentStep === 'artistInstrument'"
                  :form="signupDraft.artistProfile"
                  :selected="signupDraft.preferences.instruments"
                  :is-valid="isInstrumentValid"
                  @update:form="signupDraft.artistProfile = $event"
                  @update:selected="signupDraft.preferences.instruments = $event"
                  @complete="completeArtistFlow"
                  @back="goBack"
                />

                <Bandgenretags 
                  v-if="currentStep === 'bandGenre'"
                  :form="signupDraft.artistProfile"
                  :selected="signupDraft.preferences.genres"
                  :is-valid="isGenreValid"
                  @update:form="signupDraft.artistProfile = $event"
                  @update:selected="signupDraft.preferences.genres = $event"
                  @complete="completeBandFlow"
                  @back="goBack"
                />

                <!-- User Path -->
                <BuisnessSetup 
                  v-if="currentStep === 'businessSetup'"
                  v-model:form="signupDraft.businessProfile"
                  :is-valid="isBusinessSetupValid"
                  @proceed="proceedFromBusinessSetup"
                  @skip="skipBusinessSetup"
                  @back="goBack"
                />

                <Usergenretags 
                  v-if="currentStep === 'userGenre'"
                  :selected="signupDraft.preferences.genres"
                  :is-valid="isGenreValid"
                  @update:selected="signupDraft.preferences.genres = $event"
                  @proceed="setStep('userInstrument')"
                  @back="goBack"
                />

                <Userinstrumenttags 
                  v-if="currentStep === 'userInstrument'"
                  :selected="signupDraft.preferences.instruments"
                  :is-valid="isInstrumentValid"
                  @update:selected="signupDraft.preferences.instruments = $event"
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