import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  globals: true,
  environment: 'jsdom',
  test: {
    setupFiles: ['./test/setup.ts']
  }
})
