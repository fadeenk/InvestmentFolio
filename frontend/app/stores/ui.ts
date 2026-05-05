import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const activeModal = ref<string | null>(null)

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function openModal(modal: string) {
    activeModal.value = modal
  }

  function closeModal() {
    activeModal.value = null
  }

  return { sidebarOpen, activeModal, toggleSidebar, openModal, closeModal }
})