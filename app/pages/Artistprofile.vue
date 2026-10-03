<script setup lang="ts">
definePageMeta({
  layout: 'artist',
  middleware: ['auth', 'artist']
})

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { validateImageFile } from '~/utils/imageOptimizer'
import { getMilestoneInitials } from '~/utils/milestoneHelper'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile, resolveUserType } = useTonoAuth()
const { uploadAvatar, uploadCover, isUploadingAvatar, isUploadingCover, uploadError } = useMediaUpload()

const artistName = ref('Artist')
const artistBio = ref('')
const usertype = ref('')
const artistTags = ref<string[]>([])
const profilePicture = ref<string | null>(null)
const coverPicture = ref<string | null>(null)
const globalAvatarUrl = useState<string | null>('tono_user_avatar', () => null)
const isLoading = ref(true)

// Artist Details & Tags State
const artistId = ref('')
const artistType = ref<'Solo' | 'Band'>('Solo')
const artistGenres = ref<string[]>([])
const artistInstruments = ref<string[]>([])
const isEditDetailsOpen = ref(false)

// Multipage Tab State
const route = useRoute()
const activeTab = ref<'posts' | 'gigs' | 'calendar' | 'portfolio' | 'contact' | 'members'>('posts')

import type { PostItem } from '~/composables/useArtistPosts'
import { formatPostTimestamp, formatCount } from '~/utils/postHelpers'
import { useBandMembers, type BandMemberItem } from '~/composables/useBandMembers'
import { normalizeRole } from '~/utils/roleHelper'
import BandInviteMemberModal from '~/components/BandInviteMemberModal.vue'

// Posts Feed & Modals State
const isCreatePostOpen = ref(false)
const selectedPost = ref<PostItem | null>(null)
const isPostModalOpen = ref(false)

const {
  posts,
  fetchArtistPosts,
  fetchPostById,
  toggleLike,
  deletePost,
  subscribeToPostsRealtime,
  unsubscribeFromPostsRealtime,
} = useArtistPosts()

// Options dropdown, edit & delete post state
const activeMenuPostId = ref<string | null>(null)
const isDeletingPost = ref(false)
const isEditPostOpen = ref(false)
const postToEdit = ref<PostItem | null>(null)

const togglePostMenu = (postId: string) => {
  activeMenuPostId.value = activeMenuPostId.value === postId ? null : postId
}

const closePostMenu = () => {
  activeMenuPostId.value = null
}

const openEditModal = (post: PostItem) => {
  activeMenuPostId.value = null
  postToEdit.value = post
  isEditPostOpen.value = true
}

const handlePostUpdated = (updatedPost: PostItem) => {
  if (selectedPost.value?.POST_ID === updatedPost.POST_ID) {
    selectedPost.value = updatedPost
  }
}

const handleDeletePost = async (postId: string) => {
  activeMenuPostId.value = null
  if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) {
    return
  }

  isDeletingPost.value = true
  try {
    const success = await deletePost(postId)
    if (success) {
      if (selectedPost.value?.POST_ID === postId) {
        closePostModal()
      }
    } else {
      alert('Failed to delete post. Please try again.')
    }
  } finally {
    isDeletingPost.value = false
  }
}

const openPostDetail = (post: PostItem) => {
  selectedPost.value = post
  isPostModalOpen.value = true
}

const closePostModal = () => {
  isPostModalOpen.value = false
  selectedPost.value = null
}

const handlePostCreated = (newPost: PostItem) => {
  isCreatePostOpen.value = false
}

const handleSharePost = (post: PostItem) => {
  if (import.meta.client && navigator.clipboard) {
    const postUrl = `${window.location.origin}/Artistprofile?postId=${post.POST_ID}`
    navigator.clipboard.writeText(postUrl)
  }
}

// Watch artistId to load posts and subscribe to realtime
watch(
  artistId,
  async (id) => {
    if (id) {
      await fetchArtistPosts(id)
      subscribeToPostsRealtime(id)
    }
  },
  { immediate: true }
)

// Watch query param for notification deep-linking: /Artistprofile?postId=...
watch(
  () => route.query.postId,
  async (postId) => {
    if (postId) {
      activeTab.value = 'posts'
      const found = posts.value.find((p) => p.POST_ID === postId) || (await fetchPostById(postId as string))
      if (found) {
        openPostDetail(found)
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('click', closePostMenu)
  }
})

onBeforeUnmount(() => {
  unsubscribeFromPostsRealtime()
  if (import.meta.client) {
    window.removeEventListener('click', closePostMenu)
  }
})

// Gigs Tab State
const eventsLoading = ref(false)
const yourEvents = ref<any[]>([])
const pendingOffers = ref<any[]>([])
const allArtistContracts = ref<any[]>([])
const contractFilter = ref<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
const gigsSubTab = ref<'all' | 'gigs' | 'contracts'>('all')

// Upcoming Events for Posts Tab Sidebar
const upcomingEvents = computed(() => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (yourEvents.value || [])
    .filter((e: any) => {
      const dateStr = (e.End_Date || e.Start_Date || e.Event_Date || e.JOB_LISTING?.Start_Date || '').split('T')[0]
      return !dateStr || dateStr >= todayStr
    })
    .sort((a: any, b: any) => {
      const da = (a.Start_Date || a.Event_Date || a.JOB_LISTING?.Start_Date || '').split('T')[0]
      const db = (b.Start_Date || b.Event_Date || b.JOB_LISTING?.Start_Date || '').split('T')[0]
      return da.localeCompare(db)
    })
    .slice(0, 4)
    .map((e: any) => {
      const rawDate = e.Start_Date || e.Event_Date || e.JOB_LISTING?.Start_Date || ''
      let day = '--'
      let month = 'TBD'

      if (rawDate) {
        const clean = String(rawDate).split('T')[0] || ''
        const parts = clean.split('-')
        const y = Number(parts[0])
        const m = Number(parts[1])
        const d = Number(parts[2])
        if (y && m && d) {
          const dateObj = new Date(y, m - 1, d)
          day = String(dateObj.getDate())
          month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
        }
      }

      const title = e.JOB_LISTING?.Event_Title || (e.Booking_Type === 'Direct' ? 'Direct Booking' : 'Live Performance')
      const location = e.Venue_Location || e.JOB_LISTING?.Location || e.BUSINESS_PROFILE?.Business_Address || e.BUSINESS_PROFILE?.Business_Name || 'Venue TBD'

      return {
        id: e.Booking_ID || e.Contract_Code || Math.random().toString(),
        day,
        month,
        title,
        location,
        contract: e,
      }
    })
})

const filteredContracts = computed(() => {
  if (contractFilter.value === 'all') return allArtistContracts.value
  if (contractFilter.value === 'pending') {
    return allArtistContracts.value.filter(c => ['Pending_Artist_Approval', 'Pending', 'Draft'].includes(c.Status))
  }
  if (contractFilter.value === 'confirmed') {
    return allArtistContracts.value.filter(c => ['Confirmed', 'Active', 'Completed'].includes(c.Status))
  }
  if (contractFilter.value === 'cancelled') {
    return allArtistContracts.value.filter(c => ['Cancelled', 'Declined'].includes(c.Status))
  }
  return allArtistContracts.value
})

// Modal for Form 2 Contract Review
const selectedContractForForm2 = ref<any | null>(null)
const isForm2ModalOpen = ref(false)

const openForm2Modal = (contract: any) => {
  selectedContractForForm2.value = contract
  isForm2ModalOpen.value = true
}

const fetchArtistEvents = async () => {
  if (!artistId.value) return
  eventsLoading.value = true
  try {
    const db = supabase as any

    // 1. Fetch Confirmed Events (Both Job-linked & Direct Contracts)
    const { data: confirmedData, error: confirmedErr } = await db
      .from('BOOKING_CONTRACT')
      .select(`
        Booking_ID,
        Contract_Code,
        Job_ID,
        Booking_Type,
        Start_Date,
        End_Date,
        Event_Date,
        Start_Time,
        End_Time,
        Venue_Location,
        Agreed_Fee,
        Song_Lineup,
        Song_Lineup_JSON,
        Required_Equipment,
        Status,
        Requester_Account_ID,
        USER_ACCOUNT:Requester_Account_ID (
          Username,
          Profile_Picture
        ),
        BUSINESS_PROFILE:Provider_Business_ID (
          Business_Name
        ),
        JOB_LISTING (
          Job_ID,
          Job_Code,
          Event_Title,
          Location,
          Start_Date,
          End_Date,
          Start_Time,
          End_Time,
          Compensation_Fee,
          Description
        )
      `)
      .eq('Provider_Artist_ID', artistId.value)
      .in('Status', ['Confirmed', 'Active'])
      .order('Start_Date', { ascending: true })

    if (!confirmedErr && confirmedData) {
      yourEvents.value = confirmedData
    }

    // 2. Fetch Pending Contract Offers (Form 2 Review Trigger)
    const { data: offersData } = await db
      .from('BOOKING_CONTRACT')
      .select(`
        Booking_ID,
        Contract_Code,
        Job_ID,
        Booking_Type,
        Start_Date,
        End_Date,
        Event_Date,
        Start_Time,
        End_Time,
        Venue_Location,
        Agreed_Fee,
        Song_Lineup,
        Song_Lineup_JSON,
        Required_Equipment,
        Status,
        Requester_Account_ID,
        BUSINESS_PROFILE:Provider_Business_ID (
          Business_Name
        ),
        JOB_LISTING (
          Job_ID,
          Job_Code,
          Event_Title,
          Location
        )
      `)
      .eq('Provider_Artist_ID', artistId.value)
      .in('Status', ['Pending_Artist_Approval', 'Pending', 'Draft'])

    if (offersData) {
      pendingOffers.value = offersData
    }

    // 3. Fetch All Booking Contracts for this artist (Direct Bookings & Job Agreements)
    const { data: allContractsData } = await db
      .from('BOOKING_CONTRACT')
      .select(`
        Booking_ID,
        Contract_Code,
        Job_ID,
        Booking_Type,
        Start_Date,
        End_Date,
        Event_Date,
        Start_Time,
        End_Time,
        Venue_Location,
        Agreed_Fee,
        Song_Lineup,
        Song_Lineup_JSON,
        Required_Equipment,
        Status,
        Is_Rush_Booking,
        Created_at,
        Requester_Account_ID,
        USER_ACCOUNT:Requester_Account_ID (
          Username,
          Profile_Picture
        ),
        BUSINESS_PROFILE:Provider_Business_ID (
          Business_Name
        ),
        JOB_LISTING (
          Job_ID,
          Job_Code,
          Event_Title,
          Location
        )
      `)
      .eq('Provider_Artist_ID', artistId.value)
      .order('Created_at', { ascending: false })

    if (allContractsData) {
      allArtistContracts.value = allContractsData
    }
  } catch (e) {
    console.error('Failed to load artist gigs:', e)
  } finally {
    eventsLoading.value = false
  }
}

// Portfolio Composable and State
const isOwner = ref(true)
const {
  activeEditingSection,
  isLoading: isPortfolioLoading,
  isSaving: isPortfolioSaving,
  portfolioError,
  mediaItems,
  audioItems,
  milestoneItems,
  posterItems,
  draftMediaItems,
  draftAudioItems,
  draftMilestones,
  draftPosters,
  fetchPortfolio,
  startEditing: startPortfolioEditing,
  cancelEditing: cancelPortfolioEditing,
  uploadPortfolioImage,
  saveMediaSection,
  saveAudioSection,
  saveMilestonesSection,
  savePostersSection,
} = useArtistPortfolio()

// Modals State & Editing Tracking
const isAddMediaOpen = ref(false)
const isAddAudioOpen = ref(false)
const isAddMilestoneOpen = ref(false)
const isAddPosterOpen = ref(false)

const editingMediaIndex = ref<number | null>(null)
const editingAudioIndex = ref<number | null>(null)
const editingMilestoneIndex = ref<number | null>(null)
const editingPosterIndex = ref<number | null>(null)

