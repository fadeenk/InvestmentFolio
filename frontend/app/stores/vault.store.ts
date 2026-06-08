import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VaultPayload, Account, DisplayPreferences } from '@/types/vault'
import { VaultStatus } from '@/types/vault'
import { CostBasisMethod, Theme, DateFormat } from '@/types/enums'
import { deriveKey, randomSalt, encryptPayload, decryptPayload, buildVaultBuffer, parseVaultBuffer } from '@/utils/vault'
import { backfillClosedLots } from '@/utils/ledger'

function createDefaultPayload(): VaultPayload {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    createdAt: now,
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
      costBasisMethodByAccount: {},
      schwabTokenMeta: null,
      lastSavedAt: null,
    },
  }
}

export const useVaultStore = defineStore('vault', () => {
  const status = ref<VaultStatus>(VaultStatus.LOCKED)
  const payload = ref<VaultPayload | null>(null)

  const fileHandle = ref<FileSystemFileHandle | null>(null)

  const _cryptoKey = ref<CryptoKey | null>(null)

  /** Salt used during the most recent key derivation. Kept alongside the
   * non-extractable CryptoKey so saveVault can re-derive the same key. */
  const _sessionSalt = ref<Uint8Array | null>(null)

  const lastError = ref<string | null>(null)

  const isDirty = ref(false)

  const isUnlocked = computed(() => status.value === VaultStatus.UNLOCKED)
  const isSaving = computed(() => status.value === VaultStatus.SAVING)
  const hasUnsavedChanges = computed(() => isDirty.value)

  const accounts = computed<Account[]>(() => payload.value?.accounts ?? [])

  const displayPreferences = computed<DisplayPreferences | null>(() => payload.value?.metadata.displayPreferences ?? null)

  async function createVault(passphrase: string): Promise<void> {
    lastError.value = null
    status.value = VaultStatus.UNLOCKING

    try {
      const salt = randomSalt()
      const key = await deriveKey(passphrase, salt)
      const newPayload = createDefaultPayload()
      const { iv, ciphertext } = await encryptPayload(newPayload, key)
      const buffer = buildVaultBuffer(salt, iv, ciphertext)

      await _writeBuffer(buffer)

      _cryptoKey.value = key
      _sessionSalt.value = salt
      payload.value = newPayload
      isDirty.value = false
      status.value = VaultStatus.UNLOCKED
    } catch (err) {
      status.value = VaultStatus.LOCKED
      lastError.value = err instanceof Error ? err.message : 'Failed to create vault'
      throw err
    }
  }

  async function openVault(input: File | FileSystemFileHandle, passphrase: string): Promise<void> {
    lastError.value = null
    status.value = VaultStatus.UNLOCKING

    try {
      let file: File
      if (input instanceof File) {
        file = input
      } else {
        fileHandle.value = input
        file = await input.getFile()
      }
      const buffer = await file.arrayBuffer()
      const { salt, iv, ciphertext } = parseVaultBuffer(buffer)
      const key = await deriveKey(passphrase, salt)
      const decryptedPayload = await decryptPayload(ciphertext, iv, key)

      _cryptoKey.value = key
      _sessionSalt.value = salt
      decryptedPayload.closedLots ??= []
      decryptedPayload.googleSheetsClientId ??= ''
      if (decryptedPayload.closedLots.length === 0 && decryptedPayload.taxLots.some((l) => !l.isOpen)) {
        backfillClosedLots(decryptedPayload)
        isDirty.value = true
      }
      payload.value = decryptedPayload
      isDirty.value = false
      status.value = VaultStatus.UNLOCKED
    } catch (err: Error | unknown) {
      status.value = VaultStatus.LOCKED
      _cryptoKey.value = null
      _sessionSalt.value = null
      payload.value = null

      const msg = err instanceof Error ? (err.message !== '' ? err.message : (err.stack ?? '')) : String(err)
      if (msg.toLowerCase().includes('operation failed') || msg.toLowerCase().includes('decrypt')) {
        lastError.value = 'Incorrect passphrase or corrupted vault file'
      } else {
        lastError.value = msg
      }
      throw err
    }
  }

  function setFileHandle(handle: FileSystemFileHandle): void {
    fileHandle.value = handle
  }

  async function saveVault(): Promise<void> {
    if (!payload.value || !_cryptoKey.value) return
    lastError.value = null
    status.value = VaultStatus.SAVING

    try {
      if (!_sessionSalt.value) {
        throw new Error('Session salt not available — please re-open the vault')
      }
      const salt = _sessionSalt.value
      const { iv, ciphertext } = await encryptPayload(payload.value, _cryptoKey.value)
      const buffer = buildVaultBuffer(salt, iv, ciphertext)

      payload.value.metadata.lastSavedAt = new Date().toISOString()
      await _writeBuffer(buffer)

      isDirty.value = false
      status.value = VaultStatus.UNLOCKED
    } catch (err) {
      status.value = VaultStatus.UNLOCKED
      lastError.value = err instanceof Error ? err.message : 'Save failed'
      throw err
    }
  }

  async function changePassphrase(currentPassphrase: string, nextPassphrase: string): Promise<void> {
    if (!payload.value || !_cryptoKey.value || !_sessionSalt.value) {
      throw new Error('Vault is locked')
    }

    lastError.value = null
    status.value = VaultStatus.SAVING

    try {
      const currentKey = await deriveKey(currentPassphrase, _sessionSalt.value)

      // Validate the provided current passphrase by decrypting a probe payload.
      const probe = await encryptPayload(payload.value, _cryptoKey.value)
      try {
        await decryptPayload(probe.ciphertext, probe.iv, currentKey)
      } catch {
        throw new Error('Current passphrase is incorrect')
      }

      const nextSalt = randomSalt()
      const nextKey = await deriveKey(nextPassphrase, nextSalt)
      payload.value.metadata.lastSavedAt = new Date().toISOString()
      const { iv, ciphertext } = await encryptPayload(payload.value, nextKey)
      const buffer = buildVaultBuffer(nextSalt, iv, ciphertext)

      await _writeBuffer(buffer)

      _cryptoKey.value = nextKey
      _sessionSalt.value = nextSalt
      isDirty.value = false
      status.value = VaultStatus.UNLOCKED
    } catch (err) {
      status.value = VaultStatus.UNLOCKED
      lastError.value = err instanceof Error ? err.message : 'Passphrase update failed'
      throw err
    }
  }

  function lockVault(): void {
    payload.value = null
    _cryptoKey.value = null
    _sessionSalt.value = null
    fileHandle.value = null
    isDirty.value = false
    lastError.value = null
    status.value = VaultStatus.LOCKED
  }

  function markDirty(): void {
    isDirty.value = true
  }

  function mutatePayload(fn: (p: VaultPayload) => void): void {
    if (!payload.value) throw new Error('Vault is locked')
    fn(payload.value)
    markDirty()
  }

  async function _writeBuffer(buffer: ArrayBuffer): Promise<void> {
    if (fileHandle.value) {
      try {
        const writable = await (
          fileHandle.value as FileSystemFileHandle & {
            createWritable(): Promise<FileSystemWritableFileStream>
          }
        ).createWritable()
        await writable.write(buffer)
        await writable.close()
        return
      } catch {
        // handle may be stale — fall through to download
      }
    }

    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'folio.iFolio'
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    status,
    lastError,
    isDirty,
    fileHandle,
    isUnlocked,
    isSaving,
    hasUnsavedChanges,
    accounts,
    displayPreferences,
    payload,
    createVault,
    openVault,
    setFileHandle,
    saveVault,
    changePassphrase,
    lockVault,
    markDirty,
    mutatePayload,
  }
})
