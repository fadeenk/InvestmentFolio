// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@vueuse/nuxt', '@pinia/nuxt', '@pinia-plugin-persistedstate/nuxt', '@vite-pwa/nuxt'],

  components: [{ path: '~/components', pathPrefix: false }],

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
    pageTransition: {
      name: 'page',
      mode: 'out-in',
    },
  },

  colorMode: {
    classSuffix: '',
  },

  routeRules: {
    '/': { prerender: true },
  },

  pwa: {
    registerType: 'prompt',
    manifest: {
      name: 'iFolio',
      short_name: 'iFolio',
      description: 'Private portfolio tracker — all data encrypted at rest',
      theme_color: '#059669',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackAllowlist: [/./],
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/worker\.mrkannah\.workers\.dev\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'market-data',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24,
            },
          },
        },
      ],
    },
  },

  compatibilityDate: '2025-01-15',

  runtimeConfig: {
    public: {
      workerUrl: 'https://worker.mrkannah.workers.dev',
    },
  },

  eslint: {
    config: {
      stylistic: false,
    },
  },
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit'],
    },
  },
})
