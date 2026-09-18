// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ['motion-v/nuxt', "@nuxt/icon", "@nuxtjs/supabase"],
  supabase: {
    redirect: false,
    types: '~~/types/supabase.ts'
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
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Stack+Sans+Headline:wght@200..700&family=Sora:wght@100..800&family=Geist:wght@100..900&family=Hanken+Grotesk:wght@100..900&display=swap'
        }
      ]
    }
  }
});