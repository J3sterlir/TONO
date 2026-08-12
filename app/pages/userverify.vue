<template>
    <div class="flex h-screen bg-[#121214] justify-center items-center">
        <div class="bg-[#1C1C1F]/60 flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-[#2A2A2E]/50 w-88">
            <div class="flex items-center gap-1 mt-1 mb-3">
                <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
                <h1 class="text-white">TONO</h1>
            </div>
            <h1 class="text-white text-sm font-bold">Your account has been created</h1>

            <p class="text-white text-sm font-light pt-4">Please check your email to verify your account.</p>

            <button @click="navigateTo('/Login')"
                class="bg-[#D0D4F7] text-[#151A34] w-full p-2.5 px-4 rounded-full mt-5 hover:bg-[#B0B4D7] cursor-pointer">Go to
                Login</button>
        </div>
    </div>
</template>