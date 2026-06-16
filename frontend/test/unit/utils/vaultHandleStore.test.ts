import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as sut from '~/utils/vaultHandleStore'

describe('vaultHandleStore', () => {
  let db: IDBDatabase
  let dbStore: IDBObjectStore

  const mockHandle = {
    name: 'folio.iFolio',
    kind: 'file' as const,
    getFile: vi.fn(),
    queryPermission: vi.fn(),
    requestPermission: vi.fn(),
    createWritable: vi.fn(),
  }

  beforeEach(() => {
    localStorage.clear()

    const store = new Map<string, unknown>()

    dbStore = {
      put: vi.fn((value: unknown, key: string) => {
        store.set(key, value)
        return {} as IDBRequest
      }),
      get: vi.fn((key: string) => {
        const req = {
          result: store.get(key) ?? null,
          onsuccess: null,
          onerror: null,
        } as unknown as IDBRequest
        setTimeout(() => {
          if (req.onsuccess) (req.onsuccess as () => void)()
        }, 0)
        return req
      }),
      delete: vi.fn((key: string) => {
        store.delete(key)
        return {} as IDBRequest
      }),
    } as unknown as IDBObjectStore

    db = {
      transaction: vi.fn((_storeName: string, _mode?: IDBTransactionMode) => {
        const tx = {
          objectStore: vi.fn(() => dbStore),
          oncomplete: null,
          onerror: null,
        } as unknown as IDBTransaction
        setTimeout(() => {
          if (tx.oncomplete) (tx.oncomplete as () => void)()
        }, 0)
        return tx
      }),
      close: vi.fn(),
    } as unknown as IDBDatabase

    const idbFactory = {
      open: vi.fn(() => {
        const request = {
          result: db,
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
        } as unknown as IDBOpenDBRequest
        request.onsuccess = vi.fn()
        setTimeout(() => {
          if (request.onsuccess) (request.onsuccess as () => void)()
        }, 0)
        return request
      }),
    } as unknown as IDBFactory

    vi.stubGlobal('indexedDB', idbFactory)
  })

  it('saveHandle stores a handle in IndexedDB', async () => {
    await sut.saveHandle(mockHandle as unknown as FileSystemFileHandle)
    expect(db.transaction).toHaveBeenCalledWith('handles', 'readwrite')
    expect(dbStore.put).toHaveBeenCalledWith(mockHandle, 'currentHandle')
  })

  it('loadHandle retrieves a stored handle', async () => {
    await sut.saveHandle(mockHandle as unknown as FileSystemFileHandle)
    const result = await sut.loadHandle()
    expect(result).not.toBeNull()
    expect(result!.name).toBe('folio.iFolio')
  })

  it('loadHandle returns null when no handle is stored', async () => {
    const result = await sut.loadHandle()
    expect(result).toBeNull()
  })

  it('saveHandle writes filename to localStorage', async () => {
    await sut.saveHandle(mockHandle as unknown as FileSystemFileHandle)
    expect(localStorage.getItem('ifolio-last-vault-filename')).toBe('folio.iFolio')
  })

  it('forgetHandle deletes handle from IndexedDB', async () => {
    await sut.saveHandle(mockHandle as unknown as FileSystemFileHandle)
    await sut.forgetHandle()
    const result = await sut.loadHandle()
    expect(result).toBeNull()
  })

  it('forgetHandle clears localStorage', async () => {
    await sut.saveHandle(mockHandle as unknown as FileSystemFileHandle)
    await sut.forgetHandle()
    expect(localStorage.getItem('ifolio-last-vault-filename')).toBeNull()
    expect(localStorage.getItem('ifolio-last-vault-opened-at')).toBeNull()
  })

  it('isAvailable returns false when IndexedDB is not supported', () => {
    vi.stubGlobal('indexedDB', undefined)
    vi.stubGlobal('window', {})
    expect(sut.isAvailable()).toBe(false)
  })

  it('getLastFileName returns stored filename', () => {
    localStorage.setItem('ifolio-last-vault-filename', 'test.foli')
    expect(sut.getLastFileName()).toBe('test.foli')
  })

  it('getLastFileName returns null when not set', () => {
    expect(sut.getLastFileName()).toBeNull()
  })

  it('getLastOpenedAt returns stored timestamp', () => {
    localStorage.setItem('ifolio-last-vault-opened-at', '2026-06-15T12:00:00.000Z')
    expect(sut.getLastOpenedAt()).toBe('2026-06-15T12:00:00.000Z')
  })
})
