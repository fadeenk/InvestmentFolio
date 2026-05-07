import { defineNuxtPlugin } from '#app'
import { usePreferencesStore } from '~/stores/preferences'

export default defineNuxtPlugin(() => {
  const preferences = usePreferencesStore()
  
  // Apply dark class on initial load with error handling for corrupted data
  // Only access localStorage on client-side
  if (process.client) {
    try {
      const stored = localStorage.getItem('preferences')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.darkMode !== undefined) {
          preferences.darkMode = parsed.darkMode
        }
      }
    } catch (e) {
      console.warn('Corrupted preferences data, resetting to defaults')
      localStorage.removeItem('preferences')
      // Reset manually since setup stores don't have $reset
      preferences.darkMode = false
      preferences.setCurrency('USD')
    }
  }

  useHead({
    htmlAttrs: {
      class: preferences.darkMode ? 'dark' : ''
    }
  })

  // Watch for changes and update reactively (client-side only)
  watch(() => preferences.darkMode, (isDark) => {
    if (import.meta.client) {
      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, { immediate: true })
})