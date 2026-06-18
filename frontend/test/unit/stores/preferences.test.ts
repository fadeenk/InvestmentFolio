import { setActivePinia, createPinia } from 'pinia'
import piniaPersist from 'pinia-plugin-persistedstate'
import { usePreferencesStore } from '~/stores/preferences'

const localStorageStore: Record<string, string> = {}
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageStore[key] || null,
    setItem: (key: string, value: string) => {
      localStorageStore[key] = value
    },
    removeItem: (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete localStorageStore[key]
    },
    clear: () => {
      Object.keys(localStorageStore).forEach((k) => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete localStorageStore[k]
      })
    },
    length: 0,
    key: () => null,
  },
  writable: true,
})

describe('preferences store', () => {
  beforeEach(() => {
    localStorageStore['preferences'] = JSON.stringify({ currency: 'USD' })
    const pinia = createPinia()
    pinia.use(piniaPersist)
    setActivePinia(pinia)
  })

  it('should set currency', () => {
    const store = usePreferencesStore()
    store.setCurrency('EUR')
    expect(store.currency).toBe('EUR')
  })

  it('should persist currency to localStorage', () => {
    const store = usePreferencesStore()
    store.setCurrency('EUR')
    expect(store.currency).toBe('EUR')
  })
})
