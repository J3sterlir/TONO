<script setup lang="ts">

definePageMeta({
  middleware: 'auth'
})


import { ref, onMounted, onUnmounted } from 'vue'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile } = useTonoAuth() 

// test button for create job listing

const { createJobListing } = useJobListings()

  const testCreateJob = async () => {
    try {
      const result = await createJobListing({
        Event_Title: 'Test Gig',
        Date: '2026-10-15',
        Time: '7:00 PM',
        Location: 'Naga City',
        Description: 'Test job listing'
      })

      console.log('JOB LISTING CREATED:', result)
      alert('Job listing created successfully!')
    } catch (error: any) {
      console.error('JOB LISTING ERROR:', error)
      alert(`Failed: ${error?.data?.statusMessage || error?.message || 'Unknown error'}`)
    }
  }

const artistsScrollRef = ref<HTMLElement | null>(null)
const discoverScrollRef = ref<HTMLElement | null>(null)
const servicesScrollRef = ref<HTMLElement | null>(null)

const scrollStates = ref({
  artists: { canScrollLeft: false, canScrollRight: false },
  discover: { canScrollLeft: false, canScrollRight: false },
  services: { canScrollLeft: false, canScrollRight: false }
})

const checkScroll = (element: HTMLElement | null, key: 'artists' | 'discover' | 'services') => {
  if (element) {
    const { scrollLeft, scrollWidth, clientWidth } = element
    scrollStates.value[key].canScrollLeft = scrollLeft > 0
    scrollStates.value[key].canScrollRight = Math.ceil(scrollLeft + clientWidth) < scrollWidth
  }
}

const scroll = (element: HTMLElement | null, direction: 'left' | 'right') => {
  if (element) {
    const scrollAmount = element.clientWidth * 0.75
    element.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
  }
}

const handleResize = () => {
  checkScroll(artistsScrollRef.value, 'artists')
  checkScroll(discoverScrollRef.value, 'discover')
  checkScroll(servicesScrollRef.value, 'services')
}

