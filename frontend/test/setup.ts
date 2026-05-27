// Test setup file
const localStorageStore: Record<string, string> = {}

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageStore[key] || null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value },
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    removeItem: (key: string) => { delete localStorageStore[key] },
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]) },
    length: 0,
    key: () => null
  },
  writable: true
})
