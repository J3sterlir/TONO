<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from 'vue'

const { signUpWithTonoAccount } = useTonoAuth()

type Step = 'signin' | 'userSelect' | 'artistSelect' | 'bioAndLinks' | 'artistGenre' | 'artistInstrument' | 'bandGenre' | 'Biolinksband' | 'businessSetup' | 'userGenre' | 'userInstrument'

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
    additionalLinks: string[]
  }
  businessProfile: {
    businessName: string
    businessAddress: string
    businessService: string
    cellphone: number
    isBusinessOwner: boolean
  }
  preferences: {
    genres: string[]
    instruments: string[]
  }
}

const STORAGE_KEY = 'tono-signup-draft'
const submitLoading = ref(false)
const submitError = ref('')

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
    additionalLinks: [],
  },
  businessProfile: {
    businessName: '',
    businessAddress: '',
    businessService: '',
    cellphone: 63,
    isBusinessOwner: true,
  },
  preferences: {
    genres: [],
    instruments: [],
  },
})

const currentStep = ref<Step>('signin')
const signupDraft = reactive<SignupDraft>(createDraft())

onMounted(() => {
  const storedDraft = localStorage.getItem(STORAGE_KEY)
  if (storedDraft) {
    try {
      const parsed = JSON.parse(storedDraft) as Partial<SignupDraft>
      if (parsed.account) Object.assign(signupDraft.account, parsed.account)
      if (parsed.role) Object.assign(signupDraft.role, parsed.role)
      if (parsed.artistProfile) Object.assign(signupDraft.artistProfile, parsed.artistProfile)
      if (parsed.businessProfile) Object.assign(signupDraft.businessProfile, parsed.businessProfile)
      if (parsed.preferences) Object.assign(signupDraft.preferences, parsed.preferences)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
})

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

const signinWarning = computed<string>(() => {
  const { email, username, city, barangay, password, confirmPassword } = signupDraft.account

  if (!email) return 'Please enter your email.'
  if (!username) return 'Please choose a username.'
  if (!city) return 'Please select your city.'
  if (!barangay) return 'Please select your barangay.'
  if (!password) return 'Please create a password.'
  if (!confirmPassword) return 'Please confirm your password.'
  if (password !== confirmPassword) return 'Passwords do not match.'

  return ''
})

const isUserSelectValid = computed<boolean>(() => signupDraft.role.userType !== null)
const userTypeWarning = computed<string>(() => (signupDraft.role.userType ? '' : 'Please choose whether you are joining as an Artist or a User.'))

const isArtistSelectValid = computed<boolean>(() => signupDraft.role.artistType !== null)
const artistTypeWarning = computed<string>(() => (signupDraft.role.artistType ? '' : 'Please choose your artist type: Solo or Band.'))

const isBioAndLinksValid = computed<boolean>(() => !!(signupDraft.artistProfile.stageName && signupDraft.artistProfile.bio))
const bioWarning = computed<string>(() => {
  if (!signupDraft.artistProfile.stageName) return 'Please enter your stage name.'
  if (!signupDraft.artistProfile.bio) return 'Please add a short bio about yourself.'
  return ''
})

const isBusinessSetupValid = computed<boolean>(() => {
  if (!signupDraft.businessProfile.isBusinessOwner) return true
  return !!(signupDraft.businessProfile.businessName && signupDraft.businessProfile.businessAddress && signupDraft.businessProfile.businessService)
})
const businessSetupWarning = computed<string>(() => {
  if (!signupDraft.businessProfile.isBusinessOwner) return ''
  if (!signupDraft.businessProfile.businessName) return 'Please enter your business name.'
  if (!signupDraft.businessProfile.businessAddress) return 'Please enter your business address.'
  if (!signupDraft.businessProfile.businessService) return 'Please describe the service you provide.'
  return ''
})

const isGenreValid = computed<boolean>(() => signupDraft.preferences.genres.length > 0)
const genreWarning = computed<string>(() => (signupDraft.preferences.genres.length > 0 ? '' : 'Please select at least one genre to continue.'))

const isInstrumentValid = computed<boolean>(() => signupDraft.preferences.instruments.length > 0)
const instrumentWarning = computed<string>(() => (signupDraft.preferences.instruments.length > 0 ? '' : 'Please select at least one instrument to continue.'))

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
    setStep('Biolinksband')
  }
}

