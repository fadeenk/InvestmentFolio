import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const activeModal = ref<string | null>(null)
  const banner = ref<{ type: 'success' | 'error'; message: string } | null>(null)

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function openModal(modal: string) {
    activeModal.value = modal
  }

  function closeModal() {
    activeModal.value = null
  }

  function setBanner(type: 'success' | 'error', message: string) {
    banner.value = { type, message }
  }

  function clearBanner() {
    banner.value = null
  }

  return {
    sidebarOpen,
    activeModal,
    banner,
    toggleSidebar,
    openModal,
    closeModal,
    setBanner,
    clearBanner,
  }
})
