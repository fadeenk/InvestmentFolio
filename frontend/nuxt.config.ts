// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@vueuse/nuxt', '@pinia/nuxt', '@pinia-plugin-persistedstate/nuxt'],

  components: [{ path: '~/components', pathPrefix: false }],

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],
  colorMode: {
    classSuffix: '',
  },

  routeRules: {
    '/': { prerender: true },
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: false,
    },
  },
  vite: {
    optimizeDeps: {
      include: ['@unovis/vue', '@vue/devtools-core', '@vue/devtools-kit'],
    },
  },
})
