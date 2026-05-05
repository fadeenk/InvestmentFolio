import { setActivePinia, createPinia } from 'pinia'
import { usePreferencesStore } from '~/stores/preferences'

describe('preferences store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should toggle dark mode', () => {
    const store = usePreferencesStore()
    expect(store.darkMode).toBe(false)
    store.toggleDarkMode()
    expect(store.darkMode).toBe(true)
  })

  it('should set currency', () => {
    const store = usePreferencesStore()
    store.setCurrency('EUR')
    expect(store.currency).toBe('EUR')
  })
})
