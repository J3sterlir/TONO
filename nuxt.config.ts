// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ['motion-v/nuxt', "@nuxt/icon", "@nuxtjs/supabase"],
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY,
    },
  },
  supabase: {
    redirect: false,
    url: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY,
  },
  icon: {
    serverBundle: {
      collections: ['ic']
    },
    clientBundle: {
      scan: true,
    },
  },
  css: ['../app/assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
});