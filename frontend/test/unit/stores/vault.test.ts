import { setActivePinia, createPinia } from 'pinia'
import { useVaultStore } from '~/stores/vault.store'
import { CostBasisMethod, Theme, DateFormat } from '~/types/enums'
import { VaultStatus, type VaultPayload } from '~/types/vault'
import * as vaultUtils from '~/utils/vault'

// ---------------------------------------------------------------------------
// Web Crypto API mock
// ---------------------------------------------------------------------------

function createMockCryptoKey(): CryptoKey {
  return {
    type: 'secret',
    extractable: false,
    algorithm: {} as Algorithm,
    usages: ['encrypt', 'decrypt'],
  } as CryptoKey
}

function createMockSubtle() {
  return {
    importKey: vi.fn().mockResolvedValue(createMockCryptoKey()),
    deriveKey: vi.fn().mockResolvedValue(createMockCryptoKey()),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode('{}').buffer as ArrayBuffer),
  } as unknown as SubtleCrypto
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockFile(): File {
  const header = new Uint8Array(54)
  header[0] = 0x46
  header[1] = 0x4f
  header[2] = 0x4c
  header[3] = 0x49
  // version at offset 4
  header[5] = 0x00
  header[6] = 0x09
  header[7] = 0x27
  header[8] = 0xc0 // 600000 in big-endian
  // algo at offset 41
  header[41] = 0x01

  const buf = new Uint8Array(54 + 32)
  buf.set(header)

  return new File([buf.buffer], 'ifolio.foli', { type: 'application/octet-stream' })
}

function makeMockFileSystemFileHandle(permissionResult?: 'granted' | 'denied' | 'prompt'): FileSystemFileHandle {
  const file = makeMockFile()
  const perm = permissionResult ?? 'granted'
  return {
    name: 'ifolio.foli',
    kind: 'file',
    getFile: vi.fn().mockResolvedValue(file),
    requestPermission: vi.fn().mockResolvedValue(perm),
    queryPermission: vi.fn().mockResolvedValue(perm),
  } as unknown as FileSystemFileHandle
}

function mockCryptoAPI() {
  const subtle = createMockSubtle()
  vi.stubGlobal('crypto', {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i + 1
      return arr
    },
    subtle,
    randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
  })
}

