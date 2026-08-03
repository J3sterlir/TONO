<script setup lang="ts">
import { ref } from 'vue'

const showPassword = ref(false)
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

                <div class="mb-8 sm:mb-1">
                    <p class="font-bold text-2xl sm:text-3xl lg:text-4xl">Get Started!</p>
                    <p class="font-light">Create your TONO account and browse our catalog of artists</p>
                </div>
                <!--THIS FORM WILL BE HIDDEN WHEN BUTTON PRESSED CONTINUE-->
                <div id="step1" class="text-white w-full max-w-md flex flex-col gap-2">
                    <p class="font-light">EMAIL</p>
                    <div class="relative">
                        <Icon name="ic:baseline-mail-outline"
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
                        <input type="text" placeholder="Enter your email"
                            class="placeholder:text-sm w-full pl-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />
                    </div>
                    <p class="font-light">Username</p>
                    <div class="relative">
                        <Icon name="ic:outline-person"
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[#7A7A7D]" />
                        <input type="text" placeholder="Enter your username"
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
                            class="placeholder:text-sm w-full pl-12 pr-12 p-1.5 rounded-md bg-[#1E1E20] text-white border border-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#D0D4F7] focus:border-transparent" />

                        <button type="button" class="flex absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7A7D]"
                            @click="showPassword = !showPassword">
                            <Icon class="text-2xl"
                                :name="showPassword ? 'ic:outline-visibility-off' : 'ic:outline-visibility'" />
                        </button>
                    </div>
                    <div class="flex items-center justify-center">
                        <button
                            class="bg-[#D0D4F7] text-[#151A34] w-full p-2.5 px-4 rounded-full mt-3 sm:mt-4 hover:bg-[#B0B4D7] cursor-pointer">Continue</button>
                    </div>
                    <p class="mt-4 text-center text-[13px]">Already have an account? <span
                            class="text-[#D0D4F7] cursor-pointer" @click="navigateTo('/Login')">Log In</span></p>
                </div>
                <!--THIS FORM WILL BE HIDDEN WHEN BUTTON PRESSED CONTINUE-->
                <div id="step2" class="text-white flex flex-col hidden">
                    <div class="mt-4">
                        <p class="text-[17px] font-extralight">
                            Continue as...
                        </p>
                    </div>
                    <div class="flex flex-col gap-4 mt-2">
                        <div class="flex border-2 border-[#46464D]/30 bg-[#1B1B1D] rounded-lg px-5 py-5">
                            <input type="radio" name="user" value="Artist" id="artist-radio" class="mr-3 w-5">
                            <div class="ms-2 text-sm select-none">
                                <label for="artist-radio" class="font-medium text-heading mb-1 text-[18px]">Artist</label>
                                <p  id="helper-radio-text" class="text-[15px] font-light text-body">Performers, producers,
                                    and songwriters</p>
                            </div>
                        </div>
                        
                        <div class="flex border-2 border-[#46464D]/30 bg-[#1B1B1D] rounded-lg px-5 py-5">
                            <input type="radio" name="user" value="User" id="user-radio" class="mr-3 w-5">
                            <div class="ms-2 text-sm select-none">
                                <label for="user-radio" class="font-medium text-heading mb-1 text-[18px]">User</label>
                                <p id="helper-radio-text" class="text-[15px] font-light text-body">Music enthusiasts and Business Owners</p>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-between gap-2 mt-10">
                        <button class="bg-[#B4B8DA]/40 text-white p-2 w-[50%] rounded-lg">Previous</button>
                        <button class="bg-[#B4B8DA] text-[#444865] p-2 w-[50%] rounded-lg">Next</button>
                    </div>
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