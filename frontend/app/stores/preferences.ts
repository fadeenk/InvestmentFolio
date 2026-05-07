import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePreferencesStore = defineStore('preferences', () => {
  const currency = ref<'USD' | 'EUR' | 'GBP'>('USD')
  const darkMode = ref(false)

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
  }

  function setCurrency(newCurrency: 'USD' | 'EUR' | 'GBP') {
    currency.value = newCurrency
  }

  return { currency, darkMode, toggleDarkMode, setCurrency }
}, {
  persist: {
    storage: process.client ? localStorage : null
  }
})