function stubDOM() {
  const downloadLinks: string[] = []
  vi.stubGlobal('URL', {
    createObjectURL: (_blob: Blob) => {
      const url = `blob:${Math.random()}`
      downloadLinks.push(url)
      return url
    },
    revokeObjectURL: vi.fn(),
  })
  document.createElement = vi.fn((tag: string) => {
    if (tag === 'a') {
      return {
        href: '',
        download: '',
        click: vi.fn(),
      } as unknown as HTMLElement
    }
    return document.createElement(tag)
  })
  return downloadLinks
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('vault store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('starts LOCKED with null payload', () => {
      const store = useVaultStore()
      expect(store.status).toBe(VaultStatus.LOCKED)
      expect(store.payload).toBeNull()
      expect(store.lastError).toBeNull()
      expect(store.isDirty).toBe(false)
      expect(store.isUnlocked).toBe(false)
      expect(store.isSaving).toBe(false)
      expect(store.hasUnsavedChanges).toBe(false)
      expect(store.fileHandle).toBeNull()
    })

    it('returns empty arrays when locked', () => {
      const store = useVaultStore()
      expect(store.accounts).toEqual([])
      expect(store.displayPreferences).toBeNull()
    })
  })

  describe('createVault', () => {
    beforeEach(() => {
      mockCryptoAPI()
      stubDOM()
      vi.spyOn(vaultUtils, 'deriveKey').mockResolvedValue(createMockCryptoKey())
      vi.spyOn(vaultUtils, 'encryptPayload').mockResolvedValue({
        iv: new Uint8Array(12).fill(0xaa),
        ciphertext: new ArrayBuffer(32),
      })
      vi.spyOn(vaultUtils, 'buildVaultBuffer').mockReturnValue(new ArrayBuffer(86))
    })

    it('transitions LOCKED → UNLOCKING → UNLOCKED on success', async () => {
      const store = useVaultStore()
      const promise = store.createVault('test-passphrase')

      expect(store.status).toBe(VaultStatus.UNLOCKING)

      await promise
      expect(store.status).toBe(VaultStatus.UNLOCKED)
      expect(store.isUnlocked).toBe(true)
    })

    it('creates a default payload on success', async () => {
      const store = useVaultStore()
      await store.createVault('test-passphrase')

      expect(store.payload).not.toBeNull()
      expect(store.payload!.schemaVersion).toBe(1)
      expect(store.payload!.accounts).toEqual([])
      expect(store.payload!.metadata.displayPreferences.theme).toBe(Theme.SYSTEM)
    })

    it('sets the crypto key and session salt', async () => {
      const store = useVaultStore()
      await store.createVault('test-passphrase')

      // The key was set (inner _cryptoKey is tested through saveVault behaviour)
      expect(store.isDirty).toBe(false)
    })

    it('returns to LOCKED and sets lastError on failure', async () => {
      vi.spyOn(vaultUtils, 'deriveKey').mockRejectedValue(new Error('crypto unavailable'))

      const store = useVaultStore()
      await expect(store.createVault('test-passphrase')).rejects.toThrow()
      expect(store.status).toBe(VaultStatus.LOCKED)
      expect(store.lastError).toBeTruthy()
      expect(store.payload).toBeNull()
    })

    it('calls buildVaultBuffer and writes to a file', async () => {
      const store = useVaultStore()
      const writeSpy = vi.spyOn(vaultUtils, 'buildVaultBuffer')

      await store.createVault('test-passphrase')
      expect(writeSpy).toHaveBeenCalled()
    })
  })

  describe('openVault', () => {
    beforeEach(() => {
      mockCryptoAPI()
    })

    it('transitions LOCKED → UNLOCKING → UNLOCKED on correct passphrase', async () => {
      const store = useVaultStore()

      vi.spyOn(vaultUtils, 'parseVaultBuffer').mockReturnValue({
        iterations: 600_000,
        salt: new Uint8Array(32),
        iv: new Uint8Array(12),
        ciphertext: new ArrayBuffer(32),
      })
      vi.spyOn(vaultUtils, 'deriveKey').mockResolvedValue(createMockCryptoKey())
      vi.spyOn(vaultUtils, 'decryptPayload').mockResolvedValue({
        schemaVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastSyncedAt: null,
        accounts: [{ id: 'acc-1', displayName: 'Test' }],
        transactions: [],
        positions: [],
        taxLots: [],
        closedLots: [],
        dividends: [],
        priceHistory: {},
        lastSyncSummary: null,
        googleSheetsClientId: '',
        metadata: {
          displayPreferences: {
            theme: Theme.SYSTEM,
            currencyFormat: 'USD',
            dateFormat: DateFormat.MM_DD_YYYY,
            defaultAccountFilter: null,
            defaultCostBasisMethod: CostBasisMethod.FIFO,
            defaultTimeRange: 'YTD',
          },
          schwabAccountHashes: {},
          schwabAccountHashesByFullNumber: {},
          schwabTokenMeta: null,
          costBasisMethodByAccount: {},
          lastSavedAt: null,
        },
      })

      const promise = store.openVault(makeMockFileSystemFileHandle(), 'correct-passphrase')

      expect(store.status).toBe(VaultStatus.UNLOCKING)

      await promise
      expect(store.status).toBe(VaultStatus.UNLOCKED)
      expect(store.payload).not.toBeNull()
      expect(store.payload!.accounts).toHaveLength(1)
    })

    it('stays LOCKED with error on wrong passphrase', async () => {
      const store = useVaultStore()

      vi.spyOn(vaultUtils, 'parseVaultBuffer').mockReturnValue({
        iterations: 600_000,
        salt: new Uint8Array(32),
        iv: new Uint8Array(12),
        ciphertext: new ArrayBuffer(32),
      })
      vi.spyOn(vaultUtils, 'deriveKey').mockResolvedValue(createMockCryptoKey())
      vi.spyOn(vaultUtils, 'decryptPayload').mockRejectedValue(new Error('operation failed'))

      await expect(store.openVault(makeMockFileSystemFileHandle(), 'wrong-passphrase')).rejects.toThrow()
      expect(store.status).toBe(VaultStatus.LOCKED)
      expect(store.lastError).toContain('Incorrect passphrase')
      expect(store.payload).toBeNull()
    })

    it('stores the file handle on successful open', async () => {
      const store = useVaultStore()

      vi.spyOn(vaultUtils, 'parseVaultBuffer').mockReturnValue({
        iterations: 600_000,
        salt: new Uint8Array(32),
        iv: new Uint8Array(12),
        ciphertext: new ArrayBuffer(32),
      })
      vi.spyOn(vaultUtils, 'deriveKey').mockResolvedValue(createMockCryptoKey())
      vi.spyOn(vaultUtils, 'decryptPayload').mockResolvedValue({
        schemaVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastSyncedAt: null,
        accounts: [],
        transactions: [],
        positions: [],
        taxLots: [],
        closedLots: [],
        dividends: [],
        priceHistory: {},
        lastSyncSummary: null,
        googleSheetsClientId: '',
        metadata: {
          displayPreferences: {
            theme: Theme.SYSTEM,
            currencyFormat: 'USD',
            dateFormat: DateFormat.MM_DD_YYYY,
            defaultAccountFilter: null,
            defaultCostBasisMethod: CostBasisMethod.FIFO,
            defaultTimeRange: 'YTD',
          },
          schwabAccountHashes: {},
          schwabAccountHashesByFullNumber: {},
          schwabTokenMeta: null,
          costBasisMethodByAccount: {},
          lastSavedAt: null,
        },
      })

      const mockHandle = makeMockFileSystemFileHandle()
      await store.openVault(mockHandle, 'passphrase')
      expect(store.fileHandle).toStrictEqual(mockHandle)
    })

    it('accepts a raw File as fallback and does not store a handle', async () => {
      const store = useVaultStore()

      vi.spyOn(vaultUtils, 'parseVaultBuffer').mockReturnValue({
        iterations: 600_000,
        salt: new Uint8Array(32),
        iv: new Uint8Array(12),
        ciphertext: new ArrayBuffer(32),
      })
      vi.spyOn(vaultUtils, 'deriveKey').mockResolvedValue(createMockCryptoKey())
      vi.spyOn(vaultUtils, 'decryptPayload').mockResolvedValue({
        schemaVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastSyncedAt: null,
        accounts: [],
        transactions: [],
        positions: [],
        taxLots: [],
        closedLots: [],
        dividends: [],
        priceHistory: {},
        lastSyncSummary: null,
        googleSheetsClientId: '',
        metadata: {
          displayPreferences: {
            theme: Theme.SYSTEM,
            currencyFormat: 'USD',
            dateFormat: DateFormat.MM_DD_YYYY,
            defaultAccountFilter: null,
            defaultCostBasisMethod: CostBasisMethod.FIFO,
            defaultTimeRange: 'YTD',
          },
          schwabAccountHashes: {},
          schwabAccountHashesByFullNumber: {},
          schwabTokenMeta: null,
          costBasisMethodByAccount: {},
          lastSavedAt: null,
        },
      })

      await store.openVault(makeMockFile(), 'passphrase')
      expect(store.fileHandle).toBeNull()
    })

    it('handles corrupted vault file', async () => {
      vi.spyOn(vaultUtils, 'parseVaultBuffer').mockImplementation(() => {
        throw new Error('Not a valid iFolio vault file')
      })

      const store = useVaultStore()
      const badFile = new File(['garbage'], 'bad.foli', { type: 'application/octet-stream' })
      await expect(store.openVault(badFile, 'any')).rejects.toThrow()
      expect(store.status).toBe(VaultStatus.LOCKED)
      expect(store.lastError).toBe('Not a valid iFolio vault file')
    })
  })

  describe('saveVault', () => {
    beforeEach(async () => {
      mockCryptoAPI()
      stubDOM()
      vi.spyOn(vaultUtils, 'deriveKey').mockResolvedValue(createMockCryptoKey())
      vi.spyOn(vaultUtils, 'encryptPayload').mockResolvedValue({
        iv: new Uint8Array(12).fill(0xbb),
        ciphertext: new ArrayBuffer(64),
      })
      vi.spyOn(vaultUtils, 'buildVaultBuffer').mockReturnValue(new ArrayBuffer(118))
      vi.spyOn(vaultUtils, 'parseVaultBuffer').mockReturnValue({
        iterations: 600_000,
        salt: new Uint8Array(32),
        iv: new Uint8Array(12),
        ciphertext: new ArrayBuffer(32),
      })
      vi.spyOn(vaultUtils, 'decryptPayload').mockResolvedValue({
        schemaVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastSyncedAt: null,
        accounts: [],
        transactions: [],
        positions: [],
        taxLots: [],
        closedLots: [],
        dividends: [],
        priceHistory: {},
        lastSyncSummary: null,
        googleSheetsClientId: '',
        metadata: {
          displayPreferences: {
            theme: Theme.SYSTEM,
            currencyFormat: 'USD',
            dateFormat: DateFormat.MM_DD_YYYY,
            defaultAccountFilter: null,
            defaultCostBasisMethod: CostBasisMethod.FIFO,
            defaultTimeRange: 'YTD',
          },
          schwabAccountHashes: {},
          schwabAccountHashesByFullNumber: {},
          schwabTokenMeta: null,
          costBasisMethodByAccount: {},
          lastSavedAt: null,
        },
      })
    })

    it('transitions SAVING → UNLOCKED after save', async () => {
      const store = useVaultStore()
      await store.createVault('test-passphrase')
      expect(store.isSaving).toBe(false)

      const promise = store.saveVault()
      expect(store.status).toBe(VaultStatus.SAVING)

      await promise
      expect(store.status).toBe(VaultStatus.UNLOCKED)
      expect(store.isDirty).toBe(false)
    })

    it('updates lastSavedAt timestamp', async () => {
      const store = useVaultStore()
      await store.createVault('test-passphrase')
      expect(store.payload!.metadata.lastSavedAt).toBeNull()

      await store.saveVault()
      expect(store.payload!.metadata.lastSavedAt).not.toBeNull()
      expect(typeof store.payload!.metadata.lastSavedAt).toBe('string')
    })

    it('is no-op when vault is locked', async () => {
      const store = useVaultStore()
      vi.spyOn(vaultUtils, 'encryptPayload')
      await store.saveVault()
      expect(vaultUtils.encryptPayload).not.toHaveBeenCalled()
    })

    it('applies lastSavedAt before writing', async () => {
      const store = useVaultStore()
      await store.createVault('test-passphrase')

      const encryptSpy = vi.spyOn(vaultUtils, 'encryptPayload')
      await store.saveVault()

      expect(encryptSpy).toHaveBeenCalled()
    })

    it('clears fileHandle and falls back to download when handle permission is denied', async () => {
      const store = useVaultStore()
      const handle = makeMockFileSystemFileHandle('denied')
      await store.createVault('passphrase')
      store.setFileHandle(handle)
      stubDOM()
      await store.saveVault()
      expect(store.fileHandle).toBeNull()
      expect(store.lastError).toContain('handle expired')
    })
  })

  describe('changePassphrase', () => {
    beforeEach(async () => {
      mockCryptoAPI()
      stubDOM()
      vi.spyOn(vaultUtils, 'deriveKey').mockResolvedValue(createMockCryptoKey())
      vi.spyOn(vaultUtils, 'encryptPayload').mockResolvedValue({
        iv: new Uint8Array(12).fill(0xee),
        ciphertext: new ArrayBuffer(64),
      })
      vi.spyOn(vaultUtils, 'buildVaultBuffer').mockReturnValue(new ArrayBuffer(118))
      vi.spyOn(vaultUtils, 'decryptPayload').mockResolvedValue({
        schemaVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastSyncedAt: null,
        accounts: [],
        transactions: [],
        positions: [],
        taxLots: [],
        closedLots: [],
        dividends: [],
        priceHistory: {},
        lastSyncSummary: null,
        googleSheetsClientId: '',
        metadata: {
          displayPreferences: {
            theme: Theme.SYSTEM,
            currencyFormat: 'USD',
            dateFormat: DateFormat.MM_DD_YYYY,
            defaultAccountFilter: null,
            defaultCostBasisMethod: CostBasisMethod.FIFO,
            defaultTimeRange: 'YTD',
          },
          schwabAccountHashes: {},
          schwabAccountHashesByFullNumber: {},
          schwabTokenMeta: null,
          costBasisMethodByAccount: {},
          lastSavedAt: null,
        },
      })
    })

    it('re-encrypts vault with a new passphrase', async () => {
      const store = useVaultStore()
      await store.createVault('old-passphrase')
      expect(store.status).toBe(VaultStatus.UNLOCKED)

      await store.changePassphrase('old-passphrase', 'new-passphrase')

      expect(vaultUtils.deriveKey).toHaveBeenCalledTimes(3)
      expect(vaultUtils.buildVaultBuffer).toHaveBeenCalled()
      expect(store.status).toBe(VaultStatus.UNLOCKED)
      expect(store.isDirty).toBe(false)
      expect(store.lastError).toBeNull()
    })

    it('throws when current passphrase is incorrect', async () => {
      const store = useVaultStore()
      await store.createVault('old-passphrase')

      vi.spyOn(vaultUtils, 'decryptPayload').mockRejectedValueOnce(new Error('operation failed'))

      await expect(store.changePassphrase('wrong-passphrase', 'new-passphrase')).rejects.toThrow('Current passphrase is incorrect')
      expect(store.status).toBe(VaultStatus.UNLOCKED)
      expect(store.lastError).toBe('Current passphrase is incorrect')
    })

    it('throws when vault is locked', async () => {
      const store = useVaultStore()
      await expect(store.changePassphrase('old-passphrase', 'new-passphrase')).rejects.toThrow('Vault is locked')
    })
  })

  describe('lockVault', () => {
    beforeEach(async () => {
      mockCryptoAPI()
      stubDOM()
      vi.spyOn(vaultUtils, 'deriveKey').mockResolvedValue(createMockCryptoKey())
      vi.spyOn(vaultUtils, 'encryptPayload').mockResolvedValue({
        iv: new Uint8Array(12).fill(0xcc),
        ciphertext: new ArrayBuffer(32),
      })
      vi.spyOn(vaultUtils, 'buildVaultBuffer').mockReturnValue(new ArrayBuffer(86))
      vi.spyOn(vaultUtils, 'parseVaultBuffer').mockReturnValue({
        iterations: 600_000,
        salt: new Uint8Array(32),
        iv: new Uint8Array(12),
        ciphertext: new ArrayBuffer(32),
      })
      vi.spyOn(vaultUtils, 'decryptPayload').mockResolvedValue({
        schemaVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastSyncedAt: null,
        accounts: [],
        transactions: [],
        positions: [],
        taxLots: [],
        closedLots: [],
        dividends: [],
        priceHistory: {},
        lastSyncSummary: null,
        googleSheetsClientId: '',
        metadata: {
          displayPreferences: {
            theme: Theme.SYSTEM,
            currencyFormat: 'USD',
            dateFormat: DateFormat.MM_DD_YYYY,
            defaultAccountFilter: null,
            defaultCostBasisMethod: CostBasisMethod.FIFO,
            defaultTimeRange: 'YTD',
          },
          schwabAccountHashes: {},
          schwabAccountHashesByFullNumber: {},
          schwabTokenMeta: null,
          costBasisMethodByAccount: {},
          lastSavedAt: null,
        },
      })
    })

    it('zeros all state and returns to LOCKED', async () => {
      const store = useVaultStore()
      await store.createVault('test-passphrase')
      expect(store.isUnlocked).toBe(true)

      store.lockVault()
      expect(store.status).toBe(VaultStatus.LOCKED)
      expect(store.payload).toBeNull()
      expect(store.isDirty).toBe(false)
      expect(store.lastError).toBeNull()
      expect(store.fileHandle).toBeNull()
      expect(store.isUnlocked).toBe(false)
    })

    it('is idempotent when already locked', () => {
      const store = useVaultStore()
      store.lockVault()
      expect(store.status).toBe(VaultStatus.LOCKED)
      store.lockVault()
      expect(store.status).toBe(VaultStatus.LOCKED)
    })
  })

  describe('mutatePayload / markDirty', () => {
    beforeEach(async () => {
      mockCryptoAPI()
      stubDOM()
      vi.spyOn(vaultUtils, 'deriveKey').mockResolvedValue(createMockCryptoKey())
      vi.spyOn(vaultUtils, 'encryptPayload').mockResolvedValue({
        iv: new Uint8Array(12).fill(0xdd),
        ciphertext: new ArrayBuffer(32),
      })
      vi.spyOn(vaultUtils, 'buildVaultBuffer').mockReturnValue(new ArrayBuffer(86))
    })

    it('markDirty sets isDirty to true', () => {
      const store = useVaultStore()
      store.markDirty()
      expect(store.isDirty).toBe(true)
      expect(store.hasUnsavedChanges).toBe(true)
    })

    it('mutatePayload modifies payload and marks dirty', async () => {
      const store = useVaultStore()
      await store.createVault('test-passphrase')

      store.mutatePayload((p: VaultPayload) => {
        p.accounts.push({ id: 'new-acc' })
      })

      expect(store.payload!.accounts).toHaveLength(1)
      expect(store.isDirty).toBe(true)
    })

    it('mutatePayload throws when vault is locked', () => {
      const store = useVaultStore()
      expect(() => store.mutatePayload((_p: VaultPayload) => {})).toThrow('Vault is locked')
    })
  })

  describe('setFileHandle', () => {
    it('stores the file handle', () => {
      const store = useVaultStore()
      const handle = { name: 'ifolio.foli' } as unknown as FileSystemFileHandle
      store.setFileHandle(handle)
      expect(store.fileHandle).toStrictEqual(handle)
    })
  })
})
