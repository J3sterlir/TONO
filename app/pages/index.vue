<script setup lang="ts">
import { motion } from 'motion-v'
const features = [
    {
        title: 'Discover Local Talent',
        description: 'Browse featured artists, venues, and emerging sounds from your city in one place.',
        accent: 'md:col-span-2',
    },
    {
        title: 'Book with Confidence',
        description: 'Streamline bookings, share availability, and manage requests without endless back-and-forth.',
        accent: '',
    },
    {
        title: 'Grow Your Audience',
        description: 'Promote your performances and connect with fans who are actively looking for live music.',
        accent: '',
    },
    {
        title: 'Stay in Sync',
        description: 'Keep event details, schedules, and communication organized for smooth collaboration.',
        accent: 'md:col-span-2',
    },
]
</script>

<template>
    <title>TONO</title>
    <div
        class="bg-cover bg-center bg-blend-multiply h-screen bg-[radial-gradient(circle,rgba(255,255,255,0.09)_5%,rgba(18,18,20,1)_71%),radial-gradient(circle,rgba(255,255,255,0.09)_5%,rgba(18,18,20,1)_71%),linear-gradient(0deg,rgba(18,18,20,0.95)_0%,rgba(93,93,94,0)_51%,rgba(255,255,255,0.1)_100%),url('https://images.unsplash.com/photo-1604514288114-3851479df2f2')]">
        <nav class="flex bg-[#121214]/80 p-5 items-center justify-between backdrop-blur-[30px] sticky top-0 z-50">
            <button class="flex items-center gap-2 cursor-pointer" @click="navigateTo('/')">
                <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
                <h1 class="font-StackSansHeadline font-bold text-[1.5rem] text-white">TONO</h1>
            </button>
            <div class="flex justify-between gap-10">
                <button class="text-white font-semibold cursor-pointer hover:text-[#b4b8da]">Features</button>
                <button class="text-white font-semibold cursor-pointer hover:text-[#b4b8da]">About</button>
                <button class="text-white font-semibold cursor-pointer hover:text-[#b4b8da]">Contact</button>
            </div>
            <button
                class="bg-[#b4b8da] p-2 px-4 text-[#121214] cursor-pointer font-bold rounded-full hover:bg-[#b4b8da]/80 hover:text-white"
                @click="navigateTo('/Login')">Login</button>
        </nav>
        <div class="relative flex flex-col gap-10 items-center justify-center h-[calc(100vh-80px)]">
            <motion.div class="relative flex flex-col gap-10 items-center justify-center"
                :initial="{ opacity: 0, scale: 0 }" :animate="{ opacity: 1, scale: 1 }" :transition="{
                    duration: 0.10,
                    scale: { type: 'spring', visualDuration: 0.2, bounce: 0.1 }
                }" style="will-change: transform, opacity;">
                <h1 class="font-StackSansHeadline text-white font-bold text-[6rem] text-center">LOCAL MUSICIANS <br>
                    <mark class="bg-[#b4b8da]/25 text-[#e5e7ff] backdrop-blur-xs">BEST FRIEND</mark>
                </h1>
                <h1
                    class="font-StackSansHeadline text-white font-bold text-[6rem] text-center blur-xl opacity-75 absolute animate-pulse">
                    LOCAL MUSICIANS <br> BEST FRIEND</h1>
            </motion.div>

            <motion.div class="flex items-center justify-center gap-10" :initial="{ opacity: 0, y: 24 }"
                :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.5, ease: 'easeOut', delay: 0.15 }">
                <button @click="navigateTo('/Signin')"
                    class="bg-[#b4b8da] p-2 px-4 text-[#121214] font-bold rounded-full cursor-pointer hover:bg-[#b4b8da]/80 hover:text-white">
                    Sign In
                </button>

                <button
                    class="bg-[#121214]/80 p-2 px-4 text-[#b4b8da] font-bold rounded-full cursor-pointer border border-[#b4b8da]/50 hover:bg-[#b4b8da]/50 hover:text-white">
                    Learn More
                </button>
            </motion.div>
        </div>
        <div
            class="bg-cover bg-center min-h-screen bg-[radial-gradient(circle,rgba(18,18,20,0)_33%,rgba(0,0,0,1)_100%),linear-gradient(180deg,rgba(0,0,0,1)_0%,rgba(180,184,218,1)_70%,rgba(18,18,20,1)_100%)]">
            <div class="flex flex-col items-center justify-center px-6 py-20 lg:py-24">
                <div class="mb-10 text-center">
                    <p class="mb-3 text-sm uppercase tracking-[0.35em] text-[#b4b8da]">Why TONO</p>
                    <h1 class="font-StackSansHeadline text-white font-bold text-[2.5rem] md:text-[3rem]">Features</h1>
                </div>

                <div class="grid w-full max-w-6xl gap-6 md:grid-cols-2">
                    <motion.article v-for="(feature, index) in features" :key="feature.title"
                        :initial="{ opacity: 0, y: 40 }" :whileInView="{ opacity: 1, y: 0 }"
                        :viewport="{ once: true, amount: 0.35 }"
                        :transition="{ duration: 0.7, ease: 'easeOut', delay: index * 0.12 }" :class="[
                            'group relative overflow-hidden rounded-2xl border border-white/15 bg-[#121214]/70 p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#b4b8da]/50',
                            feature.accent,
                        ]">
                        <div
                            class="absolute inset-0 bg-linear-to-br from-white/10 to-transparent opacity-0 transition duration-300 group-hover:opacity-100">
                        </div>
                        <div class="relative">
                            <div
                                class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#b4b8da]/20 text-sm font-semibold text-[#b4b8da]">
                                {{ index + 1 }}
                            </div>
                            <h2 class="text-2xl font-semibold">{{ feature.title }}</h2>
                            <p class="mt-3 text-sm leading-7 text-slate-300">{{ feature.description }}</p>
                        </div>
                    </motion.article>
                </div>
            </div>
        </div>
    </div>
</template>