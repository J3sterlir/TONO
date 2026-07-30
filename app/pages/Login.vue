<script setup lang="ts">
import { ref } from 'vue'

const showPassword = ref(false)
</script>

<template>
  <div class="flex flex-row h-screen">
    <div class="basis-[40%] flex justify-center items-center bg-[#131315] w-screen">
      <div class="text-white w-[65%] flex flex-col gap-2">
        <button class="text-white cursor-pointer text-start w-fit hover:text-[#B0B4D7]" @click="navigateTo('/')">&larr;
          Back</button>
        <div class="flex items-center gap-1 mt-6.5 mb-3">
          <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
          <h1>TONO</h1>
        </div>

        <div class="mb-11">
          <p class="font-bold text-4xl">Welcome Back!</p>
          <p class="font-light">Login to continue to TONO</p>
        </div>

        <p class="font-light">EMAIL OR USERNAME</p>
        <div class="relative">
          <Icon name="ic:outline-person" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
          <input type="text" placeholder="Enter your email or username"
            class="w-full pl-12 p-3 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
        </div>
        <div class="flex justify-between items-center mt-2">
          <p class="font-light">PASSWORD</p>
          <p class="text-[#D0D4F7] cursor-pointer">Forgot Password?</p>
        </div>
        <div class="relative">
          <Icon name="ic:outline-lock" class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />

          <input :type="showPassword ? 'text' : 'password'" placeholder="Enter your password"
            class="w-full pl-12 pr-12 p-3 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />

          <button type="button" class="flex absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7A7D]"
            @click="showPassword = !showPassword">
            <Icon class="text-2xl" :name="showPassword ? 'ic:outline-visibility-off' : 'ic:outline-visibility'" />
          </button>
        </div>
        <div class="flex items-center justify-center">
          <button
            class="bg-[#D0D4F7] text-[#151A34] w-full p-2.5 px-4 rounded-full mt-4 hover:bg-[#B0B4D7] cursor-pointer">Login</button>
        </div>
        <p class="mt-4 text-center text-[13px]">Don't have an account? <span class="text-[#D0D4F7] cursor-pointer"
            @click="navigateTo('/Signin')">Sign Up</span></p>
      </div>
    </div>

    <div
      class="basis-[60%] flex justify-center items-center w-screen bg-blend-multiply bg-cover bg-center bg-[linear-gradient(0deg,rgba(18,18,20,0.95)_0%,rgba(93,93,94,0)_51%,rgba(255,255,255,0.1)_100%),url(https://images.unsplash.com/photo-1761474926416-ba16c9b39ea0)]">
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