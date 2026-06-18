import { defineNuxtPlugin } from '#app'
import { useVaultStore } from '~/stores/vault.store'
import { Theme } from '~/types/enums'

export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    const colorMode = useColorMode()
    const vault = useVaultStore()

    watch(
      () => vault.displayPreferences?.theme,
      (theme) => {
        if (!theme) return
        if (theme === Theme.SYSTEM) {
          colorMode.preference = 'system'
        } else if (theme === Theme.LIGHT) {
          colorMode.preference = 'light'
        } else {
          colorMode.preference = 'dark'
        }
      },
      { immediate: true },
    )
  }
})