const activeEditingMediaItem = computed(() =>
  editingMediaIndex.value !== null ? draftMediaItems.value[editingMediaIndex.value] : null
)
const activeEditingAudioItem = computed(() =>
  editingAudioIndex.value !== null ? draftAudioItems.value[editingAudioIndex.value] : null
)
const activeEditingMilestoneItem = computed(() =>
  editingMilestoneIndex.value !== null ? draftMilestones.value[editingMilestoneIndex.value] : null
)
const activeEditingPosterItem = computed(() =>
  editingPosterIndex.value !== null ? draftPosters.value[editingPosterIndex.value] : null
)

const handleCancelEditing = () => {
  cancelPortfolioEditing()
  closeMediaModal()
  closeAudioModal()
  closeMilestoneModal()
  closePosterModal()
}

const openAddMedia = () => {
  editingMediaIndex.value = null
  isAddMediaOpen.value = true
}

const openEditMedia = (index: number) => {
  editingMediaIndex.value = index
  isAddMediaOpen.value = true
}

const closeMediaModal = () => {
  isAddMediaOpen.value = false
  editingMediaIndex.value = null
}

const openAddAudio = () => {
  editingAudioIndex.value = null
  isAddAudioOpen.value = true
}

const openEditAudio = (index: number) => {
  editingAudioIndex.value = index
  isAddAudioOpen.value = true
}

const closeAudioModal = () => {
  isAddAudioOpen.value = false
  editingAudioIndex.value = null
}

const openAddMilestone = () => {
  editingMilestoneIndex.value = null
  isAddMilestoneOpen.value = true
}

const openEditMilestone = (index: number) => {
  editingMilestoneIndex.value = index
  isAddMilestoneOpen.value = true
}

const closeMilestoneModal = () => {
  isAddMilestoneOpen.value = false
  editingMilestoneIndex.value = null
}

const openAddPoster = () => {
  editingPosterIndex.value = null
  isAddPosterOpen.value = true
}

const openEditPoster = (index: number) => {
  editingPosterIndex.value = index
  isAddPosterOpen.value = true
}

const closePosterModal = () => {
  isAddPosterOpen.value = false
  editingPosterIndex.value = null
}

const sectionTitleMap: Record<string, string> = {
  media: 'FEATURED MEDIA',
  songs: 'RELEASED SONGS',
  milestones: 'MILESTONES & ACHIEVEMENTS',
  posters: 'PROMOTIONAL MATERIALS',
}

const handleSaveActiveSection = async () => {
  if (!artistId.value) return
  try {
    if (activeEditingSection.value === 'media') {
      await saveMediaSection(artistId.value)
    } else if (activeEditingSection.value === 'songs') {
      await saveAudioSection(artistId.value)
    } else if (activeEditingSection.value === 'milestones') {
      await saveMilestonesSection(artistId.value)
    } else if (activeEditingSection.value === 'posters') {
      await savePostersSection(artistId.value)
    }
  } catch (err: any) {
    console.error('Failed to save portfolio section:', err)
  }
}

const removeDraftMedia = (index: number) => {
  draftMediaItems.value.splice(index, 1)
}

const removeDraftAudio = (index: number) => {
  draftAudioItems.value.splice(index, 1)
}

const removeDraftMilestone = (index: number) => {
  draftMilestones.value.splice(index, 1)
}

const removeDraftPoster = (index: number) => {
  draftPosters.value.splice(index, 1)
}

const onMediaModalSaved = (payload: { url: string; title: string; caption: string }) => {
  const item = editingMediaIndex.value !== null ? draftMediaItems.value[editingMediaIndex.value] : null
  if (item) {
    item.url = payload.url
    item.title = payload.title
    item.displayText = payload.caption
  } else {
    draftMediaItems.value.push({
      id: `draft_${Date.now()}`,
      artistId: artistId.value,
      category: 'media_embed',
      platform: 'youtube',
      title: payload.title,
      displayText: payload.caption,
      url: payload.url,
      displayOrder: draftMediaItems.value.length,
    })
  }
  closeMediaModal()
}

const onAudioModalSaved = (payload: { url: string; title: string; displayText: string; platform: string }) => {
  const item = editingAudioIndex.value !== null ? draftAudioItems.value[editingAudioIndex.value] : null
  if (item) {
    item.url = payload.url
    item.title = payload.title
    item.displayText = payload.displayText
    item.platform = payload.platform
  } else {
    draftAudioItems.value.push({
      id: `draft_${Date.now()}`,
      artistId: artistId.value,
      category: 'audio_embed',
      platform: payload.platform,
      title: payload.title,
      displayText: payload.displayText,
      url: payload.url,
      displayOrder: draftAudioItems.value.length,
    })
  }
  closeAudioModal()
}

const onMilestoneModalSaved = (payload: { fileUrl: string; title: string; eventDate: string; description: string }) => {
  const item = editingMilestoneIndex.value !== null ? draftMilestones.value[editingMilestoneIndex.value] : null
  if (item) {
    item.fileUrl = payload.fileUrl
    item.title = payload.title
    item.eventDate = payload.eventDate
    item.description = payload.description
  } else {
    draftMilestones.value.push({
      id: `draft_${Date.now()}`,
      artistId: artistId.value,
      category: 'milestone',
      title: payload.title,
      eventDate: payload.eventDate,
      description: payload.description,
      mediaType: 'image',
      fileUrl: payload.fileUrl,
      displayOrder: draftMilestones.value.length,
    })
  }
  closeMilestoneModal()
}

const onPosterModalSaved = (payload: { fileUrl: string; title: string }) => {
  const item = editingPosterIndex.value !== null ? draftPosters.value[editingPosterIndex.value] : null
  if (item) {
    item.fileUrl = payload.fileUrl
    item.title = payload.title
  } else {
    draftPosters.value.push({
      id: `draft_${Date.now()}`,
      artistId: artistId.value,
      category: 'poster',
      title: payload.title,
      mediaType: 'image',
      fileUrl: payload.fileUrl,
      displayOrder: draftPosters.value.length,
    })
  }
  closePosterModal()
}

const avatarInputRef = ref<HTMLInputElement | null>(null)
const coverInputRef = ref<HTMLInputElement | null>(null)

// Media Cropper Modal State
const isCropperOpen = ref(false)
const cropperMode = ref<'avatar' | 'cover'>('avatar')
const cropperImageSource = ref<string | File | Blob | null>(null)


const tagsDisplay = computed(() => {
  if (artistTags.value.length === 0) return 'No tags selected'
  return artistTags.value.join(', ')
})

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()

    if (profile) {
      if (profile.account) {
        profilePicture.value = profile.account.Profile_Picture || null
        coverPicture.value = profile.account.Cover_Picture || null
        if (profile.account.Profile_Picture) {
          globalAvatarUrl.value = profile.account.Profile_Picture
        }
      }

      if (profile.artistProfile) {
        artistId.value = profile.artistProfile.ARTIST_ID
        artistType.value = profile.artistProfile.Artist_Type === 'Band' ? 'Band' : 'Solo'
        fetchPortfolio(profile.artistProfile.ARTIST_ID)
      }

      // If artist is Band, fetch Band_Name from BAND table
      if (profile.artistProfile?.Artist_Type === 'Band') {
        const { data: bandData } = await supabase
          .from('BAND')
          .select('Band_Name')
          .eq('ARTIST_ID', profile.artistProfile.ARTIST_ID)
          .maybeSingle()

        if (bandData?.Band_Name) {
          artistName.value = bandData.Band_Name
        } else if (profile.artistProfile?.StageName) {
          artistName.value = profile.artistProfile.StageName
        } else if (profile.account?.Username) {
          artistName.value = profile.account.Username
        }
      } else if (profile.artistProfile?.Artist_Type === 'Solo') {
        const { data: soloData } = await supabase
          .from('SOLO_ARTIST')
          .select('Artist_Name')
          .eq('ARTIST_ID', profile.artistProfile.ARTIST_ID)
          .maybeSingle()

        if (soloData?.Artist_Name) {
          artistName.value = soloData.Artist_Name
        } else if (profile.artistProfile?.StageName) {
          artistName.value = profile.artistProfile.StageName
        } else if (profile.account?.Username) {
          artistName.value = profile.account.Username
        }
      } else if (profile.artistProfile?.StageName) {
        artistName.value = profile.artistProfile.StageName
      } else if (profile.account?.Username) {
        artistName.value = profile.account.Username
      }

      if (profile.artistProfile?.Bio) {
        artistBio.value = profile.artistProfile.Bio
      }

      usertype.value = resolveUserType(profile)
      artistGenres.value = profile.genres || []
      artistInstruments.value = profile.instruments || []
      artistTags.value = [...artistGenres.value, ...artistInstruments.value]
      if (route.query.tab) {
        const tabParam = route.query.tab as string
        if (tabParam === 'events') {
          activeTab.value = 'gigs'
        } else if (['posts', 'gigs', 'calendar', 'portfolio', 'contact', 'members'].includes(tabParam)) {
          activeTab.value = tabParam as any
        }
      }
      await fetchArtistEvents()
      setupRealtimeContracts()

      if (profile.artistProfile?.Artist_Type === 'Band') {
        await fetchBandMembers(profile.artistProfile.ARTIST_ID, true)
        setupRealtimeBandMembers()
      }

      if (route.query.contractId) {
        activeTab.value = 'gigs'
        gigsSubTab.value = 'contracts'
        const target = allArtistContracts.value.find(
          (c: any) => c.Booking_ID === route.query.contractId || c.Contract_Code === route.query.contractId
        ) || pendingOffers.value.find(
          (c: any) => c.Booking_ID === route.query.contractId || c.Contract_Code === route.query.contractId
        )
        if (target) {
          openForm2Modal(target)
        }
      }
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
  } finally {
    isLoading.value = false
  }
})

// Realtime Booking Contract Sync
let artistContractsRealtimeChannel: any = null

