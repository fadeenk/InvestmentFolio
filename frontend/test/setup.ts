// Test setup file
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
