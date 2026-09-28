<script setup lang="ts">
definePageMeta({
  layout: 'business',
})
</script>

<template>
  <div class="h-full text-white flex flex-col min-h-full pb-16 overflow-x-hidden">
    <!-- Header Banner & Profile Info -->
    <div class="relative w-full overflow-hidden bg-[#131315] border-b border-[#46464D]/20">
      <!-- Background Banner Image -->
      <div class="absolute inset-0 z-0 bg-black">
        <img src="" alt="" class="w-full h-full object-cover opacity-70" />
        <!-- Soft gradient overlay for contrast on both mobile and desktop -->
        <div
          class="absolute inset-0 bg-linear-to-t from-[#0E0E10] via-[#0E0E10]/40 to-transparent md:bg-linear-to-r md:from-[#0E0E10]/90 md:via-[#0E0E10]/60 md:to-transparent"
        ></div>
      </div>

      <!-- Loaded Header Info -->
      <div
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6"
      >
        <!-- Left: Details -->
        <div class="flex flex-col items-center md:items-start text-center md:text-left gap-1.5 min-w-0 max-w-full">
          <p class="text-2xl sm:text-3xl font-semibold text-left text-[#e5e1e4]">
            Business Name
          </p>
          <p class="text-xs font-light text-left text-[#e5e1e4]">
            Business Service
          </p>
        </div>

        <!-- Right: Avatar -->
        <div class="flex flex-col justify-center items-center shrink-0">
          <div
            class="w-30 h-30 rounded-full bg-[url('profile-overlay.png')] bg-cover bg-no-repeat bg-center border-4 border-white shrink-0"
            style="box-shadow: 0px 8px 16px 0 rgba(0,0,0,0.25);"
          ></div>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Card 1: Active job listings -->
        <div
          class="flex flex-col justify-start items-start h-28 relative gap-3 p-5 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/20"
        >
          <div class="flex justify-between items-center self-stretch relative">
            <p class="text-[13px] font-medium text-left text-[#c7c5ce]">
              Active job listings
            </p>
            <div
              class="flex flex-col justify-center items-center h-8 w-8 relative rounded-lg bg-[#c4c6d2]/20"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4 relative"
                preserveAspectRatio="none"
              >
                <g clip-path="url(#clip0_757_23)">
                  <path
                    d="M10.6669 13.333V2.66634C10.6669 2.31272 10.5264 1.97358 10.2763 1.72353C10.0263 1.47348 9.68712 1.33301 9.33347 1.33301H6.66658C6.31293 1.33301 5.97377 1.47348 5.7237 1.72353C5.47363 1.97358 5.33314 2.31272 5.33314 2.66634V13.333M2.66626 3.99967H13.3338C14.0702 3.99967 14.6672 4.59663 14.6672 5.33301V11.9997C14.6672 12.7361 14.0702 13.333 13.3338 13.333H2.66626C1.92983 13.333 1.33282 12.7361 1.33282 11.9997V5.33301C1.33282 4.59663 1.92983 3.99967 2.66626 3.99967Z"
                    stroke="#C4C6D2"
                    stroke-width="2"
                    stroke-linecap="round"
                  ></path>
                </g>
                <defs>
                  <clipPath id="clip0_757_23">
                    <rect width="16" height="16" fill="white"></rect>
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
          <p class="text-[28px] font-bold text-left text-[#c4c6d2]">24</p>
        </div>

        <!-- Card 2: Job applications -->
        <div
          class="flex flex-col justify-start items-start h-28 relative gap-3 p-5 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/20"
        >
          <div class="flex justify-between items-center self-stretch relative">
            <p class="text-[13px] font-medium text-left text-[#c7c5ce]">
              Job applications
            </p>
            <div
              class="flex flex-col justify-center items-center h-8 w-8 relative rounded-lg bg-[#c4c6d2]/20"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4 relative"
                preserveAspectRatio="none"
              >
                <path
                  d="M9.33317 1.33301H4.00037C3.64679 1.33301 3.30768 1.4735 3.05766 1.72357C2.80764 1.97363 2.66718 2.3128 2.66718 2.66645V13.334C2.66718 13.6876 2.80764 14.0268 3.05766 14.2769C3.30768 14.5269 3.64679 14.6674 4.00037 14.6674H11.9996C12.3532 14.6674 12.6923 14.5269 12.9423 14.2769C13.1923 14.0268 13.3328 13.6876 13.3328 13.334V5.33333M9.33317 1.33301C9.54419 1.33267 9.75319 1.37408 9.94813 1.45487C10.1431 1.53565 10.3201 1.65421 10.4691 1.80371L12.8608 4.19591C13.0107 4.34492 13.1296 4.52216 13.2106 4.71739C13.2916 4.91261 13.3331 5.12196 13.3328 5.33333M9.33317 1.33301V4.66661C9.33317 4.84343 9.4034 5.01301 9.52842 5.13805C9.65343 5.26308 9.82298 5.33333 9.99977 5.33333L13.3328 5.33333M6.66677 6.00005H5.33357M10.6664 8.66693H5.33357M10.6664 11.3338H5.33357"
                  stroke="#C4C6D2"
                  stroke-width="2"
                  stroke-linecap="round"
                ></path>
              </svg>
            </div>
          </div>
          <p class="text-[28px] font-bold text-left text-[#c4c6d2]">18</p>
        </div>

        <!-- Card 3: Open contracts -->
        <div
          class="flex flex-col justify-start items-start h-28 relative gap-3 p-5 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/20"
        >
          <div class="flex justify-between items-center self-stretch relative">
            <p class="text-[13px] font-medium text-left text-[#c7c5ce]">
              Open contracts
            </p>
            <div
              class="flex flex-col justify-center items-center h-8 w-8 relative rounded-lg bg-[#c4c6d2]/20"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4 relative"
                preserveAspectRatio="none"
              >
                <path
                  d="M10.6664 2.66645H11.9996C12.3532 2.66645 12.6923 2.80693 12.9424 3.057C13.1924 3.30707 13.3328 3.64624 13.3328 3.99989V13.334C13.3328 13.6876 13.1924 14.0268 12.9424 14.2769C12.6923 14.5269 12.3532 14.6674 11.9996 14.6674H4.00044C3.64685 14.6674 3.30774 14.5269 3.05772 14.2769C2.8077 14.0268 2.66724 13.6876 2.66724 13.334V3.99989C2.66724 3.64624 2.8077 3.30707 3.05772 3.057C3.30774 2.80693 3.64685 2.66645 4.00044 2.66645H5.33364M6.00024 1.33301H9.99984C10.368 1.33301 10.6664 1.63151 10.6664 1.99973V3.33317C10.6664 3.70139 10.368 3.99989 9.99984 3.99989H6.00024C5.63208 3.99989 5.33364 3.70139 5.33364 3.33317V1.99973C5.33364 1.63151 5.63208 1.33301 6.00024 1.33301Z"
                  stroke="#C4C6D2"
                  stroke-width="2"
                  stroke-linecap="round"
                ></path>
              </svg>
            </div>
          </div>
          <p class="text-[28px] font-bold text-left text-[#c4c6d2]">7</p>
        </div>
      </div>
    </main>
  </div>
</template>