const setupRealtimeContracts = () => {
  if (artistContractsRealtimeChannel) {
    supabase.removeChannel(artistContractsRealtimeChannel)
    artistContractsRealtimeChannel = null
  }
  if (!artistId.value) return

  artistContractsRealtimeChannel = supabase
    .channel(`artist-profile-contracts-${artistId.value}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'BOOKING_CONTRACT',
        filter: `Provider_Artist_ID=eq.${artistId.value}`
      },
      () => {
        fetchArtistEvents()
      }
    )
    .subscribe()
}

onBeforeUnmount(() => {
  if (artistContractsRealtimeChannel) {
    supabase.removeChannel(artistContractsRealtimeChannel)
    artistContractsRealtimeChannel = null
  }
  if (cleanupBandMembersRealtime) {
    cleanupBandMembersRealtime()
    cleanupBandMembersRealtime = null
  }
})

// Band Members Management State
const isInviteModalOpen = ref(false)
const memberToRemove = ref<BandMemberItem | null>(null)
const isRemoveConfirmOpen = ref(false)
const removeSuccessToast = ref('')

const {
  members: bandMembers,
  isLoading: isBandMembersLoading,
  isActionLoading: isBandActionLoading,
  fetchBandMembers,
  removeMember,
  subscribeToBandMembersRealtime,
} = useBandMembers()

const activeMembersCount = computed(() => {
  return bandMembers.value.filter(m => m.status === 'Accepted').length
})

const pendingBandMembersCount = computed(() => {
  return bandMembers.value.filter(m => m.status === 'Pending').length
})

let cleanupBandMembersRealtime: (() => void) | null = null
const setupRealtimeBandMembers = () => {
  if (cleanupBandMembersRealtime) {
    cleanupBandMembersRealtime()
    cleanupBandMembersRealtime = null
  }
  if (artistId.value && artistType.value === 'Band') {
    cleanupBandMembersRealtime = subscribeToBandMembersRealtime(artistId.value, () => {
      fetchBandMembers(artistId.value, true)
    })
  }
}

const handleOpenRemoveConfirm = (member: BandMemberItem) => {
  memberToRemove.value = member
  isRemoveConfirmOpen.value = true
}

const handleConfirmRemoveMember = async () => {
  if (!memberToRemove.value || !artistId.value) return
  const target = memberToRemove.value
  const res = await removeMember(artistId.value, target.memberId)
  if (res.success) {
    removeSuccessToast.value = target.status === 'Accepted'
      ? `Removed ${target.artistName} from band.`
      : `Cancelled invitation for ${target.artistName}.`
    setTimeout(() => {
      removeSuccessToast.value = ''
    }, 4000)
  }
  isRemoveConfirmOpen.value = false
  memberToRemove.value = null
}

const handleMemberInvited = (payload: { accountId: string; role: string; artistName: string }) => {
  removeSuccessToast.value = `Invitation sent to ${payload.artistName} as ${payload.role}!`
  setTimeout(() => {
    removeSuccessToast.value = ''
  }, 4500)
}

// Watch contractId query parameter for notification clicks while on the page
watch(
  () => route.query.contractId,
  (newContractId) => {
    if (newContractId) {
      activeTab.value = 'gigs'
      gigsSubTab.value = 'contracts'
      const target = allArtistContracts.value.find(
        (c: any) => c.Booking_ID === newContractId || c.Contract_Code === newContractId
      ) || pendingOffers.value.find(
        (c: any) => c.Booking_ID === newContractId || c.Contract_Code === newContractId
      )
      if (target) {
        openForm2Modal(target)
      }
    }
  }
)

const openEditDetails = () => {
  isEditDetailsOpen.value = true
}

const onProfileDetailsSaved = (data: {
  name: string
  bio: string
  genres: string[]
  instruments: string[]
}) => {
  artistName.value = data.name
  artistBio.value = data.bio
  artistGenres.value = data.genres
  artistInstruments.value = data.instruments
  artistTags.value = [...data.genres, ...data.instruments]
}

const triggerAvatarSelect = () => {
  avatarInputRef.value?.click()
}

const triggerCoverSelect = () => {
  coverInputRef.value?.click()
}

const repositionAvatar = () => {
  if (!profilePicture.value) return
  cropperMode.value = 'avatar'
  cropperImageSource.value = profilePicture.value
  isCropperOpen.value = true
}

const repositionCover = () => {
  if (!coverPicture.value) return
  cropperMode.value = 'cover'
  cropperImageSource.value = coverPicture.value
  isCropperOpen.value = true
}

const onAvatarChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const validation = validateImageFile(file, 15)
  if (!validation.valid) {
    uploadError.value = validation.error || 'Invalid image file.'
    target.value = ''
    return
  }

  cropperMode.value = 'avatar'
  cropperImageSource.value = file
  isCropperOpen.value = true
  target.value = ''
}

const onCoverChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const validation = validateImageFile(file, 20)
  if (!validation.valid) {
    uploadError.value = validation.error || 'Invalid image file.'
    target.value = ''
    return
  }

  cropperMode.value = 'cover'
  cropperImageSource.value = file
  isCropperOpen.value = true
  target.value = ''
}

const onCropperApply = async (croppedBlob: Blob) => {
  isCropperOpen.value = false
  try {
    if (cropperMode.value === 'avatar') {
      const result = await uploadAvatar(croppedBlob, profilePicture.value)
      if (result?.url) {
        profilePicture.value = result.url
        globalAvatarUrl.value = result.url
      }
    } else {
      const result = await uploadCover(croppedBlob, coverPicture.value)
      if (result?.url) {
        coverPicture.value = result.url
      }
    }
  } catch (err) {
    console.error('Failed to upload cropped image:', err)
  }
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/Login')
}
</script>

<template>
  <head>
    <title>Artist Profile | TONO</title>
  </head>
  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen pb-16 overflow-x-hidden">

    <!-- Media Cropper Modal -->
    <MediaCropperModal :is-open="isCropperOpen" :image-source="cropperImageSource" :mode="cropperMode"
      @close="isCropperOpen = false" @apply="onCropperApply" />

    <!-- Edit Profile Details Modal -->
    <ArtistEditDetailsModal :is-open="isEditDetailsOpen" :artist-id="artistId" :artist-type="artistType"
      :initial-name="artistName" :initial-bio="artistBio" :initial-genres="artistGenres"
      :initial-instruments="artistInstruments" @close="isEditDetailsOpen = false" @saved="onProfileDetailsSaved" />

    <!-- Hidden File Inputs -->
    <input ref="avatarInputRef" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden"
      @change="onAvatarChange" />
    <input ref="coverInputRef" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden"
      @change="onCoverChange" />

    <!-- Header Banner & Profile Info -->
    <div class="relative w-full overflow-hidden bg-[#131315] border-b border-[#46464D]/20">
      <!-- Background Banner Image -->
      <div class="absolute inset-0 z-0">
        <div v-if="isLoading" class="w-full h-full bg-[#1E1E24] animate-pulse"></div>
        <img v-else :src="coverPicture || ''" alt="Profile Banner"
          class="w-full h-full object-cover object-center opacity-70 mask-x-from-70% mask-x-to-90%" />
        <!-- Soft gradient overlay for contrast on both mobile and desktop -->
        <div
          class="absolute inset-0 bg-linear-to-t from-[#0E0E10] via-[#0E0E10]/40 to-transparent md:bg-linear-to-r md:from-[#0E0E10]/90 md:via-[#0E0E10]/60 md:to-transparent">
        </div>
      </div>

      <!-- Update / Reposition Cover Action Buttons -->
      <div v-if="!isLoading"
        class="absolute top-4 right-4 sm:top-6 sm:right-8 md:right-16 z-20 flex items-center gap-2">
        <button v-if="coverPicture" @click="repositionCover" :disabled="isUploadingCover"
          class="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg group"
          title="Adjust cover framing">
          <Icon name="ic:round-crop" class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
          <span class="hidden xs:inline">Reposition</span>
        </button>

        <button @click="triggerCoverSelect" :disabled="isUploadingCover"
          class="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg group">
          <Icon v-if="isUploadingCover" name="ic:baseline-sync" class="animate-spin text-base text-[#D0D4F7]" />
          <Icon v-else name="ic:outline-photo-camera"
            class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
          <span>{{ isUploadingCover ? 'Uploading...' : (coverPicture ? 'Change Cover' : 'Add Cover') }}</span>
        </button>
      </div>

      <!-- Loading Skeleton for Header -->
      <div v-if="isLoading"
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6 animate-pulse">
        <div class="flex flex-col items-center md:items-start gap-3 w-full md:w-auto">
          <div class="h-4 w-24 bg-[#1E1E24] rounded-md"></div>
          <div class="h-12 sm:h-16 w-64 sm:w-80 max-w-full bg-[#1E1E24] rounded-xl"></div>
          <div class="h-4 w-48 sm:w-64 max-w-full bg-[#1E1E24] rounded-md"></div>
          <div class="h-5 w-48 sm:w-60 max-w-full bg-[#1E1E24] rounded-md"></div>
        </div>
        <div
          class="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full bg-[#1E1E24] border border-[#46464D]/30 shrink-0">
        </div>
      </div>

      <!-- Loaded Header Info -->
      <div v-else
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6">
        <!-- Left: Details -->
        <div class="flex flex-col items-center md:items-start text-center md:text-left gap-1.5 min-w-0 max-w-full">
          <span class="font-Geist font-medium text-xs sm:text-[14px] text-[#D0D4F7]/90 tracking-wider uppercase">
            {{ usertype || 'Artist' }}
          </span>
          <h1
            class="font-Sora font-bold text-3xl sm:text-5xl lg:text-[64px] tracking-tight text-white leading-tight wrap-break-word max-w-full">
            {{ artistName || 'Artist' }}
          </h1>
          <div class="max-w-xl my-1">
            <p v-if="artistBio"
              class="text-xs sm:text-sm md:text-[15px] text-gray-200/90 leading-relaxed line-clamp-3 md:line-clamp-4">
              {{ artistBio }}
            </p>
            <p v-else class="text-xs sm:text-sm text-gray-400/70 italic">
              No bio yet. Click Update Profile Details to add your story.
            </p>
          </div>
          <div
            class="flex flex-wrap items-center justify-center md:justify-start gap-2 bg-black/50 backdrop-blur-xs px-3 py-1.5 rounded-lg max-w-full border border-white/5">
            <span class="font-HankenGrotesk text-xs sm:text-[15px] text-gray-400 font-bold shrink-0">
              Artist Tags:
            </span>
            <span class="text-xs sm:text-[15px] text-[#D0D4F7] font-medium wrap-break-word">
              {{ tagsDisplay }}
            </span>
          </div>

          <!-- Update Profile Details Button -->
          <button @click="openEditDetails"
            class="mt-2.5 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E1E24] hover:bg-[#2A2A32] border border-[#46464D]/60 hover:border-[#D0D4F7]/60 text-xs sm:text-sm font-medium text-gray-200 hover:text-white transition-all cursor-pointer shadow-md group">
            <Icon name="ic:outline-edit"
              class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
            <span>Update Profile Details</span>
          </button>

          <!-- Error Alert if Upload Fails -->
          <p v-if="uploadError"
            class="text-xs sm:text-sm text-red-400 mt-2 bg-red-950/40 border border-red-800/40 px-3 py-1 rounded-md">
            {{ uploadError }}
          </p>
        </div>

        <!-- Right: Avatar & Edit button -->
        <div class="flex flex-col justify-center items-center shrink-0">
          <div @click="triggerAvatarSelect"
            class="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-[#353437] rounded-full flex items-center justify-center text-gray-500 overflow-hidden shadow-2xl border-2 border-[#46464D]/50 relative group cursor-pointer"
            title="Click to change profile picture">
            <!-- Dynamic Avatar or Fallback Icon -->
            <img v-if="profilePicture" :src="profilePicture" alt="Profile Avatar"
              class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
            <Icon v-else name="ic:outline-account-circle" class="w-full h-full text-[#46464D]" />

            <!-- Hover / Upload Overlay -->
            <div
              class="absolute inset-0 bg-black/55 backdrop-blur-xs flex flex-col items-center justify-center transition-opacity"
              :class="isUploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'">
              <Icon v-if="isUploadingAvatar" name="ic:baseline-sync"
                class="text-2xl sm:text-3xl text-[#D0D4F7] animate-spin" />
              <template v-else>
                <Icon name="ic:outline-photo-camera" class="text-xl sm:text-2xl text-white mb-0.5" />
                <span class="text-[10px] sm:text-xs text-[#D0D4F7] font-medium tracking-wide">
                  {{ profilePicture ? 'Change' : 'Upload' }}
                </span>
              </template>
            </div>
          </div>
          <div v-if="profilePicture" class="flex items-center gap-2 mt-3">
            <button @click="repositionAvatar" :disabled="isUploadingAvatar"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-xs text-gray-300 hover:text-[#D0D4F7] transition-all cursor-pointer shadow-sm group"
              title="Reposition profile picture">
              <Icon name="ic:round-crop" class="text-sm text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
              <span>Reposition Photo</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="w-full border-b border-[#46464D]/20 bg-[#0E0E10]">
      <div class="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 overflow-x-auto scrollbar-hide">
        <div class="flex gap-8 sm:gap-12 text-[15px] sm:text-[17px] min-w-max">
          <button @click="activeTab = 'posts'" class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'posts' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span class="inline-block py-4 sm:py-5"
              :class="activeTab === 'posts' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Posts
            </span>
          </button>

          <button @click="activeTab = 'gigs'" class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'gigs' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span class="inline-block py-4 sm:py-5 relative"
              :class="activeTab === 'gigs' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Gigs
              <span v-if="pendingOffers.length" class="absolute top-3 -right-2 w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            </span>
          </button>

          <!-- Members Tab (Only for Band artists) -->
          <button
            v-if="artistType === 'Band'"
            @click="activeTab = 'members'"
            class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'members' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'"
          >
            <span
              class="inline-block py-4 sm:py-5 relative"
              :class="activeTab === 'members' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''"
            >
              Members
              <span
                v-if="pendingBandMembersCount > 0"
                class="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-400 text-black font-bold"
              >
                {{ pendingBandMembersCount }}
              </span>
            </span>
          </button>

          <button @click="activeTab = 'calendar'" class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'calendar' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span class="inline-block py-4 sm:py-5 "
              :class="activeTab === 'calendar' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Calendar
            </span>
          </button>

          <button @click="activeTab = 'portfolio'" class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'portfolio' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span class="inline-block py-4 sm:py-5"
              :class="activeTab === 'portfolio' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Portfolio
            </span>
          </button>

          <button @click="activeTab = 'contact'" class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'contact' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span class="inline-block py-4 sm:py-5"
              :class="activeTab === 'contact' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Contact
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8">
      <!-- Loading Skeleton for Feed & Sidebar -->
      <div v-if="isLoading" class="flex flex-col lg:flex-row gap-6 items-start w-full animate-pulse">
        <div class="flex-1 w-full min-w-0 flex flex-col gap-6">
          <div class="h-32 sm:h-40 rounded-xl bg-[#1E1E24]"></div>
          <div class="h-96 rounded-xl bg-[#1E1E24]"></div>
        </div>
        <div class="w-full lg:w-80 xl:w-92 h-80 rounded-xl bg-[#1E1E24] shrink-0"></div>
      </div>

      <!-- Loaded Content -->
      <div v-else>
        <!-- Posts Tab Content -->
        <div v-if="activeTab === 'posts'" class="flex flex-col lg:flex-row gap-6 items-start w-full">
          <!-- Left: Feed Column -->
          <div class="flex-1 w-full min-w-0 flex flex-col gap-6">
            <!-- Create Post Card -->
            <div
              @click="isCreatePostOpen = true"
              class="flex gap-2 flex-col items-center justify-center p-6 sm:p-10 md:p-12 border border-[#46464D] border-dashed rounded-xl min-h-35 sm:h-46.25 transition-all hover:border-[#D0D4F7] hover:bg-[#D0D4F7]/5 group cursor-pointer w-full">
              <div
                class="flex border p-2.5 sm:p-3 rounded-full border-[#46464D] group-hover:border-[#D0D4F7] transition-colors">
                <Icon name="ic:baseline-plus" class="text-xl text-[#C7C5CE] group-hover:text-[#D0D4F7]" />
              </div>
              <h2
                class="font-Geist font-medium text-xs sm:text-[14px] text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-all tracking-wide">
                CREATE A POST
              </h2>
            </div>

            <!-- Empty State (When artist has 0 posts) -->
            <article
              v-if="posts.length === 0"
              class="flex justify-center items-center border-[#46464D]/40 border-dashed border rounded-xl overflow-hidden shadow-lg w-full h-[623.38px] font-Sora"
            >
              <div class="flex flex-col items-center gap-3">
                <Icon name="lucide:megaphone-off" class="text-xl sm:text-[3rem] text-[#D0D4F7]" />
                <h1 class="text-lg">No Posts Yet</h1>
              </div>
            </article>

            <!-- With Post State (When artist has posts) -->
            <template v-else>
              <article
                v-for="post in posts"
                :key="post.POST_ID"
                class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg"
              >
                <!-- 1. Uploaded Image: IF NO IMAGE HIDE THE DIV COMPLETELY (NO PLACEHOLDER IMAGE) -->
                <div
                  v-if="post.Media"
                  class="w-full aspect-video max-h-137.5 overflow-hidden bg-black/40 flex items-center justify-center"
                >
                  <img
                    :src="post.Media"
                    alt="Post Media"
                    class="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500"
                  />
                </div>

                <div class="flex flex-col gap-4 p-4 sm:p-6">
                  <div>
                    <div class="flex items-center justify-between">
                      <h3 class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                        {{ artistName }}
                      </h3>
                      <div class="flex items-center gap-2 sm:gap-3">
                        <span
                          v-if="post.Location"
                          class="text-xs text-gray-400 font-Geist flex items-center gap-1"
                        >
                          <Icon name="ic:outline-location-on" class="text-sm text-[#D0D4F7]" />
                          {{ post.Location }}
                        </span>

                        <!-- Three dots options menu -->
                        <div class="relative">
                          <button
                            type="button"
                            @click.stop="togglePostMenu(post.POST_ID)"
                            class="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                            title="Post options"
                            aria-label="Post options"
                          >
                            <Icon name="ic:round-more-vert" class="text-xl" />
                          </button>

                          <!-- Dropdown Menu -->
                          <div
                            v-if="activeMenuPostId === post.POST_ID"
                            class="absolute right-0 top-full mt-1 w-36 bg-[#222225] border border-[#46464D]/60 rounded-xl shadow-2xl py-1 z-30 flex flex-col"
                            @click.stop
                          >
                            <button
                              type="button"
                              @click.stop="openEditModal(post)"
                              class="w-full px-3 py-2 text-left text-xs sm:text-sm text-gray-200 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Icon name="ic:outline-edit" class="text-base text-[#D0D4F7]" />
                              <span>Edit post</span>
                            </button>
                            <div class="h-px bg-[#46464D]/30 my-0.5"></div>
                            <button
                              type="button"
                              @click.stop="handleDeletePost(post.POST_ID)"
                              class="w-full px-3 py-2 text-left text-xs sm:text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Icon name="ic:round-delete-outline" class="text-base" />
                              <span>Delete post</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <span class="font-HankenGrotesk text-xs text-[#C7C5CE]">
                      {{ formatPostTimestamp(post.Created_at) }}
                    </span>
                  </div>

                  <div v-if="post.Caption">
                    <p class="text-sm sm:text-base text-gray-300 leading-relaxed font-Geist whitespace-pre-line">
                      {{ post.Caption }}
                    </p>
                  </div>

                  <div class="flex justify-between items-center pt-2 border-t border-[#46464D]/20 text-sm">
                    <div class="flex gap-4 sm:gap-6 items-center">
                      <!-- Likes Button with ic:baseline-favorite-border / ic:baseline-favorite in text-[#D0D4F7] -->
                      <button
                        type="button"
                        @click="toggleLike(post.POST_ID)"
                        class="flex gap-1.5 items-center cursor-pointer transition-colors"
                        :class="post.userHasLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'"
                      >
                        <Icon
                          :name="post.userHasLiked ? 'ic:baseline-favorite' : 'ic:baseline-favorite-border'"
                          class="text-xl sm:text-2xl text-[#D0D4F7] transition-transform active:scale-125"
                        />
                        <span
                          class="text-xs sm:text-sm font-medium"
                          :class="post.userHasLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE]'"
                        >
                          {{ formatCount(post.likeCount) }}
                        </span>
                      </button>

                      <!-- Comments Button -->
                      <button
                        type="button"
                        @click="openPostDetail(post)"
                        class="flex gap-1.5 items-center text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer"
                      >
                        <Icon name="ic:sharp-chat-bubble-outline" class="text-xl sm:text-2xl text-[#D0D4F7]" />
                        <span class="text-xs sm:text-sm font-medium">
                          {{ formatCount(post.commentCount) }}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      @click="handleSharePost(post)"
                      class="text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer"
                      title="Share Post"
                    >
                      <Icon name="ic:round-share" class="text-xl sm:text-2xl" />
                    </button>
                  </div>
                </div>
              </article>
            </template>
          </div>

          <!-- Right: Upcoming Events Sidebar -->
          <aside
            class="w-full lg:w-80 xl:w-92 shrink-0 bg-[#1B1B1D] border border-[#46464D]/30 rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-6 shadow-lg">
            <div class="flex flex-col gap-4">
              <h2 class="font-Sora text-lg sm:text-[20px] text-[#D0D4F7] font-semibold">
                Upcoming Events
              </h2>

              <div class="flex flex-col gap-3 sm:gap-4">
                <template v-if="upcomingEvents.length > 0">
                  <div
                    v-for="event in upcomingEvents"
                    :key="event.id"
                    @click="activeTab = 'calendar'"
                    class="flex items-center gap-3 sm:gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div
                      class="flex p-2.5 sm:p-3 border border-[#B4B8DA]/20 rounded-lg bg-[#B4B8DA]/10 items-center justify-center w-12 h-12 sm:w-14 sm:h-14 shrink-0 text-center"
                    >
                      <div class="flex flex-col font-HankenGrotesk leading-tight">
                        <span class="text-sm sm:text-base font-bold text-white">{{ event.day }}</span>
                        <span class="text-[10px] text-[#D0D4F7] uppercase tracking-wider font-semibold">{{ event.month }}</span>
                      </div>
                    </div>

                    <div class="flex flex-col min-w-0">
                      <h4 class="font-medium text-sm sm:text-base text-white truncate">{{ event.title }}</h4>
                      <p class="text-xs text-gray-400 truncate">{{ event.location }}</p>
                    </div>
                  </div>
                </template>

                <div
                  v-else
                  class="py-8 flex flex-col items-center justify-center text-center gap-2 border border-dashed border-[#46464D]/40 rounded-xl bg-white/2"
                >
                  <Icon name="lucide:calendar-off" class="text-2xl text-[#C7C5CE]/50" />
                  <p class="text-xs text-[#C7C5CE]/80 font-Geist">no upcoming events</p>
                </div>
              </div>
            </div>

            <button
              @click="activeTab = 'calendar'"
              class="w-full flex items-center justify-center p-3 border rounded-lg border-[#D0D4F7]/60 hover:border-[#D0D4F7] hover:bg-[#D0D4F7]/10 font-Geist font-medium text-xs sm:text-sm text-[#D0D4F7] transition-all cursor-pointer">
              <span>VIEW ALL EVENTS</span>
            </button>
          </aside>
        </div>

        <!-- Calendar Tab Content Container -->
        <div v-else-if="activeTab === 'calendar'" class="w-full">
          <ArtistGigCalendar :artist-id="artistId" :is-owner="true" />
        </div>

        <!-- Portfolio Tab Content Container -->
        <div v-else-if="activeTab === 'portfolio'" class="w-full flex flex-col gap-6 sm:gap-8">

          <!-- Sticky Floating Banner for Active Editing Section -->
          <div v-if="activeEditingSection"
            class="sticky top-20 z-40 w-full bg-[#131315]/95 backdrop-blur-md border border-[#46464D]/60 rounded-xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-[#D0D4F7] animate-pulse"></span>
              <span class="text-xs font-mono tracking-wider uppercase text-gray-200 font-semibold">
                EDITING MODE: {{ sectionTitleMap[activeEditingSection] }}
              </span>
            </div>
          </div>

          <!-- Top Row: Media Showcase (8 cols on lg) & Released Songs (4 cols on lg) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            <!-- Left Column: Media Articles (Accommodates multiple media items, max 5) -->
            <div class="lg:col-span-8 flex flex-col gap-4 transition-all"
              :class="activeEditingSection === 'media' ? 'p-3.5 sm:p-5 rounded-2xl border-2 border-dashed border-[#D0D4F7]/60 bg-[#D0D4F7]/2' : ''">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <h1 class="text-xl font-Sora font-medium text-white">Media</h1>
                  <span v-if="activeEditingSection === 'media'"
                    class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#1E1E24] border border-[#46464D]/50 text-[#D0D4F7]">
                    {{ draftMediaItems.length }} / 5
                  </span>
                </div>

                <div v-if="isOwner" class="flex items-center gap-1.5">
                  <button v-if="activeEditingSection !== 'media'" @click="startPortfolioEditing('media')"
                    class="flex hover:flex p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Edit Media Section">
                    <Icon name="ic:outline-edit" class="text-lg text-[#D0D4F7]" />
                  </button>
                  <template v-else>
                    <button @click="handleSaveActiveSection" :disabled="isPortfolioSaving"
                      class="flex p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Save Changes">
                      <Icon v-if="isPortfolioSaving" name="ic:baseline-sync" class="animate-spin text-xl" />
                      <Icon v-else name="ic:round-check" class="text-xl" />
                    </button>
                    <button @click="handleCancelEditing" :disabled="isPortfolioSaving"
                      class="flex p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Discard Changes">
                      <Icon name="ic:round-close" class="text-xl" />
                    </button>
                  </template>
                </div>
              </div>

              <!-- Editing Mode: Draft Media Items -->
              <div v-if="activeEditingSection === 'media'" class="flex flex-col gap-5">
                <article v-for="(item, idx) in draftMediaItems" :key="item.id || idx"
                  class="relative bg-[#1C1C1F]/80 border border-[#46464D]/50 rounded-xl overflow-hidden shadow-lg p-3 sm:p-4 space-y-3">
                  <!-- Actions: Edit & Remove -->
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-mono text-gray-400">#{{ idx + 1 }}: {{ item.title || 'Featured Media'
                      }}</span>
                    <div class="flex items-center gap-2">
                      <button @click="openEditMedia(idx)"
                        class="p-1 text-[#D0D4F7] hover:text-white hover:bg-[#D0D4F7]/10 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1"
                        title="Edit Media">
                        <Icon name="ic:outline-edit" class="text-base" />
                        <span>Edit</span>
                      </button>
                      <button @click="removeDraftMedia(idx)"
                        class="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1"
                        title="Remove Media">
                        <Icon name="ic:round-delete-outline" class="text-base" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>

                  <MediaEmbed :url="item.url" :title="item.title" />

                  <div class="space-y-1">
                    <h3 v-if="item.title" class="font-Sora text-sm sm:text-base font-semibold text-white">
                      {{ item.title }}
                    </h3>
                    <p v-if="item.displayText" class="text-xs sm:text-sm text-gray-300 leading-relaxed">
                      {{ item.displayText }}
                    </p>
                  </div>
                </article>

                <!-- Add Media Button (if under 5) -->
                <button v-if="draftMediaItems.length < 5" @click="openAddMedia"
                  class="w-full py-5 border-2 border-dashed border-[#46464D]/60 hover:border-[#D0D4F7] rounded-xl text-xs sm:text-sm font-medium text-gray-300 hover:text-[#D0D4F7] transition-all flex items-center justify-center gap-2 cursor-pointer bg-[#1C1C1F]/40 hover:bg-[#1C1C1F]/70">
                  <Icon name="ic:round-add" class="text-xl text-[#D0D4F7]" />
                  <span>Add Media Article ({{ draftMediaItems.length }} / 5)</span>
                </button>
              </div>

              <!-- Live Mode: Saved Media Items -->
              <div v-else class="flex flex-col gap-6">
                <!-- If items exist in DB -->
                <template v-if="mediaItems.length > 0">
                  <article v-for="item in mediaItems" :key="item.id"
                    class="bg-[#1C1C1F]/60 border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg">
                    <div class="p-3 sm:p-4">
                      <MediaEmbed :url="item.url" :title="item.title" />
                    </div>

                    <div class="flex flex-col gap-2 p-4 sm:py-4 sm:pt-0">
                      <h3 v-if="item.title" class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                        {{ item.title }}
                      </h3>
                      <p v-if="item.displayText" class="text-sm sm:text-base text-gray-300 leading-relaxed">
                        {{ item.displayText }}
                      </p>
                    </div>
                  </article>
                </template>

                <!-- Sample Default Preview (if no items saved yet) -->
                <article v-else
                  class="bg-[#1C1C1F]/60 border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg">
                  <div
                    class="w-full aspect-video sm:aspect-21/9 md:aspect-video max-h-137.5 overflow-hidden bg-black/40">
                    <div class="w-full max-w-3xl aspect-video mx-auto">
                      <iframe class="w-full h-full rounded-lg shadow-lg" src="" title="Responsive Video Player"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                      </iframe>
                    </div>
                  </div>

                  <div class="flex flex-col gap-4 p-4 sm:p-6">
                    <div>
                      <h3 class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                        {{ artistName || 'Artist' }}
                      </h3>
                    </div>

                    <div>
                      <p class="text-sm sm:text-base text-gray-300 leading-relaxed">
                        Caption
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </div>

            <!-- Right Column: Released Songs Audio (Exclusively Spotify & SoundCloud) -->
            <div class="lg:col-span-4 flex flex-col gap-4 transition-all"
              :class="activeEditingSection === 'songs' ? 'p-3.5 sm:p-5 rounded-2xl border-2 border-dashed border-[#D0D4F7]/60 bg-[#D0D4F7]/2' : ''">
              <div class="flex items-center justify-between">
                <h1 class="text-xl font-Sora font-medium text-white">Released Songs</h1>

                <div v-if="isOwner" class="flex items-center gap-1.5">
                  <button v-if="activeEditingSection !== 'songs'" @click="startPortfolioEditing('songs')"
                    class="flex hover:flex p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Edit Released Songs">
                    <Icon name="ic:outline-edit" class="text-lg text-[#D0D4F7]" />
                  </button>
                  <template v-else>
                    <button @click="handleSaveActiveSection" :disabled="isPortfolioSaving"
                      class="flex p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Save Changes">
                      <Icon v-if="isPortfolioSaving" name="ic:baseline-sync" class="animate-spin text-xl" />
                      <Icon v-else name="ic:round-check" class="text-xl" />
                    </button>
                    <button @click="handleCancelEditing" :disabled="isPortfolioSaving"
                      class="flex p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Discard Changes">
                      <Icon name="ic:round-close" class="text-xl" />
                    </button>
                  </template>
                </div>
              </div>

              <!-- Editing Mode: Draft Songs -->
              <div v-if="activeEditingSection === 'songs'" class="flex flex-col gap-4">
                <div v-for="(audio, idx) in draftAudioItems" :key="audio.id || idx"
                  class="bg-[#1C1C1F]/80 border border-[#46464D]/50 rounded-xl p-3.5 shadow-md space-y-2 relative">
                  <div class="flex items-center justify-end">
                    
                    <div class="flex items-center gap-2 shrink-0">
                      <button @click="openEditAudio(idx)"
                        class="p-1 text-[#D0D4F7] hover:text-white hover:bg-[#D0D4F7]/10 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1"
                        title="Edit Song">
                        <Icon name="ic:outline-edit" class="text-base" />
                        <span>Edit</span>
                      </button>
                      <button @click="removeDraftAudio(idx)"
                        class="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-0.5"
                        title="Remove Song">
                        <Icon name="ic:round-delete-outline" class="text-base" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                  <span class="text-xs font-semibold text-white font-Sora truncate">{{ audio.title || 'Song' }}</span>
                  <div class="flex gap-1">
                    <p v-if="audio.displayText" class="text-xs text-gray-400 flex font-bold">
                      Release Notes / Details:
                    </p>
                    <p v-if="audio.displayText" class="text-xs text-gray-400 flex">
                      {{ audio.displayText }}
                    </p>
                  </div>
                 
                  <MediaEmbed :url="audio.url" :title="audio.title" />
                </div>

                <!-- Add Original Song Dashed Box -->
                <button @click="openAddAudio"
                  class="w-full py-4 border-2 border-dashed border-[#46464D]/60 hover:border-[#D0D4F7] rounded-xl text-xs sm:text-sm font-medium text-gray-300 hover:text-[#D0D4F7] transition-all flex items-center justify-center gap-2 cursor-pointer bg-[#1E1E24]/40 hover:bg-[#1E1E24]/70">
                  <Icon name="ic:baseline-add-circle-outline" class="text-lg text-[#D0D4F7]" />
                  <span>Add Original Song</span>
                </button>
              </div>

              <!-- Live Mode: Saved Audio Cards -->
              <div v-else
                class="bg-[#1C1C1F]/60 border rounded-xl border-[#46464D]/40 p-4 sm:p-6 flex flex-col gap-4 shadow-lg">
                <!-- If audio saved in DB -->
                <template v-if="audioItems.length > 0">
                  <div v-for="audio in audioItems" :key="audio.id" class="space-y-1.5 border border-[#303035] rounded-xl">
                    <div class="flex flex-col gap-2 pl-3 pt-2">
                      <div class="flex items-center gap-1">
                        <h1 class="text-xs">Title:</h1>
                        <p v-if="audio.displayText" class="text-xs text-gray-400 rounded w-fit font-bold">
                        {{ audio.title || 'Song' }}
                      </p>
                      </div>
                      
                      <div class="flex items-center gap-1">
                        <h1 class="text-xs">Notes / Details:</h1>
                        <p v-if="audio.displayText" class="text-xs text-gray-400 rounded w-fit font-bold">
                        {{ audio.displayText }}
                      </p>
                      </div>
                    </div>
                    <MediaEmbed :url="audio.url" :title="audio.title" />
                  </div>
                </template>

                <!-- Empty State Placeholders (if no songs saved yet) -->
                <template v-else>
                  <!-- Primary Track Placeholder Slot -->
                  <div
                    class="w-full h-37 rounded-xl border-2 border-dashed border-[#46464D]/50 bg-[#16161A]/50 flex flex-col items-center justify-center p-4 text-center transition-all group hover:border-[#D0D4F7]/40">
                    <div
                      class="w-10 h-10 rounded-full bg-[#1E1E24] border border-[#46464D]/60 flex items-center justify-center text-[#D0D4F7] mb-2 shadow-inner group-hover:scale-105 transition-transform">
                      <Icon name="ic:outline-music-note" class="text-xl" />
                    </div>
                    <p class="font-Sora text-xs sm:text-sm font-semibold text-gray-200">
                      No Released Songs
                    </p>
                    <p class="text-[11px] text-gray-400 mt-0.5">
                      Spotify or SoundCloud tracks will appear here
                    </p>
                    <button v-if="isOwner" @click="startPortfolioEditing('songs')"
                      class="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#D0D4F7] hover:text-white transition-colors cursor-pointer">
                      <Icon name="ic:baseline-add" class="text-xs" />
                      <span>Add Song</span>
                    </button>
                  </div>
                </template>
              </div>
            </div>

          </div>

          <!-- Middle Row: Milestones & Achievements -->
          <div
            class="bg-[#1C1C1F]/60 border rounded-xl border-[#46464D]/40 p-5 sm:p-6 flex flex-col gap-5 shadow-lg transition-all"
            :class="activeEditingSection === 'milestones' ? 'border-2 border-dashed border-[#D0D4F7]/60 bg-[#D0D4F7]/2' : ''">
            <div class="flex items-center justify-between">
              <h1 class="text-xl font-Sora font-medium text-white">MILESTONES & ACHIEVEMENTS</h1>

              <div v-if="isOwner" class="flex items-center gap-1.5">
                <button v-if="activeEditingSection !== 'milestones'"
                  @click="startPortfolioEditing('milestones')"
                  class="flex hover:flex p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Edit Milestones">
                  <Icon name="ic:outline-edit" class="text-lg text-[#D0D4F7]" />
                </button>
                <template v-else>
                  <button @click="handleSaveActiveSection" :disabled="isPortfolioSaving"
                    class="flex p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Save Changes">
                    <Icon v-if="isPortfolioSaving" name="ic:baseline-sync" class="animate-spin text-xl" />
                    <Icon v-else name="ic:round-check" class="text-xl" />
                  </button>
                  <button @click="handleCancelEditing" :disabled="isPortfolioSaving"
                    class="flex p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Discard Changes">
                    <Icon name="ic:round-close" class="text-xl" />
                  </button>
                </template>
              </div>
            </div>

            <!-- Editing Mode: Draft Milestones -->
            <div v-if="activeEditingSection === 'milestones'"
              class="flex items-start gap-6 sm:gap-8 md:gap-10 overflow-x-auto scrollbar-thin pt-3 pb-3 px-2">
              <div v-for="(m, idx) in draftMilestones" :key="m.id || idx"
                class="relative flex flex-col gap-2.5 items-center justify-center shrink-0 group hover:z-30">
                <!-- Milestone Circular Avatar Wrapper -->
                <div class="relative w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 shrink-0">
                  <!-- The Circle Canvas -->
                  <div
                    class="w-full h-full rounded-full overflow-hidden border-2 border-dashed border-[#D0D4F7] shadow-lg flex items-center justify-center bg-linear-to-br from-[#26262E] to-[#151518]">
                    <img v-if="m.fileUrl" :src="m.fileUrl" :alt="m.title || 'Milestone'" class="w-full h-full object-cover" />
                    <div v-else class="flex items-center justify-center w-full h-full select-none">
                      <span class="font-Sora font-bold text-lg sm:text-xl md:text-2xl text-[#D0D4F7] tracking-wider">
                        {{ getMilestoneInitials(m.title) }}
                      </span>
                    </div>
                  </div>

                  <!-- Action Badges: Edit & Delete -->
                  <button
                    type="button"
                    @click.stop="openEditMilestone(idx)"
                    class="absolute -top-1 -left-1 z-30 w-7 h-7 rounded-full bg-[#1E1E24] border border-[#D0D4F7]/80 text-[#D0D4F7] hover:text-white flex items-center justify-center hover:bg-[#282832] transition-all cursor-pointer shadow-lg hover:scale-110"
                    title="Edit Milestone">
                    <Icon name="ic:outline-edit" class="text-xs" />
                  </button>
                  <button
                    type="button"
                    @click.stop="removeDraftMilestone(idx)"
                    class="absolute -top-1 -right-1 z-30 w-7 h-7 rounded-full bg-red-950 border border-red-700 text-red-300 hover:text-white flex items-center justify-center hover:bg-red-800 transition-all cursor-pointer shadow-lg hover:scale-110"
                    title="Remove Milestone">
                    <Icon name="ic:round-delete-outline" class="text-xs" />
                  </button>
                </div>

                <div class="text-center max-w-28 sm:max-w-32">
                  <h2 class="text-xs sm:text-sm font-semibold text-white font-Sora">{{ m.title }}</h2>
                  <span v-if="m.eventDate" class="text-[11px] text-gray-400">{{ m.eventDate }}</span>
                </div>
              </div>

              <!-- Add Milestone Circular Button -->
              <div @click="openAddMilestone"
                class="flex flex-col gap-3 items-center justify-center shrink-0 cursor-pointer group">
                <div
                  class="w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 bg-[#646464]/20 rounded-full font-Sora flex items-center justify-center border-2 border-dashed border-[#D0D4F7]/60 group-hover:border-[#D0D4F7] transition-all">
                  <Icon name="ic:baseline-plus"
                    class="text-2xl text-[#D0D4F7] group-hover:scale-110 transition-transform" />
                </div>
                <h2 class="text-xs sm:text-sm font-medium text-center text-gray-300 group-hover:text-white">Add
                  Milestone
                </h2>
              </div>
            </div>

            <!-- Live Mode: Saved Milestones -->
            <div v-else class="flex items-start gap-6 sm:gap-8 md:gap-10 overflow-x-auto pb-2 scrollbar-thin">
              <template v-if="milestoneItems.length > 0">
                <div v-for="m in milestoneItems" :key="m.id"
                  class="flex flex-col gap-2.5 items-center justify-center shrink-0">
                  <div
                    class="w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 rounded-full overflow-hidden border-2 border-[#D0D4F7]/60 shadow-lg bg-[#1E1E24] flex items-center justify-center bg-linear-to-br from-[#26262E] to-[#151518]">
                    <img v-if="m.fileUrl" :src="m.fileUrl" :alt="m.title || 'Milestone'" class="w-full h-full object-cover" />
                    <div v-else class="flex items-center justify-center w-full h-full select-none">
                      <span class="font-Sora font-bold text-lg sm:text-xl md:text-2xl text-[#D0D4F7] tracking-wider">
                        {{ getMilestoneInitials(m.title) }}
                      </span>
                    </div>
                  </div>
                  <div class="text-center max-w-28 sm:max-w-32">
                    <h2 class="text-xs sm:text-sm font-semibold text-white font-Sora">{{ m.title }}</h2>
                    <span v-if="m.eventDate" class="text-[11px] text-gray-400">{{ m.eventDate }}</span>
                  </div>
                </div>
              </template>

              <!-- Sample Milestones (if none saved yet) -->
              <template v-else>
                <div class="flex flex-col gap-3 items-center justify-center shrink-0">
                  <div class="w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 bg-[#646464] rounded-full font-Sora"></div>
                  <h1 class="text-[1rem] font-medium text-center">Milestone</h1>
                </div>
              </template>
            </div>
          </div>

          <!-- Bottom Row: Promotional Materials (Max 4 Posters, Responsive Grid) -->
          <div
            class="bg-[#1C1C1F]/60 border rounded-xl border-[#46464D]/40 p-5 sm:p-6 flex flex-col gap-5 shadow-lg transition-all"
            :class="activeEditingSection === 'posters' ? 'border-2 border-dashed border-[#D0D4F7]/60 bg-[#D0D4F7]/2' : ''">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-Sora font-medium text-white">PROMOTIONAL MATERIALS</h1>
                <span class="text-[11px] font-mono text-gray-400">Max 4</span>
              </div>

              <div v-if="isOwner" class="flex items-center gap-1.5">
                <button v-if="activeEditingSection !== 'posters'" @click="startPortfolioEditing('posters')"
                  class="flex hover:flex p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Edit Promotional Posters">
                  <Icon name="ic:outline-edit" class="text-lg text-[#D0D4F7]" />
                </button>
                <template v-else>
                  <button @click="handleSaveActiveSection" :disabled="isPortfolioSaving"
                    class="flex p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Save Changes">
                    <Icon v-if="isPortfolioSaving" name="ic:baseline-sync" class="animate-spin text-xl" />
                    <Icon v-else name="ic:round-check" class="text-xl" />
                  </button>
                  <button @click="handleCancelEditing" :disabled="isPortfolioSaving"
                    class="flex p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Discard Changes">
                    <Icon name="ic:round-close" class="text-xl" />
                  </button>
                </template>
              </div>
            </div>

            <!-- Editing Mode: 4 Poster Slots (Posters or Upload Dropzones) -->
            <div v-if="activeEditingSection === 'posters'" class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <!-- Render existing draft posters -->
              <div v-for="(poster, idx) in draftPosters" :key="poster.id || idx"
                class="relative group aspect-3/4 w-full rounded-xl overflow-hidden border-2 border-dashed border-[#D0D4F7] shadow-lg bg-[#1A1A1E]">
                <img :src="poster.fileUrl" :alt="poster.title || 'Poster'" class="w-full h-full object-cover" />
                <div class="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                  <button @click="openEditPoster(idx)"
                    class="w-7 h-7 rounded-full bg-[#1A1A1E]/90 border border-[#D0D4F7]/60 text-[#D0D4F7] flex items-center justify-center hover:bg-[#282832] transition-colors cursor-pointer shadow-lg"
                    title="Edit Poster">
                    <Icon name="ic:outline-edit" class="text-sm" />
                  </button>
                  <button @click="removeDraftPoster(idx)"
                    class="w-7 h-7 rounded-full bg-red-950/90 border border-red-700 text-red-300 flex items-center justify-center hover:bg-red-800 transition-colors cursor-pointer shadow-lg"
                    title="Remove Poster">
                    <Icon name="ic:round-delete-outline" class="text-sm" />
                  </button>
                </div>
                <div v-if="poster.title"
                  class="absolute bottom-0 inset-x-0 bg-black/70 p-2 text-center text-xs font-semibold text-white truncate">
                  {{ poster.title }}
                </div>
              </div>

              <!-- Render upload dropzone slots for remaining spaces up to 4 -->
              <div v-for="emptySlot in Math.max(0, 4 - draftPosters.length)" :key="`slot_${emptySlot}`"
                @click="openAddPoster"
                class="bg-[#646464]/20 hover:bg-[#646464]/30 rounded-xl aspect-3/4 w-full flex flex-col items-center justify-center border-[#D0D4F7]/60 hover:border-[#D0D4F7] border-dashed border-2 cursor-pointer transition-all gap-1.5 group">
                <Icon name="ic:baseline-plus"
                  class="text-3xl text-[#D0D4F7] group-hover:scale-110 transition-transform" />
                <span class="text-xs font-medium text-gray-300">Upload Poster</span>
              </div>
            </div>

            <!-- Live Mode: Saved Posters -->
            <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <template v-if="posterItems.length > 0">
                <div v-for="poster in posterItems" :key="poster.id"
                  class="relative aspect-3/4 w-full rounded-xl overflow-hidden border border-[#46464D]/40 shadow-lg bg-[#1A1A1E] group">
                  <img :src="poster.fileUrl" :alt="poster.title || 'Poster'"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div v-if="poster.title"
                    class="absolute bottom-0 inset-x-0 bg-black/75 p-2 text-center text-xs font-medium text-white truncate">
                    {{ poster.title }}
                  </div>
                </div>

                <!-- Empty place slots to maintain 4 grid slots -->
                <div v-for="emptySlot in Math.max(0, 4 - posterItems.length)" :key="`live_empty_${emptySlot}`"
                  class="bg-[#1C1C1F]/40 rounded-xl aspect-3/4 w-full flex items-center justify-center border border-[#46464D]/20">
                  <span class="text-xs text-gray-600 font-mono">Available Slot</span>
                </div>
              </template>

              <!-- Sample Placeholders (if none saved yet) -->
              <template v-else>
                <div
                  class="bg-[#646464] rounded-xl aspect-3/4 w-full flex items-center justify-center border-[#b4b4b4] border-2">
                </div>
                <div
                  class="bg-[#646464] rounded-xl aspect-3/4 w-full flex items-center justify-center border-[#b4b4b4] border-2">
                </div>
                <div
                  class="bg-[#646464] rounded-xl aspect-3/4 w-full flex items-center justify-center border-[#b4b4b4] border-2">
                </div>
                <div
                  class="bg-[#646464] rounded-xl aspect-3/4 w-full flex items-center justify-center border-[#b4b4b4] border-2">
                </div>
              </template>
            </div>
          </div>

        </div>

        <!-- Contact Tab Content Container -->
        <div v-else-if="activeTab === 'contact'" class="w-full">
          <!-- Add Contact content here -->
          <div
            class="w-full min-h-100 border border-[#46464D]/40 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-[#131315]/50">
            <div
              class="w-14 h-14 rounded-full bg-[#1E1E24] border border-[#46464D]/50 flex items-center justify-center mb-4">
              <Icon name="ic:outline-alternate-email" class="text-2xl text-[#D0D4F7]" />
            </div>
            <h3 class="font-Sora text-lg font-semibold text-white mb-2">Contact & Inquiries</h3>
            <p class="text-sm text-gray-400 max-w-md">Booking contacts, management details, and social links will appear
              here.</p>
          </div>
        </div>

        <!-- Gigs Tab Content Container (Profile Only Shows Confirmed "Your Gigs") -->
        <div v-else-if="activeTab === 'gigs'" class="w-full space-y-8">

          <!-- PENDING OFFERS ALERT BANNER (Triggers Form 2 Artist Approval) -->
          <div
            v-if="pendingOffers.length > 0"
            class="p-5 rounded-2xl bg-amber-950/25 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in font-Sora"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Icon name="ic:baseline-assignment-late" class="text-2xl text-amber-400 animate-pulse" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-white">
                  You have {{ pendingOffers.length }} Booking Contract {{ pendingOffers.length === 1 ? 'Offer' : 'Offers' }} Pending!
                </h4>
                <p class="text-xs text-amber-300/80">
                  Review terms, customize your song lineup, and confirm your performance agreement.
                </p>
              </div>
            </div>

            <button
              type="button"
              @click="openForm2Modal(pendingOffers[0])"
              class="px-5 py-2.5 rounded-full text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto shadow-md"
            >
              Review Form 2 Contract
            </button>
          </div>

          <!-- Sub-Section Switcher: All, Confirmed Gigs, Contracts & Proposals -->
          <div class="flex items-center gap-2 border-b border-[#2A2A2E] pb-3">
            <button
              type="button"
              @click="gigsSubTab = 'all'"
              class="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              :class="gigsSubTab === 'all' ? 'bg-[#D0D4F7] text-[#131315]' : 'bg-[#1C1C1F] text-gray-400 hover:text-white border border-[#2A2A2E]'">
              All
            </button>
            <button
              type="button"
              @click="gigsSubTab = 'gigs'"
              class="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              :class="gigsSubTab === 'gigs' ? 'bg-[#D0D4F7] text-[#131315]' : 'bg-[#1C1C1F] text-gray-400 hover:text-white border border-[#2A2A2E]'">
              <span>Your Gigs</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono" :class="gigsSubTab === 'gigs' ? 'bg-[#131315]/20 text-[#131315]' : 'bg-[#2A2A2E] text-gray-300'">
                {{ yourEvents.length }}
              </span>
            </button>
            <button
              type="button"
              @click="gigsSubTab = 'contracts'"
              class="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              :class="gigsSubTab === 'contracts' ? 'bg-[#D0D4F7] text-[#131315]' : 'bg-[#1C1C1F] text-gray-400 hover:text-white border border-[#2A2A2E]'">
              <span>Booking Contracts</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono" :class="gigsSubTab === 'contracts' ? 'bg-[#131315]/20 text-[#131315]' : 'bg-[#2A2A2E] text-gray-300'">
                {{ allArtistContracts.length }}
              </span>
              <span v-if="pendingOffers.length" class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-black animate-pulse">
                {{ pendingOffers.length }} Action Required
              </span>
            </button>
          </div>

          <!-- ================================================================= -->
          <!-- SECTION: "YOUR GIGS" (Deduplicated Job Listings vs Contracts)     -->
          <!-- ================================================================= -->
          <section v-if="gigsSubTab === 'all' || gigsSubTab === 'gigs'" class="space-y-4 font-Sora">
            <div class="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
              <div>
                <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Your Gigs</h2>
                <p class="text-xs text-gray-400 mt-0.5">
                  Confirmed gigs from accepted job listings and direct client bookings.
                </p>
              </div>
              <span class="text-xs font-mono text-[#D0D4F7] px-2.5 py-1 rounded-full bg-[#1C1C1F] border border-[#2A2A2E]">
                {{ yourEvents.length }} {{ yourEvents.length === 1 ? 'gig' : 'gigs' }}
              </span>
            </div>

            <div v-if="eventsLoading" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
              <div v-for="i in 2" :key="i" class="h-36 bg-[#1C1C1F] rounded-2xl border border-[#2A2A2E]"></div>
            </div>

            <div v-else-if="yourEvents.length === 0" class="text-center py-12 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-2">
              <Icon name="ic:outline-event-busy" class="text-3xl text-gray-500 mx-auto" />
              <p class="text-sm font-semibold text-white">No Confirmed Gigs Yet</p>
              <p class="text-xs text-gray-400">Audition for casting calls on the Events page or accept direct booking requests to fill your calendar.</p>
            </div>

            <!-- Deduplicated Gig Cards Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div
                v-for="event in yourEvents"
                :key="event.Booking_ID"
                class="bg-[#1C1C1F]/80 border border-[#2A2A2E] hover:border-[#46464D] rounded-2xl p-5 sm:p-6 space-y-3 transition-all shadow-lg"
              >
                <!-- DEDUPLICATION LOGIC: If event has Job_ID, show Job Listing Card. Else show Contract Card -->
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <span class="text-[10px] font-mono uppercase tracking-wider text-[#D0D4F7]">
                      {{ event.Job_ID ? 'JOB LISTING GIG' : 'DIRECT BOOKING CONTRACT' }}
                    </span>
                    <h3 class="text-base sm:text-lg font-bold text-white mt-0.5">
                      {{ event.Job_ID ? event.JOB_LISTING?.Event_Title : 'Direct Booking Performance' }}
                    </h3>
                  </div>

                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Confirmed
                  </span>
                </div>

                <!-- Necessary Details Only -->
                <div class="space-y-1.5 text-xs text-gray-300">
                  <div class="flex items-center gap-2">
                    <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                    <span>
                      {{ event.Start_Date || event.Event_Date }}
                      <span v-if="event.End_Date && event.End_Date !== event.Start_Date"> to {{ event.End_Date }}</span>
                      <span v-if="event.Start_Time"> • {{ formatTimeRange12(event.Start_Time, event.End_Time) }}</span>
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                    <span class="truncate">{{ event.Job_ID ? (event.JOB_LISTING?.Location || event.Venue_Location) : event.Venue_Location }}</span>
                  </div>

                  <div v-if="!event.Job_ID && event.USER_ACCOUNT?.Username" class="flex items-center gap-2 text-gray-400">
                    <Icon name="ic:baseline-person" class="text-[#D0D4F7] text-sm shrink-0" />
                    <span>Booked by: {{ event.USER_ACCOUNT.Username }}</span>
                  </div>
                  <div v-else-if="event.BUSINESS_PROFILE?.Business_Name" class="flex items-center gap-2 text-gray-400">
                    <Icon name="ic:baseline-storefront" class="text-[#D0D4F7] text-sm shrink-0" />
                    <span>Host: {{ event.BUSINESS_PROFILE.Business_Name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ================================================================= -->
          <!-- SECTION 2: "CONTRACTS & DIRECT BOOKING OFFERS"                    -->
          <!-- ================================================================= -->
          <section v-if="gigsSubTab === 'all' || gigsSubTab === 'contracts'" class="space-y-5 font-Sora pt-4 border-t border-[#2A2A2E]">
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Booking Contracts</h2>
                  <span v-if="pendingOffers.length" class="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {{ pendingOffers.length }} Action Required
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">
                  Direct bookings from clients, incoming proposals, and contracts from accepted gig listings.
                </p>
              </div>

              <!-- Filter Tabs -->
              <div class="flex items-center gap-1.5 bg-[#141416] p-1 rounded-xl border border-[#2A2A2E] self-start sm:self-auto">
                <button
                  type="button"
                  @click="contractFilter = 'all'"
                  class="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
                  :class="contractFilter === 'all' ? 'bg-[#D0D4F7] text-[#131315] font-semibold' : 'text-gray-400 hover:text-white'">
                  All ({{ allArtistContracts.length }})
                </button>
                <button
                  type="button"
                  @click="contractFilter = 'pending'"
                  class="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1"
                  :class="contractFilter === 'pending' ? 'bg-amber-400 text-[#131315] font-semibold' : 'text-amber-300 hover:text-amber-200'">
                  <span>Pending</span>
                  <span v-if="pendingOffers.length" class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                </button>
                <button
                  type="button"
                  @click="contractFilter = 'confirmed'"
                  class="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
                  :class="contractFilter === 'confirmed' ? 'bg-[#D0D4F7] text-[#131315] font-semibold' : 'text-gray-400 hover:text-white'">
                  Confirmed
                </button>
                <button
                  type="button"
                  @click="contractFilter = 'cancelled'"
                  class="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
                  :class="contractFilter === 'cancelled' ? 'bg-[#D0D4F7] text-[#131315] font-semibold' : 'text-gray-400 hover:text-white'">
                  Past
                </button>
              </div>
            </div>

            <!-- Empty Contracts State -->
            <div v-if="filteredContracts.length === 0" class="text-center py-12 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-2">
              <Icon name="ic:outline-description" class="text-3xl text-gray-500 mx-auto" />
              <p class="text-sm font-semibold text-white">No Contracts Found</p>
              <p class="text-xs text-gray-400">When clients book you directly or accept your job applications, contract offers appear here.</p>
            </div>

            <!-- Contracts Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div
                v-for="contract in filteredContracts"
                :key="contract.Booking_ID"
                class="bg-[#1C1C1F]/80 border rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg flex flex-col justify-between transition-all"
                :class="['Pending_Artist_Approval', 'Pending', 'Draft'].includes(contract.Status)
                  ? 'border-amber-500/40 bg-amber-950/10 hover:border-amber-400'
                  : 'border-[#2A2A2E] hover:border-[#46464D]'">
                
                <div class="space-y-3">
                  <!-- Header: Code, Origin Pill & Status Badge -->
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span
                          class="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold"
                          :class="!contract.Job_ID
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : 'bg-[#d0d4f6]/10 text-[#d0d4f6] border border-[#d0d4f6]/30'">
                          {{ !contract.Job_ID ? 'Direct Client Booking' : 'Job Listing Contract' }}
                        </span>
                        <span v-if="contract.Is_Rush_Booking" class="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
                          <Icon name="ic:baseline-bolt" class="text-xs" />
                          <span>Rush</span>
                        </span>
                      </div>
                      <h3 class="text-base font-bold text-white mt-1">
                        {{ contract.Contract_Code || contract.Booking_ID }}
                      </h3>
                    </div>

                    <span
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold"
                      :class="['Pending_Artist_Approval', 'Pending', 'Draft'].includes(contract.Status)
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                        : (['Confirmed', 'Active'].includes(contract.Status)
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-gray-500/15 text-gray-400 border border-gray-500/30')">
                      {{ ['Pending_Artist_Approval', 'Pending', 'Draft'].includes(contract.Status) ? 'Action Required' : contract.Status }}
                    </span>
                  </div>

                  <!-- Client / Business Host Details -->
                  <div class="flex items-center gap-3 p-3 rounded-xl bg-[#141416] border border-[#2A2A2E]">
                    <div class="w-9 h-9 rounded-full bg-[#1E1E24] overflow-hidden border border-[#46464D]/50 shrink-0 flex items-center justify-center">
                      <img
                        v-if="contract.USER_ACCOUNT?.Profile_Picture"
                        :src="contract.USER_ACCOUNT.Profile_Picture"
                        :alt="contract.USER_ACCOUNT.Username"
                        class="w-full h-full object-cover" />
                      <Icon v-else name="ic:baseline-person" class="text-lg text-[#D0D4F7]" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="text-sm font-semibold text-white truncate">
                        {{ contract.BUSINESS_PROFILE?.Business_Name || contract.USER_ACCOUNT?.Username || 'Client Requester' }}
                      </h4>
                      <span class="text-[11px] text-gray-400 font-mono">
                        {{ contract.BUSINESS_PROFILE?.Business_Name ? 'Business Host' : 'Direct Client' }}
                      </span>
                    </div>
                    <div v-if="contract.Agreed_Fee" class="text-right shrink-0 font-mono">
                      <span class="text-xs text-emerald-400 font-bold">₱{{ Number(contract.Agreed_Fee).toLocaleString() }}</span>
                    </div>
                  </div>

                  <!-- Schedule & Venue Details -->
                  <div class="space-y-1.5 text-xs text-gray-300">
                    <div class="flex items-center gap-2">
                      <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                      <span>{{ contract.Start_Date || contract.Event_Date }} <span v-if="contract.Start_Time">• {{ formatTimeRange12(contract.Start_Time, contract.End_Time) }}</span></span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                      <span class="truncate">{{ contract.Venue_Location }}</span>
                    </div>
                  </div>
                </div>

                <!-- Action CTA -->
                <div class="pt-3 border-t border-[#2A2A2E] flex items-center justify-between">
                  <span class="text-[11px] text-gray-500 font-mono">
                    {{ ['Pending_Artist_Approval', 'Pending', 'Draft'].includes(contract.Status) ? 'Awaiting your setlist & signature' : 'Agreement confirmed' }}
                  </span>

                  <button
                    type="button"
                    @click="openForm2Modal(contract)"
                    class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    :class="['Pending_Artist_Approval', 'Pending', 'Draft'].includes(contract.Status)
                      ? 'bg-amber-400 hover:bg-amber-300 text-black'
                      : 'bg-[#1E1E24] hover:bg-[#D0D4F7] text-gray-200 hover:text-[#131315] border border-[#3A3A3C]'">
                    <Icon :name="['Pending_Artist_Approval', 'Pending', 'Draft'].includes(contract.Status) ? 'ic:baseline-edit-note' : 'ic:outline-visibility'" class="text-base" />
                    <span>{{ ['Pending_Artist_Approval', 'Pending', 'Draft'].includes(contract.Status) ? 'Review & Sign (Form 2)' : 'View Agreement' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

        </div>

        <!-- Members Tab Content (Only for Band artists) -->
        <div v-else-if="activeTab === 'members'" class="w-full space-y-8 font-Sora">
          <!-- Floating Status Toast -->
          <div
            v-if="removeSuccessToast"
            class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#1E1E24] border border-[#D0D4F7]/60 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            <Icon name="lucide:check-circle" class="text-emerald-400 text-lg shrink-0" />
            <span class="text-xs sm:text-sm font-medium">{{ removeSuccessToast }}</span>
          </div>

          <!-- SECTION 1: Band Recruitment & Invite Header -->
          <section class="bg-[#18181B] border border-[#46464D]/40 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
            <!-- Background glow accent -->
            <div class="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[#D0D4F7]/5 blur-3xl pointer-events-none"></div>

            <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div class="max-w-2xl space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-mono uppercase tracking-wider text-[#D0D4F7] bg-[#D0D4F7]/10 px-2.5 py-0.5 rounded-full border border-[#D0D4F7]/20">
                    Band Recruitment
                  </span>
                  <span class="text-xs text-gray-400 font-Geist">Active Lineup</span>
                </div>
                <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Recruit & Manage Band Members
                </h3>
                <p class="text-xs sm:text-sm text-gray-300 font-Geist leading-relaxed">
                  Search all verified solo artists across TONO to join your band. Assign their designated instrument or vocal role, review active members, and track invitation statuses.
                </p>

                <!-- Quick Roster Counters -->
                <div class="flex flex-wrap items-center gap-3 pt-2">
                  <div class="px-3 py-1.5 rounded-xl bg-[#141416] border border-[#46464D]/30 flex items-center gap-2">
                    <span class="text-xs text-gray-400 font-Geist">Total:</span>
                    <span class="text-sm font-bold text-white font-mono">{{ bandMembers.length }}</span>
                  </div>
                  <div class="px-3 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 flex items-center gap-2 text-emerald-400">
                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span class="text-xs font-Geist">Active:</span>
                    <span class="text-sm font-bold font-mono">{{ activeMembersCount }}</span>
                  </div>
                  <div v-if="pendingBandMembersCount > 0" class="px-3 py-1.5 rounded-xl bg-amber-950/30 border border-amber-500/20 flex items-center gap-2 text-amber-400">
                    <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span class="text-xs font-Geist">Invited:</span>
                    <span class="text-sm font-bold font-mono">{{ pendingBandMembersCount }}</span>
                  </div>
                </div>
              </div>

              <!-- Primary Action: Invite Member Button -->
              <div class="shrink-0">
                <button
                  type="button"
                  @click="isInviteModalOpen = true"
                  class="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] font-bold text-sm transition-all duration-200 shadow-lg hover:shadow-[#D0D4F7]/20 hover:scale-[1.02] cursor-pointer group"
                >
                  <Icon name="lucide:user-plus" class="text-lg group-hover:scale-110 transition-transform" />
                  <span>Invite Member</span>
                </button>
              </div>
            </div>
          </section>

          <!-- SECTION 2: Complete Lineup & Members Roster -->
          <section class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-lg font-bold text-white tracking-wide">Current Lineup & Invitations</h4>
                <p class="text-xs text-gray-400 font-Geist">All active performers and outgoing invitations</p>
              </div>
              <button
                v-if="bandMembers.length > 0"
                @click="fetchBandMembers(artistId, true)"
                class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#D0D4F7] transition-colors p-1"
                title="Refresh members"
              >
                <Icon name="lucide:refresh-cw" class="text-sm" :class="{ 'animate-spin': isBandMembersLoading }" />
                <span class="hidden sm:inline">Refresh</span>
              </button>
            </div>

            <!-- Loading Skeleton -->
            <div v-if="isBandMembersLoading && bandMembers.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="i in 3" :key="i" class="h-44 rounded-2xl bg-[#18181B] animate-pulse border border-[#46464D]/20"></div>
            </div>

            <!-- Empty State -->
            <div
              v-else-if="bandMembers.length === 0"
              class="flex flex-col items-center justify-center p-12 sm:p-16 border border-[#46464D]/40 border-dashed rounded-2xl bg-[#161619] text-center"
            >
              <div class="w-16 h-16 rounded-full bg-[#1F1F24] border border-white/10 flex items-center justify-center text-[#D0D4F7] mb-4">
                <Icon name="lucide:users" class="text-3xl" />
              </div>
              <h5 class="text-base font-bold text-white mb-1">No Band Members Yet</h5>
              <p class="text-xs sm:text-sm text-gray-400 font-Geist max-w-md leading-relaxed">
                Your band roster is currently empty. Recruit verified solo artists on TONO to complete your lineup for gigs and contracts.
              </p>
            </div>

            <!-- Member Cards Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div
                v-for="member in bandMembers"
                :key="member.memberId"
                class="bg-[#18181B] border border-[#46464D]/40 hover:border-[#D0D4F7]/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-md"
              >
                <!-- Card Top Info -->
                <div class="space-y-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <!-- Avatar with status indicator ring -->
                      <div class="relative shrink-0">
                        <img
                          v-if="member.profilePicture"
                          :src="member.profilePicture"
                          :alt="member.artistName"
                          class="w-12 h-12 rounded-full object-cover ring-2"
                          :class="member.status === 'Accepted' ? 'ring-emerald-500/40' : 'ring-amber-500/40'"
                        />
                        <div
                          v-else
                          class="w-12 h-12 rounded-full bg-[#2A2A30] text-gray-200 flex items-center justify-center font-bold text-base uppercase ring-2"
                          :class="member.status === 'Accepted' ? 'ring-emerald-500/40' : 'ring-amber-500/40'"
                        >
                          {{ member.artistName.charAt(0) }}
                        </div>
                        <span
                          class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#18181B]"
                          :class="member.status === 'Accepted' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'"
                          :title="member.status === 'Accepted' ? 'Active' : 'Invited'"
                        ></span>
                      </div>

                      <div class="min-w-0">
                        <h5 class="text-sm sm:text-base font-bold text-white truncate group-hover:text-[#D0D4F7] transition-colors">
                          {{ member.artistName }}
                        </h5>
                        <p class="text-xs text-gray-400 font-mono truncate">
                          @{{ member.username }}
                        </p>
                      </div>
                    </div>

                    <!-- Status Badge -->
                    <span
                      class="text-[11px] px-2.5 py-0.5 rounded-full font-medium shrink-0"
                      :class="member.status === 'Accepted'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'"
                    >
                      {{ member.status === 'Accepted' ? 'Active' : 'Invited' }}
                    </span>
                  </div>

                  <!-- Role Display (Artist Name below it Role, normalized) -->
                  <div class="pt-1">
                    <span class="text-[11px] text-gray-400 font-Geist block mb-1">Role in Band:</span>
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#D0D4F7]/10 border border-[#D0D4F7]/25 text-[#D0D4F7] font-medium text-xs font-Geist">
                      <Icon name="lucide:music" class="text-xs shrink-0" />
                      <span>{{ normalizeRole(member.instrumentRole) || 'Band Member' }}</span>
                    </div>
                  </div>

                  <!-- Dates & Details -->
                  <div class="text-[11px] text-gray-500 font-Geist space-y-0.5">
                    <p v-if="member.city" class="flex items-center gap-1 text-gray-400">
                      <Icon name="ic:baseline-location-on" class="text-xs text-[#D0D4F7]" />
                      <span>{{ member.city }}</span>
                    </p>
                    <p v-if="member.status === 'Accepted' && member.joinedAt">
                      Joined: {{ new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
                    </p>
                    <p v-else-if="member.invitedAt">
                      Invited: {{ new Date(member.invitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
                    </p>
                  </div>
                </div>

                <!-- Card Bottom Actions (Remove member or cancel invite) -->
                <div class="mt-4 pt-3 border-t border-[#46464D]/25 flex items-center justify-between">
                  <NuxtLink
                    :to="`/artist/${member.username}`"
                    class="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1 group/link"
                  >
                    <span>View Profile</span>
                    <Icon name="lucide:external-link" class="text-[11px] group-hover/link:translate-x-0.5 transition-transform" />
                  </NuxtLink>

                  <button
                    type="button"
                    @click="handleOpenRemoveConfirm(member)"
                    class="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 px-2.5 py-1 rounded-lg border border-red-500/20 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Icon name="lucide:trash-2" class="text-xs" />
                    <span>{{ member.status === 'Accepted' ? 'Remove' : 'Cancel Invite' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Member Removal Confirmation Dialog -->
          <div
            v-if="isRemoveConfirmOpen && memberToRemove"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            @click.self="isRemoveConfirmOpen = false"
          >
            <div class="w-full max-w-md bg-[#161619] border border-[#46464D]/60 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-red-950/50 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                  <Icon name="lucide:alert-triangle" class="text-xl" />
                </div>
                <div>
                  <h4 class="text-base font-bold text-white">
                    {{ memberToRemove.status === 'Accepted' ? 'Remove Band Member?' : 'Cancel Invitation?' }}
                  </h4>
                  <p class="text-xs text-gray-400 font-Geist">
                    {{ memberToRemove.status === 'Accepted'
                      ? `Are you sure you want to remove ${memberToRemove.artistName} from your band roster?`
                      : `Are you sure you want to revoke the pending invitation for ${memberToRemove.artistName}?` }}
                  </p>
                </div>
              </div>

              <div class="p-3 rounded-xl bg-[#1F1F24] border border-white/5 flex items-center gap-3">
                <img
                  v-if="memberToRemove.profilePicture"
                  :src="memberToRemove.profilePicture"
                  :alt="memberToRemove.artistName"
                  class="w-9 h-9 rounded-full object-cover shrink-0"
                />
                <div v-else class="w-9 h-9 rounded-full bg-[#2A2A30] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {{ memberToRemove.artistName.charAt(0) }}
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-white truncate">{{ memberToRemove.artistName }}</p>
                  <p class="text-[11px] text-[#D0D4F7] font-Geist">{{ normalizeRole(memberToRemove.instrumentRole) }}</p>
                </div>
              </div>

              <div class="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  @click="isRemoveConfirmOpen = false; memberToRemove = null"
                  class="px-4 py-2 rounded-xl border border-white/10 hover:border-white/30 text-gray-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Keep
                </button>
                <button
                  type="button"
                  :disabled="isBandActionLoading"
                  @click="handleConfirmRemoveMember"
                  class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md"
                >
                  <Icon v-if="isBandActionLoading" name="lucide:loader-2" class="animate-spin text-xs" />
                  <span>{{ memberToRemove.status === 'Accepted' ? 'Confirm Removal' : 'Confirm Cancellation' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Portfolio Modals -->
    <ArtistAddMediaModal
      :isOpen="isAddMediaOpen"
      :isEdit="editingMediaIndex !== null"
      :initialUrl="activeEditingMediaItem?.url || ''"
      :initialTitle="activeEditingMediaItem?.title || ''"
      :initialCaption="activeEditingMediaItem?.displayText || ''"
      @close="closeMediaModal"
      @save="onMediaModalSaved"
    />

    <ArtistAddAudioModal
      :isOpen="isAddAudioOpen"
      :isEdit="editingAudioIndex !== null"
      :initialUrl="activeEditingAudioItem?.url || ''"
      :initialTitle="activeEditingAudioItem?.title || ''"
      :initialDisplayText="activeEditingAudioItem?.displayText || ''"
      @close="closeAudioModal"
      @save="onAudioModalSaved"
    />

    <ArtistAddMilestoneModal
      :isOpen="isAddMilestoneOpen"
      :isEdit="editingMilestoneIndex !== null"
      :initialTitle="activeEditingMilestoneItem?.title || ''"
      :initialEventDate="activeEditingMilestoneItem?.eventDate || ''"
      :initialDescription="activeEditingMilestoneItem?.description || ''"
      :initialFileUrl="activeEditingMilestoneItem?.fileUrl || ''"
      :uploadFn="uploadPortfolioImage"
      @close="closeMilestoneModal"
      @save="onMilestoneModalSaved"
    />

    <ArtistAddPosterModal
      :isOpen="isAddPosterOpen"
      :isEdit="editingPosterIndex !== null"
      :initialTitle="activeEditingPosterItem?.title || ''"
      :initialFileUrl="activeEditingPosterItem?.fileUrl || ''"
      :uploadFn="uploadPortfolioImage"
      @close="closePosterModal"
      @save="onPosterModalSaved"
    />

    <!-- Artist Form 2 Contract Modal -->
    <ArtistContractModal
      :is-open="isForm2ModalOpen"
      :contract="selectedContractForForm2"
      @close="isForm2ModalOpen = false"
      @accepted="fetchArtistEvents"
      @rejected="fetchArtistEvents"
    />

    <!-- Artist Create Post Modal -->
    <ArtistCreatePostModal
      :is-open="isCreatePostOpen"
      :artist-id="artistId"
      :artist-name="artistName"
      :artist-avatar="profilePicture"
      @close="isCreatePostOpen = false"
      @created="handlePostCreated"
    />

    <!-- Artist Edit Post Modal -->
    <ArtistEditPostModal
      :is-open="isEditPostOpen"
      :post="postToEdit"
      :artist-id="artistId"
      :artist-name="artistName"
      :artist-avatar="profilePicture"
      @close="isEditPostOpen = false; postToEdit = null"
      @updated="handlePostUpdated"
    />

    <!-- Post Detail Modal Component -->
    <PostDetailModal
      :is-open="isPostModalOpen"
      :post="selectedPost"
      :artist-name="artistName"
      :artist-avatar="profilePicture"
      @close="closePostModal"
    />

    <!-- Band Invite Member Modal Component -->
    <BandInviteMemberModal
      :is-open="isInviteModalOpen"
      :band-id="artistId"
      :current-members="bandMembers"
      @close="isInviteModalOpen = false"
      @invited="handleMemberInvited"
    />

  </div>
</template>