import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '~/stores/ui'

describe('ui store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should toggle sidebar', () => {
    const store = useUiStore()
    expect(store.sidebarOpen).toBe(false)
    store.toggleSidebar()
    expect(store.sidebarOpen).toBe(true)
  })

  it('should open and close modal', () => {
    const store = useUiStore()
    store.openModal('settings')
    expect(store.activeModal).toBe('settings')
    store.closeModal()
    expect(store.activeModal).toBeNull()
  })

  it('should set and clear banner', () => {
    const store = useUiStore()
    store.setBanner('success', 'Connected')
    expect(store.banner).toEqual({ type: 'success', message: 'Connected' })

    store.clearBanner()
    expect(store.banner).toBeNull()
  })
})
