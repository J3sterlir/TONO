<script setup lang="ts">
import { ref } from 'vue'
import { motion } from 'motion-v'

const isMobileMenuOpen = ref(false)

const features = [
    {
        title: 'Discover Local Artists',
        description: 'Find indie musicians, listen to fresh original tracks, and explore the talent shaping your local music scene.',
        image: '/images/2491050467.jpg',
        actionText: 'Explore Artists',
        link: '/Community',
    },
    {
        title: 'Find Live Gigs',
        description: 'Stay up to date with live performances, discover venue open calls, and never miss a great show nearby.',
        image: '/images/9102450467.jpg',
        actionText: 'Discover Gigs',
        link: '/UserNavEvents',
    },
    {
        title: 'Connect & Share',
        description: 'Share performance clips, talk about favorite songs, and connect with fellow music lovers in your community.',
        image: '/images/4532702046791.jpg',
        actionText: 'Join Community',
        link: '/Community',
    },
    {
        title: 'Form Your Band',
        description: 'Looking to start a band or need a guest musician? Team up with compatible artists ready to make music.',
        image: '/images/3279102450467.jpg',
        actionText: 'Find Bandmates',
        link: '/Signin',
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
    <title>Welcome to TONO</title>
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
                class="flex flex-col px-4 sm:px-6 py-16 sm:py-20 lg:py-24 max-w-7xl mx-auto w-full">
                <!-- Section Header: Headline on Left, Action Pill Button on Right -->
                <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-14 w-full">
                    <div>
                        <p class="mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-[0.35em] text-[#b4b8da] font-medium font-Geist">Why TONO</p>
                        <h2 class="font-Sora text-white font-bold text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight leading-tight">
                            Built for local music,<br class="hidden sm:inline" />
                            made for real connections.
                        </h2>
                    </div>
                    <div class="shrink-0">
                        <button
                            @click="navigateTo('/Signin')"
                            class="inline-flex items-center gap-2.5 rounded-full bg-[#121214]/90 hover:bg-[#1b1b1d] border border-white/15 hover:border-[#b4b8da]/60 text-white hover:text-[#d0d4f7] px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold tracking-wide transition-all duration-300 hover:scale-105 shadow-lg cursor-pointer">
                            <span class="h-2 w-2 rounded-full bg-[#b4b8da]"></span>
                            <span>Join TONO</span>
                        </button>
                    </div>
                </div>

                <!-- 2-Column Expansive Feature Cards Layout -->
                <div class="grid w-full grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 xl:gap-12 items-stretch">
                    <motion.article v-for="(feature, index) in features" :key="feature.title"
                        :initial="{ opacity: 0, y: 30 }"
                        :whileInView="{ opacity: 1, y: 0 }"
                        :viewport="{ once: true, amount: 0.15 }"
                        :transition="{ duration: 0.6, ease: 'easeOut', delay: (index % 2) * 0.12 }"
                        class="group flex flex-col rounded-3xl border border-white/10 bg-[#121214]/80 p-6 sm:p-7 backdrop-blur-xl transition duration-300 hover:border-[#b4b8da]/40 hover:-translate-y-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                        <!-- Top Image Container with Expansive Aspect Ratio for Grain & Detail -->
                        <div
                            class="relative w-full aspect-16/10 overflow-hidden rounded-2xl border border-white/10 bg-[#18181b] shadow-lg mb-6">
                            <img
                                :src="feature.image"
                                :alt="feature.title"
                                class="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                            />
                            <div
                                class="absolute inset-0 bg-linear-to-t from-[#0e0e10]/60 via-transparent to-transparent pointer-events-none">
                            </div>
                        </div>

                        <!-- Card Content -->
                        <h3 class="font-Sora text-xl sm:text-2xl font-semibold text-white tracking-tight group-hover:text-[#d0d4f7] transition-colors mb-2.5">
                            {{ feature.title }}
                        </h3>
                        <p class="font-HankenGrotesk text-sm sm:text-base leading-relaxed text-[#c7c5ce] mb-6 flex-1">
                            {{ feature.description }}
                        </p>

                        <!-- Bottom Link with Dot -->
                        <div class="mt-auto pt-2">
                            <button
                                @click="navigateTo(feature.link)"
                                class="inline-flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-[#b4b8da] group-hover:text-white transition-colors cursor-pointer group/link">
                                <span class="h-2 w-2 rounded-full bg-[#b4b8da] group-hover/link:bg-[#d0d4f7] group-hover/link:scale-125 transition-all"></span>
                                <span class="tracking-wider uppercase font-Geist text-xs sm:text-[13px]">{{ feature.actionText }}</span>
                            </button>
                        </div>
                    </motion.article>
                </div>

                <!-- Section Photo Credit Attribution Badge -->
                <div class="mt-8 sm:mt-12 flex justify-end w-full">
                    <span
                        class="inline-block px-3.5 py-1.5 rounded-full bg-[#0e0e10]/85 backdrop-blur-md border border-white/15 text-[11px] sm:text-xs text-[#c7c5ce] font-Geist tracking-wider">
                        Photos By Jeremiah Lirag
                    </span>
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

                <div class="flex flex-col gap-16 sm:gap-24 lg:gap-32 w-full mt-4 sm:mt-6">
                    <!-- Section 1: Rooted in Local Music -->
                    <motion.article
                        :initial="{ opacity: 0, y: 30 }"
                        :whileInView="{ opacity: 1, y: 0 }"
                        :viewport="{ once: true, amount: 0.2 }"
                        :transition="{ duration: 0.7, ease: 'easeOut' }"
                        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-stretch w-full">
                        <!-- Left Column: Category Label & Large Display Headline -->
                        <div class="sm:col-span-2 lg:col-span-4 flex flex-col justify-between py-1 lg:py-3">
                            <div class="flex items-center gap-2 text-[#b4b8da]">
                                <Icon name="ic:outline-music-note" class="text-base" />
                                <span class="font-Geist text-xs uppercase tracking-[0.25em] font-medium">(ABOUT)</span>
                            </div>
                            <h3
                                class="font-Sora text-3xl sm:text-4xl lg:text-[2.25rem] xl:text-[2.65rem] font-bold text-white tracking-tight uppercase leading-[1.08] mt-6 lg:mt-0">
                                ROOTED IN<br />
                                <span class="font-normal italic text-[#d0d4f7]">LOCAL MUSIC.</span>
                            </h3>
                        </div>

                        <!-- Center Column: Editorial Portrait Image -->
                        <div class="sm:col-span-1 lg:col-span-4 flex flex-col justify-center">
                            <div
                                class="relative w-full aspect-4/5 sm:aspect-4/5 lg:aspect-3/4 overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b1d] shadow-2xl group">
                                <img
                                    src="/images/554698562.jpg"
                                    alt="Rooted in Local Music"
                                    class="w-full h-full object-cover object-center transition duration-700 ease-out group-hover:scale-105"
                                />
                                <div
                                    class="absolute inset-0 bg-linear-to-t from-[#0e0e10]/60 via-transparent to-transparent pointer-events-none">
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Narrative Copy & Pill CTA Button -->
                        <div
                            class="sm:col-span-1 lg:col-span-4 flex flex-col justify-center lg:justify-start gap-6 lg:gap-8 py-1 lg:py-3">
                            <div class="space-y-4 font-HankenGrotesk text-sm sm:text-base leading-relaxed text-[#c7c5ce]">
                                <p>
                                    TONO was built by musicians, for musicians. We believe the lifeblood of music begins in
                                    local rehearsal rooms, indie bars, and grassroots communities.
                                </p>
                                <p>
                                    Our platform bridges the gap between independent artists, organizers, and music enthusiasts.
                                </p>
                            </div>
                            <div>
                                <button
                                    @click="navigateTo('/Community')"
                                    class="inline-flex items-center justify-center rounded-full bg-[#b4b8da] hover:bg-[#d0d4f7] text-[#0e0e10] font-Sora font-bold text-xs uppercase tracking-widest px-7 py-3 transition duration-300 hover:scale-105 cursor-pointer">
                                    Learn More
                                </button>
                            </div>
                        </div>
                    </motion.article>

                    <!-- Subtle Section Divider -->
                    <div class="w-full h-px bg-linear-to-r from-transparent via-white/10 to-transparent"></div>

                    <!-- Section 2: Seamless Collaboration -->
                    <motion.article
                        :initial="{ opacity: 0, y: 30 }"
                        :whileInView="{ opacity: 1, y: 0 }"
                        :viewport="{ once: true, amount: 0.2 }"
                        :transition="{ duration: 0.7, ease: 'easeOut', delay: 0.15 }"
                        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-stretch w-full">
                        <!-- Left Column: Category Label & Large Display Headline -->
                        <div class="sm:col-span-2 lg:col-span-4 flex flex-col justify-between py-1 lg:py-3">
                            <div class="flex items-center gap-2 text-[#b4b8da]">
                                <Icon name="ic:outline-hub" class="text-base" />
                                <span class="font-Geist text-xs uppercase tracking-[0.25em] font-medium">(COLLABORATION)</span>
                            </div>
                            <h3
                                class="font-Sora text-3xl sm:text-4xl lg:text-[2.25rem] xl:text-[2.65rem] font-bold text-white tracking-tight uppercase leading-[1.08] mt-6 lg:mt-0">
                                SEAMLESS<br />
                                <span class="font-normal italic text-[#d0d4f7]">COLLABORATION.</span>
                            </h3>
                        </div>

                        <!-- Center Column: Editorial Portrait Image with Attribution -->
                        <div class="sm:col-span-1 lg:col-span-4 flex flex-col justify-center">
                            <div
                                class="relative w-full aspect-4/5 sm:aspect-4/5 lg:aspect-3/4 overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b1d] shadow-2xl group">
                                <img
                                    src="/images/1746024537245.jpg"
                                    alt="Seamless Collaboration"
                                    class="w-full h-full object-cover object-center transition duration-700 ease-out group-hover:scale-105"
                                />
                                <div
                                    class="absolute inset-0 bg-linear-to-t from-[#0e0e10]/70 via-transparent to-transparent pointer-events-none">
                                </div>
                                <!-- Photo Credit Attribution Badge -->
                                
                            </div>
                        </div>

                        <!-- Right Column: Narrative Copy & Pill CTA Button -->
                        <div
                            class="sm:col-span-1 lg:col-span-4 flex flex-col justify-center lg:justify-between gap-6 lg:gap-8 py-1 lg:py-3">
                            <div class="flex flex-col gap-6">
                                <div class="space-y-4 font-HankenGrotesk text-sm sm:text-base leading-relaxed text-[#c7c5ce]">
                                <p>
                                    Finding compatible bandmates, showcasing your portfolio, and discovering gigs shouldn’t take
                                    endless back-and-forth.
                                </p>
                                <p>
                                    TONO provides the tools local musicians need to get discovered, stay organized, and grow their craft.
                                </p>
                            </div>
                            <div>
                                <button
                                    @click="navigateTo('/Signin')"
                                    class="inline-flex items-center justify-center rounded-full bg-[#b4b8da] hover:bg-[#d0d4f7] text-[#0e0e10] font-Sora font-bold text-xs uppercase tracking-widest px-7 py-3 transition duration-300 hover:scale-105 cursor-pointer">
                                    Join TONO
                                </button>
                            </div>
                            </div>
                            <div>
                                <span
                                    class="inline-block px-3 py-1 rounded-full bg-[#0e0e10]/85 backdrop-blur-md border border-white/15 text-[10px] sm:text-[11px] text-[#c7c5ce] font-Geist tracking-wider">
                                    Photo By Dinno Franco Noora
                                </span>
                            </div>
                        </div>
                    </motion.article>
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

                <div class="grid w-full max-w-4xl gap-4 sm:gap-6 sm:grid-cols-1">
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
                        <a href="mailto:tono.support@protonmail.com"
                            class="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#b4b8da] hover:text-white transition-colors">
                            <span>tono.support@protonmail.com</span>
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