const proceedFromBioAndLinksBand = () => {
  setStep('bandGenre')
}

const proceedFromBioAndLinks = () => {
  setStep('artistGenre')
}

const proceedFromArtistGenre = () => {
  setStep('artistInstrument')
}

const handleSignup = async () => {
  if (!import.meta.client) return

  if (!isSigninValid.value) {
    submitError.value = 'Please complete all required sign-in details and make sure your passwords match.'
    return
  }

  if (signupDraft.role.userType === 'Artist' && !signupDraft.role.artistType) {
    submitError.value = 'Please select an artist type.'
    return
  }

  if (signupDraft.role.userType === 'User' && signupDraft.businessProfile.isBusinessOwner && !isBusinessSetupValid.value) {
    submitError.value = 'Please complete the business setup details or choose not to be a business owner.'
    return
  }

  if (signupDraft.role.userType === 'Artist' && !isBioAndLinksValid.value) {
    submitError.value = 'Stage name and bio are required for your artist profile.'
    return
  }

  if (signupDraft.preferences.genres.length === 0 || signupDraft.preferences.instruments.length === 0) {
    submitError.value = 'Please select at least one genre and one instrument.'
    return
  }

  submitLoading.value = true
  submitError.value = ''

  try {
    await signUpWithTonoAccount({
      email: signupDraft.account.email,
      password: signupDraft.account.password,
      username: signupDraft.account.username,
      city: signupDraft.account.city,
      barangay: signupDraft.account.barangay,
      userType: signupDraft.role.userType || 'User',
      artistType: signupDraft.role.artistType,
      artistProfile: {
        stageName: signupDraft.artistProfile.stageName,
        bio: signupDraft.artistProfile.bio,
        facebook: signupDraft.artistProfile.facebook,
        instagram: signupDraft.artistProfile.instagram,
        youtube: signupDraft.artistProfile.youtube,
        specialty: signupDraft.artistProfile.specialty,
        additionalLinks: signupDraft.artistProfile.additionalLinks,
      },
      businessProfile: {
        businessName: signupDraft.businessProfile.businessName,
        businessAddress: signupDraft.businessProfile.businessAddress,
        businessService: signupDraft.businessProfile.businessService,
        cellphone: signupDraft.businessProfile.cellphone,
        isBusinessOwner: signupDraft.businessProfile.isBusinessOwner,
      },
      genres: signupDraft.preferences.genres,
      instruments: signupDraft.preferences.instruments,
    })

    localStorage.removeItem(STORAGE_KEY)
    await navigateTo('/Login')
  } catch (error: any) {
    submitError.value = error?.message || 'Unable to create your account right now. Please try again.'
  } finally {
    submitLoading.value = false
  }
}

const submitDraft = async (targetRoute: string) => {
  if (!import.meta.client) return
  const payloadSnapshot = JSON.parse(JSON.stringify(signupDraft))
  console.log('Signup draft ready for submit:', payloadSnapshot)
  localStorage.removeItem(STORAGE_KEY)
  await navigateTo(targetRoute)
}

const completeArtistFlow = async () => {
  await handleSignup()
}

const completeBandFlow = async () => {
  await handleSignup()
}

const proceedFromBusinessSetup = () => {
  setStep('userGenre')
}

