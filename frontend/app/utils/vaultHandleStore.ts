const DB_NAME = 'iFolioVault'
const STORE_NAME = 'handles'
const HANDLE_KEY = 'currentHandle'
const LS_FILE_NAME = 'ifolio-last-vault-filename'
const LS_OPENED_AT = 'ifolio-last-vault-opened-at'

export interface VaultMeta {
  fileName: string
  lastOpenedAt: string | null
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY)
  localStorage.setItem(LS_FILE_NAME, handle.name)
  localStorage.setItem(LS_OPENED_AT, new Date().toISOString())
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await getDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY)
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function forgetHandle(): Promise<void> {
  try {
    const db = await getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY)
    localStorage.removeItem(LS_FILE_NAME)
    localStorage.removeItem(LS_OPENED_AT)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // swallow — best effort
  }
}

export function getLastFileName(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LS_FILE_NAME)
}

export function getLastOpenedAt(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LS_OPENED_AT)
}

export function getMeta(): VaultMeta | null {
  if (typeof localStorage === 'undefined') return null
  const fileName = localStorage.getItem(LS_FILE_NAME)
  if (!fileName) return null
  return {
    fileName,
    lastOpenedAt: localStorage.getItem(LS_OPENED_AT),
  }
}

export async function getHandleStatus(): Promise<'valid' | 'expired' | 'unavailable'> {
  if (!isAvailable()) return 'unavailable'
  const handle = await loadHandle()
  if (!handle) return 'unavailable'
  try {
    const permission = await handle.queryPermission({ mode: 'read' })
    if (permission === 'granted') return 'valid'
    return 'expired'
  } catch {
    return 'expired'
  }
}

export async function pickAndReRemember(): Promise<FileSystemFileHandle | null> {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'iFolio Vault',
          accept: { 'application/octet-stream': ['.iFolio'] },
        },
      ],
    })
    if (handle) {
      await saveHandle(handle)
    }
    return handle ?? null
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null
    throw err
  }
}

export function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && typeof window !== 'undefined' && 'showOpenFilePicker' in window
}
