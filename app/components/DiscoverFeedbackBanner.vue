<script setup lang="ts">
// Discover Feedback Banner: Prominently displayed at the bottom of Discover feeds
</script>

<template>
  <section class="w-full max-w-7xl mx-auto px-4 sm:px-8 md:px-16 mt-12 mb-8 font-Geist">
    <div
      class="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#18181B] via-[#1C1C20] to-[#131315] border border-[#2A2A2E] p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
    >
      <!-- Background Ambient Glow -->
      <div class="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-[#D0D4F7]/10 blur-3xl pointer-events-none"></div>

      <!-- Left: Message & Brand Pitch -->
      <div class="flex flex-col gap-2 max-w-xl text-center md:text-left z-10">
        <div class="flex items-center justify-center md:justify-start gap-2 text-xs font-semibold uppercase tracking-wider text-[#D0D4F7]">
          <Icon name="ic:baseline-bug-report" class="text-base" />
          <span>Platform Feedback & Improvements</span>
        </div>
        <h3 class="text-xl sm:text-2xl font-bold font-Sora text-white">
          Help Us Fine-Tune TONO
        </h3>
        <p class="text-xs sm:text-sm text-[#8E8B94] leading-relaxed">
          Found an issue while exploring local talent, or have an idea to make live performances and booking better?
          Your feedback goes directly to our development team.
        </p>
      </div>

      <!-- Right: Action Buttons (No emojis, strictly specified Iconify icons) -->
      <div class="flex flex-col sm:flex-row items-center gap-3 z-10 shrink-0 w-full sm:w-auto">
        <NuxtLink
          to="/feedback?tab=bug"
          class="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#1E1E24] hover:bg-[#282830] border border-[#3A3A40] hover:border-[#D0D4F7]/60 text-xs sm:text-sm font-semibold text-gray-200 hover:text-white transition-all shadow-md group"
        >
          <Icon name="ic:baseline-bug-report" class="text-lg text-rose-400 group-hover:scale-110 transition-transform" />
          <span>Report a Bug</span>
        </NuxtLink>

        <NuxtLink
          to="/feedback?tab=feedback"
          class="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs sm:text-sm font-semibold transition-all shadow-md group"
        >
          <Icon name="ic:baseline-lightbulb" class="text-lg text-[#0E0E10] group-hover:scale-110 transition-transform" />
          <span>General Feedback</span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
