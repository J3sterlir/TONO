<script setup lang="ts">
import { ref } from 'vue'
import { motion } from 'motion-v'

const isMobileMenuOpen = ref(false)

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

const scrollTo = (id: string) => {
    isMobileMenuOpen.value = false
    const el = document.getElementById(id)
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
    }
}
</script>

<template>
    <title>TONO</title>
    <nav
        class="flex bg-[#121214]/80 px-4 sm:px-8 py-3.5 sm:py-4 items-center justify-between backdrop-blur-[30px] sticky top-0 z-50 border-b border-white/5">
        <!-- Brand / Logo -->
        <button class="flex items-center gap-2.5 cursor-pointer shrink-0" @click="navigateTo('/')">
            <img src="/TONO_LOGO.svg" alt="Logo" class="h-8 w-8 sm:h-10 sm:w-10 rounded-full" />
            <span class="font-StackSansHeadline font-bold text-xl sm:text-[1.5rem] text-white tracking-wide">TONO</span>
        </button>

        <!-- Desktop Nav Links -->
        <div class="hidden md:flex items-center justify-between gap-8 lg:gap-10">
            <button @click="scrollTo('features')"
                class="text-white font-semibold cursor-pointer hover:text-[#b4b8da] transition-colors">Features</button>
            <button @click="scrollTo('about')"
                class="text-white font-semibold cursor-pointer hover:text-[#b4b8da] transition-colors">About</button>
            <button @click="scrollTo('contact')"
                class="text-white font-semibold cursor-pointer hover:text-[#b4b8da] transition-colors">Contact</button>
        </div>

        <!-- Right Action / Mobile Toggle -->
        <div class="flex items-center gap-2 sm:gap-3">
            <button
                class="bg-[#b4b8da] py-2 px-4 sm:px-5 text-[#121214] cursor-pointer font-bold rounded-full hover:bg-[#b4b8da]/80 hover:text-white transition-all text-xs sm:text-[13px] shadow-md"
                @click="navigateTo('/Login')">
                Login
            </button>

            <!-- Mobile Hamburger Button -->
            <button @click="isMobileMenuOpen = !isMobileMenuOpen"
                class="md:hidden p-2 text-white hover:text-[#b4b8da] transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                aria-label="Toggle navigation menu">
                <Icon :name="isMobileMenuOpen ? 'ic:round-close' : 'ic:round-menu'" class="text-2xl" />
            </button>
        </div>
    </nav>
    <div class="min-h-screen w-full bg-[#0E0E10] text-white overflow-x-hidden">
        <!-- Hero & Nav Container -->


        <div
            class="bg-cover bg-center bg-blend-multiply min-h-screen flex flex-col bg-[radial-gradient(circle,rgba(255,255,255,0.09)_5%,rgba(18,18,20,1)_71%),radial-gradient(circle,rgba(255,255,255,0.09)_5%,rgba(18,18,20,1)_71%),linear-gradient(0deg,rgba(18,18,20,0.95)_0%,rgba(93,93,94,0)_51%,rgba(255,255,255,0.1)_100%),url('https://images.unsplash.com/photo-1604514288114-3851479df2f2')]">

            <!-- Sticky Navigation Bar -->


            <!-- Mobile Dropdown Menu -->
            <div v-if="isMobileMenuOpen"
                class="md:hidden bg-[#121214]/95 border-b border-white/10 backdrop-blur-2xl px-6 py-5 flex flex-col gap-4 sticky top-14.25 sm:top-16.2 z-40 animate-in fade-in slide-in-from-top-3 duration-200">
                <button @click="scrollTo('features')"
                    class="text-left py-2 text-white font-semibold hover:text-[#b4b8da] transition-colors border-b border-white/5 flex items-center justify-between cursor-pointer">
                    <span>Features</span>
                    <Icon name="ic:round-chevron-right" class="text-lg text-gray-400" />
                </button>
                <button @click="scrollTo('about')"
                    class="text-left py-2 text-white font-semibold hover:text-[#b4b8da] transition-colors border-b border-white/5 flex items-center justify-between cursor-pointer">
                    <span>About</span>
                    <Icon name="ic:round-chevron-right" class="text-lg text-gray-400" />
                </button>
                <button @click="scrollTo('contact')"
                    class="text-left py-2 text-white font-semibold hover:text-[#b4b8da] transition-colors border-b border-white/5 flex items-center justify-between cursor-pointer">
                    <span>Contact</span>
                    <Icon name="ic:round-chevron-right" class="text-lg text-gray-400" />
                </button>
                <div class="pt-2">
                    <button @click="navigateTo('/Signin')"
                        class="w-full text-center py-2.5 px-4 bg-[#b4b8da] text-[#121214] font-bold rounded-xl text-sm hover:bg-[#b4b8da]/80 transition-all cursor-pointer">
                        Sign In
                    </button>
                </div>
            </div>

            <!-- Hero Body -->
            <div
                class="relative flex-1 flex flex-col gap-8 sm:gap-10 items-center justify-center py-16 sm:py-24 px-4 text-center">
                <motion.div class="relative flex flex-col gap-6 sm:gap-10 items-center justify-center max-w-5xl"
                    :initial="{ opacity: 0, scale: 0 }" :animate="{ opacity: 1, scale: 1 }" :transition="{
                        duration: 0.10,
                        scale: { type: 'spring', visualDuration: 0.2, bounce: 0.1 }
                    }" style="will-change: transform, opacity;">
                    <h1
                        class="font-StackSansHeadline text-white font-bold text-3xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-[6rem] leading-tight tracking-tight">
                        LOCAL MUSICIANS <br>
                        <mark class="bg-[#b4b8da]/25 text-[#e5e7ff] px-2">BEST FRIEND</mark>
                    </h1>
                    <h1
                        class="font-StackSansHeadline text-white font-bold text-3xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-[6rem] leading-tight tracking-tight blur-xl opacity-75 absolute animate-pulse pointer-events-none">
                        LOCAL MUSICIANS <br> BEST FRIEND
                    </h1>
                </motion.div>

                <!-- Hero CTA Buttons -->
                <motion.div
                    class="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 w-full sm:w-auto px-4"
                    :initial="{ opacity: 0, y: 24 }" :animate="{ opacity: 1, y: 0 }"
                    :transition="{ duration: 0.5, ease: 'easeOut', delay: 0.15 }">
                    <button @click="navigateTo('/Signin')"
                        class="w-full sm:w-auto bg-[#b4b8da] py-2.5 px-6 sm:px-8 text-[#121214] font-bold rounded-full cursor-pointer hover:bg-[#b4b8da]/80 hover:text-white transition-all shadow-lg text-sm sm:text-base">
                        Sign In
                    </button>

                    <button @click="scrollTo('features')"
                        class="w-full sm:w-auto bg-[#121214]/80 py-2.5 px-6 sm:px-8 text-[#b4b8da] font-bold rounded-full cursor-pointer border border-[#b4b8da]/50 hover:bg-[#b4b8da]/20 hover:text-white transition-all text-sm sm:text-base">
                        Learn More
                    </button>
                </motion.div>
            </div>
        </div>

        <!-- Features Section with Anchor Point -->
        <section id="features"
            class="scroll-mt-16 sm:scroll-mt-20 bg-cover bg-center min-h-screen bg-[radial-gradient(circle,rgba(18,18,20,0)_33%,rgba(0,0,0,1)_100%),linear-gradient(180deg,rgba(0,0,0,1)_0%,rgba(180,184,218,1)_70%,rgba(18,18,20,1)_100%)]">
            <div
                class="flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-20 lg:py-24 max-w-7xl mx-auto">
                <div class="mb-8 sm:mb-12 text-center">
                    <p class="mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-[0.35em] text-[#b4b8da]">Why TONO</p>
                    <h2 class="font-StackSansHeadline text-white font-bold text-3xl sm:text-4xl md:text-[3rem]">Features
                    </h2>
                </div>

                <div class="grid w-full max-w-6xl gap-4 sm:gap-6 md:grid-cols-2">
                    <motion.article v-for="(feature, index) in features" :key="feature.title"
                        :initial="{ opacity: 0, y: 40 }" :whileInView="{ opacity: 1, y: 0 }"
                        :viewport="{ once: true, amount: 0.35 }"
                        :transition="{ duration: 0.7, ease: 'easeOut', delay: index * 0.12 }" :class="[
                            'group relative overflow-hidden rounded-2xl border border-white/15 bg-[#121214]/70 p-6 sm:p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#b4b8da]/50',
                            feature.accent,
                        ]">
                        <div
                            class="absolute inset-0 bg-linear-to-br from-white/10 to-transparent opacity-0 transition duration-300 group-hover:opacity-100 pointer-events-none">
                        </div>
                        <div class="relative">
                            <div
                                class="mb-4 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#b4b8da]/20 text-xs sm:text-sm font-semibold text-[#b4b8da]">
                                {{ index + 1 }}
                            </div>
                            <h3 class="text-xl sm:text-2xl font-semibold">{{ feature.title }}</h3>
                            <p class="mt-2 sm:mt-3 text-xs sm:text-sm leading-6 sm:leading-7 text-slate-300">{{
                                feature.description }}</p>
                        </div>
                    </motion.article>
                </div>
            </div>
        </section>

        <!-- About Section with Anchor Point -->
        <section id="about"
            class="scroll-mt-16 sm:scroll-mt-20 bg-[#0E0E10] border-t border-white/10 py-16 sm:py-20 lg:py-24 relative overflow-hidden">
            <!-- Ambient lighting overlay -->
            <div
                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-125 h-80 sm:h-125 bg-[#b4b8da]/5 rounded-full blur-3xl pointer-events-none">
            </div>

            <div class="relative max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
                <div class="mb-8 sm:mb-12 text-center">
                    <p class="mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-[0.35em] text-[#b4b8da]">Our Mission
                    </p>
                    <h2 class="font-StackSansHeadline text-white font-bold text-3xl sm:text-4xl md:text-[3rem]">About
                        TONO</h2>
                </div>

                <div class="grid w-full gap-4 sm:gap-6 md:grid-cols-2">
                    <article
                        class="rounded-2xl border border-white/15 bg-[#121214]/70 p-6 sm:p-8 backdrop-blur-xl shadow-lg transition duration-300 hover:border-[#b4b8da]/50">
                        <div
                            class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#b4b8da]/20 text-[#b4b8da]">
                            <Icon name="ic:outline-music-note" class="text-xl" />
                        </div>
                        <h3 class="text-xl sm:text-2xl font-semibold text-white mb-3">Rooted in Local Music</h3>
                        <p class="text-xs sm:text-sm leading-6 sm:leading-7 text-slate-300">
                            TONO was built by musicians, for musicians. We believe the lifeblood of music begins in
                            local rehearsal rooms, indie bars, and grassroots communities. Our platform bridges the gap
                            between independent artists, organizers, and music enthusiasts.
                        </p>
                    </article>

                    <article
                        class="rounded-2xl border border-white/15 bg-[#121214]/70 p-6 sm:p-8 backdrop-blur-xl shadow-lg transition duration-300 hover:border-[#b4b8da]/50">
                        <div
                            class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#b4b8da]/20 text-[#b4b8da]">
                            <Icon name="ic:outline-hub" class="text-xl" />
                        </div>
                        <h3 class="text-xl sm:text-2xl font-semibold text-white mb-3">Seamless Collaboration</h3>
                        <p class="text-xs sm:text-sm leading-6 sm:leading-7 text-slate-300">
                            Finding compatible bandmates, showcasing your portfolio, and discovering gigs shouldn’t take
                            endless back-and-forth. TONO provides the tools local musicians need to get discovered, stay
                            organized, and grow their craft.
                        </p>
                    </article>
                </div>
            </div>
        </section>

        <!-- Contact Section with Anchor Point -->
        <section id="contact"
            class="scroll-mt-16 sm:scroll-mt-20 bg-[#121214] border-t border-white/10 py-16 sm:py-20 lg:py-24 relative">
            <div class="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
                <div class="mb-8 sm:mb-12 text-center">
                    <p class="mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-[0.35em] text-[#b4b8da]">Get In Touch
                    </p>
                    <h2 class="font-StackSansHeadline text-white font-bold text-3xl sm:text-4xl md:text-[3rem]">Contact
                        Us</h2>
                </div>

                <div class="grid w-full max-w-4xl gap-4 sm:gap-6 sm:grid-cols-2">
                    <!-- General Inquiries -->
                    <div
                        class="rounded-2xl border border-white/15 bg-[#1E1E24]/60 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between">
                        <div>
                            <div
                                class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#b4b8da]/20 text-[#b4b8da]">
                                <Icon name="ic:outline-mail" class="text-xl" />
                            </div>
                            <h3 class="text-lg sm:text-xl font-semibold text-white mb-2">General & Support</h3>
                            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                                Have questions about your artist profile or need technical assistance? Our support team
                                is ready to help.
                            </p>
                        </div>
                        <a href="mailto:support@tono.music"
                            class="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#b4b8da] hover:text-white transition-colors">
                            <span>support@tono.music</span>
                            <Icon name="ic:round-arrow-forward" class="text-base" />
                        </a>
                    </div>

                    <!-- Partnerships & Venues -->
                    <div
                        class="rounded-2xl border border-white/15 bg-[#1E1E24]/60 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between">
                        <div>
                            <div
                                class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#b4b8da]/20 text-[#b4b8da]">
                                <Icon name="ic:outline-storefront" class="text-xl" />
                            </div>
                            <h3 class="text-lg sm:text-xl font-semibold text-white mb-2">Venues & Organizers</h3>
                            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                                Are you a local venue or festival organizer interested in listing events or finding
                                performers? Connect with us.
                            </p>
                        </div>
                        <a href="mailto:partners@tono.music"
                            class="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#b4b8da] hover:text-white transition-colors">
                            <span>partners@tono.music</span>
                            <Icon name="ic:round-arrow-forward" class="text-base" />
                        </a>
                    </div>
                </div>
            </div>
        </section>

        <!-- Footer -->
        <footer class="bg-[#0A0A0C] border-t border-white/5 py-8 px-4 sm:px-8">
            <div
                class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div class="flex items-center gap-2.5">
                    <img src="/TONO_LOGO.svg" alt="Logo" class="h-6 w-6 rounded-full" />
                    <span class="font-StackSansHeadline font-bold text-sm text-white">TONO</span>
                    <span class="text-xs text-gray-500">• Local Musicians Best Friend</span>
                </div>
                <p class="text-xs text-gray-500">
                    © 2026 TONO. All rights reserved.
                </p>
            </div>
        </footer>
    </div>
</template>