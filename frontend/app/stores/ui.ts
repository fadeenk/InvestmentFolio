import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DateFormat } from '~/types/enums'
import { useVaultStore } from '~/stores/vault.store'

type BannerType = 'success' | 'warning' | 'error'

export const useUiStore = defineStore('ui', () => {
  const vaultStore = useVaultStore()

  const sidebarOpen = ref(false)
  const activeModal = ref<string | null>(null)
  const banner = ref<{ type: BannerType; message: string } | null>(null)

  const dateFormat = computed(() => vaultStore.displayPreferences?.dateFormat ?? DateFormat.MM_DD_YYYY)

  function formatDate(value: string): string {
    if (!value) return ''

    let year: number
    let month: number
    let day: number

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split('-').map(Number)
      year = parts[0]!
      month = parts[1]!
      day = parts[2]!
    } else {
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return value
      year = parsed.getFullYear()
      month = parsed.getMonth() + 1
      day = parsed.getDate()
    }

    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')

    switch (dateFormat.value) {
      case DateFormat.DD_MM_YYYY:
        return `${dd}/${mm}/${year}`
      case DateFormat.YYYY_MM_DD:
        return `${year}-${mm}-${dd}`
      case DateFormat.MM_DD_YYYY:
      default:
        return `${mm}/${dd}/${year}`
    }
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function openModal(modal: string) {
    activeModal.value = modal
  }

  function closeModal() {
    activeModal.value = null
  }

  function setBanner(type: BannerType, message: string) {
    banner.value = { type, message }
  }

  function clearBanner() {
    banner.value = null
  }

  return {
    sidebarOpen,
    activeModal,
    banner,
    dateFormat,
    toggleSidebar,
    openModal,
    closeModal,
    setBanner,
    clearBanner,
    formatDate,
  }
})