const completeUserFlow = async () => {
  await handleSignup()
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
    case 'Biolinksband':
      setStep('bandGenre')
      break
    case 'bandGenre':
      setStep('Biolinksband')
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
                  <!-- <button class="text-white cursor-pointer text-start w-fit hover:text-[#B0B4D7]"
                        @click="navigateTo('/')">&larr;
                        Back</button>-->
                </div>

                <!--Sign In -->
                <Signinbase 
                  v-if="currentStep === 'signin'"
                  v-model:form="signupDraft.account"
                  :is-valid="isSigninValid"
                  :validation-message="signinWarning"
                  @continue="setStep('userSelect')"
                />

                <div v-if="submitError" class="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {{ submitError }}
                </div>

                <!-- User Select -->
                <Userselect 
                  v-if="currentStep === 'userSelect'"
                  :user-type="signupDraft.role.userType"
                  :validation-message="userTypeWarning"
                  @update:user-type="signupDraft.role.userType = $event"
                  @proceed="signupDraft.role.userType === 'Artist' ? goToArtistPath() : goToUserPath()"
                  @back="goBack"
                />

                <!-- Artist -->
                <Artistselect 
                  v-if="currentStep === 'artistSelect'"
                  :artist-type="signupDraft.role.artistType"
                  :validation-message="artistTypeWarning"
                  @update:artist-type="signupDraft.role.artistType = $event"
                  @proceed="proceedFromArtistSelect"
                  @back="goBack"
                />

                <Bioandlinks 
                  v-if="currentStep === 'bioAndLinks'"
                  v-model:form="signupDraft.artistProfile"
                  :is-valid="isBioAndLinksValid"
                  :validation-message="bioWarning"
                  @proceed="proceedFromBioAndLinksBand"
                  @back="goBack"
                />

                <Artistgenretags 
                  v-if="currentStep === 'artistGenre'"
                  :selected="signupDraft.preferences.genres"
                  :is-valid="isGenreValid"
                  :validation-message="genreWarning"
                  @update:selected="signupDraft.preferences.genres = $event"
                  @proceed="proceedFromArtistGenre"
                  @back="goBack"
                />

                <Artistinstrumenttags 
                  v-if="currentStep === 'artistInstrument'"
                  :form="signupDraft.artistProfile"
                  :selected="signupDraft.preferences.instruments"
                  :is-valid="isInstrumentValid"
                  :validation-message="instrumentWarning"
                  @update:form="signupDraft.artistProfile = $event"
                  @update:selected="signupDraft.preferences.instruments = $event"
                  @complete="completeArtistFlow"
                  @back="goBack"
                />

                <Biolinksband
                  v-if="currentStep === 'Biolinksband'"
                  v-model:form="signupDraft.artistProfile"
                  :is-valid="isBioAndLinksValid"
                  :validation-message="bioWarning"
                  @proceed="proceedFromBioAndLinks"
                  @back="goBack"
                />

                <Bandgenretags 
                  v-if="currentStep === 'bandGenre'"
                  :form="signupDraft.artistProfile"
                  :selected="signupDraft.preferences.genres"
                  :is-valid="isGenreValid"
                  :validation-message="genreWarning"
                  @update:form="signupDraft.artistProfile = $event"
                  @update:selected="signupDraft.preferences.genres = $event"
                  @complete="completeBandFlow"
                  @back="goBack"
                />

                <!-- User -->
                <BuisnessSetup 
                  v-if="currentStep === 'businessSetup'"
                  v-model:form="signupDraft.businessProfile"
                  :is-valid="isBusinessSetupValid"
                  :validation-message="businessSetupWarning"
                  @proceed="proceedFromBusinessSetup"
                  @skip="skipBusinessSetup"
                  @back="goBack"
                />

                <Usergenretags 
                  v-if="currentStep === 'userGenre'"
                  :selected="signupDraft.preferences.genres"
                  :is-valid="isGenreValid"
                  :validation-message="genreWarning"
                  @update:selected="signupDraft.preferences.genres = $event"
                  @proceed="setStep('userInstrument')"
                  @back="goBack"
                />

                <Userinstrumenttags 
                  v-if="currentStep === 'userInstrument'"
                  :selected="signupDraft.preferences.instruments"
                  :is-valid="isInstrumentValid"
                  :validation-message="instrumentWarning"
                  @update:selected="signupDraft.preferences.instruments = $event"
                  @complete="completeUserFlow"
                  @back="goBack"
                />

                <div v-if="submitLoading" class="mt-3 rounded-md border border-[#D0D4F7]/40 bg-[#D0D4F7]/10 px-3 py-2 text-sm text-[#D0D4F7]">
                  Creating your account...
                </div>

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