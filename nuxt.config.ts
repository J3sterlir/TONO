// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ['motion-v/nuxt', "@nuxt/icon"],
  icon: {
    serverBundle: {
      collections: ['ic']
    },
  },
  css: ['../app/assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
});