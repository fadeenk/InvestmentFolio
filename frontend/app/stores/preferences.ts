import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePreferencesStore = defineStore(
  'preferences',
  () => {
    const currency = ref<'USD' | 'EUR' | 'GBP'>('USD')

    function setCurrency(newCurrency: 'USD' | 'EUR' | 'GBP') {
      currency.value = newCurrency
    }

    return { currency, setCurrency }
  },
  {
    persist: true,
  },
)
