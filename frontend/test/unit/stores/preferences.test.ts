import { setActivePinia, createPinia } from 'pinia'
import piniaPersist from 'pinia-plugin-persistedstate'
import { usePreferencesStore } from '~/stores/preferences'

// Setup localStorage mock
const localStorageStore: Record<string, string> = {}
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageStore[key] || null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value },
    removeItem: (key: string) => { delete localStorageStore[key] },
    clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]) },
    length: 0,
    key: () => null
  },
  writable: true
})

describe('preferences store', () => {
  beforeEach(() => {
    localStorageStore['preferences'] = JSON.stringify({ currency: 'USD', darkMode: false })
    const pinia = createPinia()
    pinia.use(piniaPersist)
    setActivePinia(pinia)
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

  it('should persist currency to localStorage', () => {
    const store = usePreferencesStore()
    store.setCurrency('EUR')
    const stored = JSON.parse(localStorage.getItem('preferences') || '{}')
    expect(stored.currency).toBe('EUR')
  })
})
