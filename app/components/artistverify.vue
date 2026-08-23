<template>
    <div class="flex h-screen bg-[#121214] justify-center items-center text-white">
        <div class="bg-[#1C1C1F]/60 p-5 rounded-2xl border-2 border-[#2A2A2E]/50 w-88">
            <div class="flex items-center justify-center gap-1 mt-1 mb-3">
                <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
                <h1 class="text-white">TONO</h1>
            </div>
            <h1 class="text-white text-sm font-bold text-center">Your account has been created!</h1>

            <h1 class="text-left pt-4">Step 1:</h1>
            <p class="text-sm font-light pt-1">Please check your email to verify your account.</p>
            <h1 class="text-left pt-4">Step 2:</h1>
            <p class="text-sm font-light pt-3">Wait for the admin to verify your account.</p>

            <button @click="navigateTo('/Login')"
                class="bg-[#D0D4F7] text-[#151A34] w-full p-2.5 px-4 rounded-full mt-5 hover:bg-[#B0B4D7] cursor-pointer">Go to
                Login</button>
        </div>
    </div>
</template>