onMounted(() => {
  setTimeout(() => {
    checkScroll(artistsScrollRef.value, 'artists')
    checkScroll(discoverScrollRef.value, 'discover')
    checkScroll(servicesScrollRef.value, 'services')
  }, 100)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const artists = [
  { name: 'Elena R.', image: 'https://placehold.co/150x150/222/FFF?text=ER' },
  { name: 'Marcus J.', image: 'https://placehold.co/150x150/222/FFF?text=MJ' },
  { name: 'BOxin', image: 'https://placehold.co/150x150/222/FFF?text=BX' },
  { name: 'Aria V.', image: 'https://placehold.co/150x150/222/FFF?text=AV' },
  { name: 'Onyx', image: 'https://placehold.co/150x150/222/FFF?text=OX' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'Elena R.', image: 'https://placehold.co/150x150/222/FFF?text=ER' },
  { name: 'Marcus J.', image: 'https://placehold.co/150x150/222/FFF?text=MJ' },
  { name: 'BOxin', image: 'https://placehold.co/150x150/222/FFF?text=BX' },
  { name: 'Aria V.', image: 'https://placehold.co/150x150/222/FFF?text=AV' },
  { name: 'Onyx', image: 'https://placehold.co/150x150/222/FFF?text=OX' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
  { name: 'BeatBox', image: 'https://placehold.co/150x150/222/FFF?text=BB' },
]

const newartist = [
  { name: 'Luna Shift', genre: 'Neo-Classical', image: 'https://placehold.co/800x600/111/FFF?text=Luna+Shift' },
  { name: 'Cordova', genre: 'Alt-rock', image: 'https://placehold.co/800x600/331111/FFF?text=Cordova' },
  { name: 'DJ Vertex', genre: 'Electronic', image: 'https://placehold.co/800x600/111133/FFF?text=DJ+Vertex' },
  { name: 'Luna Shift', genre: 'Neo-Classical', image: 'https://placehold.co/800x600/111/FFF?text=Luna+Shift' },
  { name: 'Cordova', genre: 'Alt-rock', image: 'https://placehold.co/800x600/331111/FFF?text=Cordova' },
  { name: 'DJ Vertex', genre: 'Electronic', image: 'https://placehold.co/800x600/111133/FFF?text=DJ+Vertex' },
  { name: 'Luna Shift', genre: 'Neo-Classical', image: 'https://placehold.co/800x600/111/FFF?text=Luna+Shift' },
  { name: 'Cordova', genre: 'Alt-rock', image: 'https://placehold.co/800x600/331111/FFF?text=Cordova' },
  { name: 'DJ Vertex', genre: 'Electronic', image: 'https://placehold.co/800x600/111133/FFF?text=DJ+Vertex' },
]

const services = [
  { name: 'Tunes Studio', category: 'Music Studio', image: 'https://placehold.co/150x150/222/FFF?text=TS' },
  { name: 'Apollo Music Shop', category: 'Music Shop', image: 'https://placehold.co/150x150/222/FFF?text=AMS' },
  { name: 'Stephen Johnston', category: 'Luthier', image: 'https://placehold.co/150x150/222/FFF?text=SJ' },
  { name: 'CD Shop', category: 'Music Shop', image: 'https://placehold.co/150x150/222/FFF?text=CS' },
]

const handleLogout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/Login')
}
</script>

<template>
  // test button for create job listing
    <div class="p-10">
      <button
        @click="testCreateJob"
        class="mb-6 px-4 py-2 bg-[#D0D4F7] text-black rounded-lg font-semibold"
      >
        Test Create Job Listing
      </button>

      <div class="flex flex-col gap-10">
      </div>
    </div>  

  <div class="h-full bg-[#0E0E10] text-white flex flex-col">
    <nav
      class="flex items-center justify-between px-10 py-4 bg-[#131315]/80 sticky top-0 backdrop-blur-sm border-b border-[#46464D]/75 z-50">
      <div class="flex gap-5">
        <div class="flex items-center">
          <img src="/TONO_LOGO.svg" alt="Logo" class="h-8 w-8 rounded-full" />
          <h1 class="text-[1.5rem] ml-2 font-bold">TONO</h1>
        </div>

        <div class="w-fit flex items-center justify-center">
          <form action="/search" method="GET" class="relative group">
            <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
              <Icon name="ic:outline-search" class="absolute text-2xl text-[#C7C5CE]" />
            </div>

            <input type="search" name="q" placeholder="Search ..."
              class="w-fit py-2 pl-12 pr-5 bg-[#49494d] placeholder:text-[#C7C5CE] rounded-full" />
          </form>
        </div>

      </div>
      <div class="absolute left-1/2 -translate-x-1/2 flex text-white items-center gap-10">
        <button class="text-white hover:text-[#D0D4F7] cursor-pointer border-b-2 border-[#D0D4F7]">Discover</button>
        <button class="text-white hover:text-[#D0D4F7] cursor-pointer">Artists</button>
        <button class="text-white hover:text-[#D0D4F7] cursor-pointer">Events</button>
      </div>

      <div class="flex items-center gap-1">
        <Icon name="ic:baseline-notifications-none" class="text-2xl text-[#C7C5CE]" />
        <button @click="navigateTo('/userprofile')"
        class="flex items-center justify-center text-[#151A34] p-3 rounded-full font-semibold transition-colors cursor-pointer">
          <Icon name="ic:outline-account-circle" class="text-2xl text-[#C7C5CE]" />
        </button>
        
        <button 
        @click="handleLogout"
        class="flex items-center justify-center text-[#151A34] p-3 rounded-full font-semibold transition-colors cursor-pointer">
        <Icon name="ic:outline-vpn-key-off" class="text-2xl text-[#C7C5CE] hover:text-[#ff3c3c]" />
      </button>
      

      </div>
    </nav>

    <div class="p-10">
      <div class="flex flex-col gap-10">
        <h1 class="text-[1.5rem] relative z-10 pointer-events-none">Artist You May Like</h1>
        <div class="relative group -mt-6">
          <!-- Left Arrow -->
          <div v-show="scrollStates.artists.canScrollLeft"
            class="absolute left-0 top-0 bottom-0 w-32 z-20 flex items-center justify-start pl-2 bg-linear-to-r from-[#0E0E10] via-[#0E0E10]/80 to-transparent transition-opacity duration-300 pointer-events-none">
            <button @click="scroll(artistsScrollRef, 'left')"
              class="flex bg-[#131315]/80 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto opacity-0 group-hover:opacity-100 duration-300">
              <Icon name="ic:baseline-chevron-left" class="text-2xl" />
            </button>
          </div>

          <div ref="artistsScrollRef" @scroll="checkScroll(artistsScrollRef, 'artists')"
            class="flex overflow-x-auto gap-6 p-2 pt-8 scrollbar-hide scroll-smooth">
            <!-- Individual artist item -->
            <div v-for="artist in artists" :key="artist.name"
              class="flex flex-col items-center shrink-0 cursor-pointer transition-transform hover:scale-105">
              <!-- Circular Avatar -->
              <img :src="artist.image" :alt="artist.name" class="w-40 h-40 rounded-full object-cover shadow-md mb-3" />

              <!-- Artist Name -->
              <span class="text-gray-200 text-sm font-medium tracking-wide">
                {{ artist.name }}
              </span>
            </div>
          </div>

          <!-- Right Arrow -->
          <div v-show="scrollStates.artists.canScrollRight"
            class="absolute right-0 top-0 bottom-0 w-32 z-20 flex items-center justify-end pr-2 bg-linear-to-l from-[#0E0E10] via-[#0E0E10]/80 to-transparent transition-opacity duration-300 pointer-events-none">
            <button @click="scroll(artistsScrollRef, 'right')"
              class="flex bg-[#131315]/80 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto opacity-0 group-hover:opacity-100 duration-300">
              <Icon name="ic:baseline-chevron-right" class="text-2xl" />
            </button>
          </div>
        </div>

        <h1 class="text-[1.5rem] relative z-10 pointer-events-none">Discover New Artists</h1>
        <div class="relative group">
          <!-- Left Arrow -->
          <div v-show="scrollStates.discover.canScrollLeft"
            class="absolute left-0 top-0 bottom-0 w-64 z-20 flex items-center justify-start pl-2 bg-linear-to-r from-[#0E0E10] via-[#0E0E10]/80 to-transparent transition-opacity duration-300 pointer-events-none">
            <button @click="scroll(discoverScrollRef, 'left')"
              class="flex bg-[#131315]/80 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto opacity-0 group-hover:opacity-100 duration-300">
              <Icon name="ic:baseline-chevron-left" class="text-2xl" />
            </button>
          </div>

          <div ref="discoverScrollRef" @scroll="checkScroll(discoverScrollRef, 'discover')"
            class="flex h-75 gap-4 w-full overflow-x-auto scrollbar-hide scroll-smooth">
            <div v-for="(artist, index) in newartist" :key="artist.name" :class="[
              'group/card relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-500 ease-in-out flex-1 min-w-50 hover:min-w-100 hover:flex-[3_3_0%] border-2 border-transparent hover:border-[#D0D4F7] hover:z-10',
              index === newartist.length - 1 && newartist.length > 1 ? 'hover:-ml-50' : ''
            ]">
              <img :src="artist.image" :alt="artist.name"
                class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105" />

              <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent"></div>

              <div class="absolute inset-0 bg-black/40 transition-opacity duration-500 group-hover/card:bg-transparent">
              </div>

              <div class="absolute bottom-0 left-0 p-6 flex flex-col justify-end whitespace-nowrap">
                <h3 class="text-2xl font-semibold text-white tracking-tight">{{ artist.name }}</h3>
                <p class="text-sm font-medium text-gray-300 mt-1">{{ artist.genre }}</p>
              </div>
            </div>
          </div>

          <!-- Right Arrow -->
          <div v-show="scrollStates.discover.canScrollRight"
            class="absolute right-0 top-0 bottom-0 w-64 z-20 flex items-center justify-end pr-2 bg-linear-to-l from-[#0E0E10] via-[#0E0E10]/80 to-transparent transition-opacity duration-300 pointer-events-none">
            <button @click="scroll(discoverScrollRef, 'right')"
              class="flex bg-[#131315]/80 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto opacity-0 group-hover:opacity-100 duration-300">
              <Icon name="ic:baseline-chevron-right" class="text-2xl" />
            </button>
          </div>
        </div>

        <h1 class="text-[1.5rem] relative z-10 pointer-events-none">Local Music Industry</h1>
        <div class="relative group -mt-6">
          <!-- Left Arrow -->
          <div v-show="scrollStates.services.canScrollLeft"
            class="absolute left-0 top-0 bottom-0 w-32 z-20 flex items-center justify-start pl-2 bg-linear-to-r from-[#0E0E10] via-[#0E0E10]/80 to-transparent transition-opacity duration-300 pointer-events-none">
            <button @click="scroll(servicesScrollRef, 'left')"
              class="flex bg-[#131315]/80 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto opacity-0 group-hover:opacity-100 duration-300">
              <Icon name="ic:baseline-chevron-left" class="text-2xl" />
            </button>
          </div>

          <div ref="servicesScrollRef" @scroll="checkScroll(servicesScrollRef, 'services')"
            class="flex overflow-x-auto gap-6 p-2 pt-8 scrollbar-hide scroll-smooth">
            <!-- Individual artist item -->
            <div v-for="service in services" :key="service.name"
              class="flex flex-col items-center shrink-0 cursor-pointer transition-transform hover:scale-105">
              <!-- Circular Avatar -->
              <img :src="service.image" :alt="service.name"
                class="w-30 h-30 rounded-full object-cover shadow-md mb-3" />

              <!-- Artist Name -->
              <span class="text-gray-200 text-sm font-medium tracking-wide">
                {{ service.name }}
              </span>
            </div>
          </div>

          <!-- Right Arrow -->
          <div v-show="scrollStates.services.canScrollRight"
            class="absolute right-0 top-0 bottom-0 w-32 z-20 flex items-center justify-end pr-2 bg-linear-to-l from-[#0E0E10] via-[#0E0E10]/80 to-transparent transition-opacity duration-300 pointer-events-none">
            <button @click="scroll(servicesScrollRef, 'right')"
              class="flex bg-[#131315]/80 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto opacity-0 group-hover:opacity-100 duration-300">
              <Icon name="ic:baseline-chevron-right" class="text-2xl" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>