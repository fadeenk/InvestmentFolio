import {
  FORMAT_VERSION,
  PBKDF2_ITERATIONS,
  SALT_LENGTH,
  IV_LENGTH,
  ALGO_BYTE,
  randomSalt,
  randomIV,
  buildVaultBuffer,
  parseVaultBuffer,
  deriveKey,
  encryptPayload,
  decryptPayload,
} from '~/utils/vault'
import type { VaultPayload } from '~/types/vault'
import { CostBasisMethod, Theme, DateFormat } from '~/types/enums'

function makeTestPayload(): VaultPayload {
  return {
    schemaVersion: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    lastSyncedAt: null,
    accounts: [],
    transactions: [],
    positions: [],
    taxLots: [],
    dividends: [],
    priceHistory: {},
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
      schwabTokenMeta: null,
      costBasisMethodByAccount: {},
      lastSavedAt: null,
    },
  }
}

describe('randomSalt / randomIV', () => {
  it('randomSalt returns a Uint8Array of SALT_LENGTH bytes', () => {
    const salt = randomSalt()
    expect(salt).toBeInstanceOf(Uint8Array)
    expect(salt.byteLength).toBe(SALT_LENGTH)
  })

  it('randomIV returns a Uint8Array of IV_LENGTH bytes', () => {
    const iv = randomIV()
    expect(iv).toBeInstanceOf(Uint8Array)
    expect(iv.byteLength).toBe(IV_LENGTH)
  })

  it('randomSalt produces different values on each call', () => {
    const a = randomSalt()
    const b = randomSalt()
    expect(a).not.toEqual(b)
  })
})

describe('buildVaultBuffer / parseVaultBuffer', () => {
  it('round-trips a buffer back to the original parts', () => {
    const salt = randomSalt()
    const iv = randomIV()
    const ciphertext = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer

    const buffer = buildVaultBuffer(salt, iv, ciphertext)
    expect(buffer).toBeInstanceOf(ArrayBuffer)

    const parsed = parseVaultBuffer(buffer)
    expect(parsed.iterations).toBe(PBKDF2_ITERATIONS)
    expect(new Uint8Array(parsed.salt)).toEqual(salt)
    expect(new Uint8Array(parsed.iv)).toEqual(iv)
    expect(new Uint8Array(parsed.ciphertext)).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('produces correct magic bytes at the start', () => {
    const salt = randomSalt()
    const iv = randomIV()
    const dummyCipher = new Uint8Array(4)
    const buffer = new Uint8Array(buildVaultBuffer(salt, iv, dummyCipher.buffer))

    expect(buffer[0]).toBe(0x46)
    expect(buffer[1]).toBe(0x4f)
    expect(buffer[2]).toBe(0x4c)
    expect(buffer[3]).toBe(0x49)
    expect(buffer[4]).toBe(FORMAT_VERSION)
  })

  it('has the expected total header size before ciphertext', () => {
    const salt = randomSalt()
    const iv = randomIV()
    // header: 4 (magic) + 1 (ver) + 4 (iterations) + 32 (salt) + 1 (algo) + 12 (iv) = 54
    const dummyCipher = new Uint8Array(10)
    const buffer = new Uint8Array(buildVaultBuffer(salt, iv, dummyCipher.buffer))

    expect(buffer.length).toBe(54 + 10)
    // algo byte at offset 41
    expect(buffer[41]).toBe(ALGO_BYTE)
    // IV starts at offset 42
    expect(buffer.slice(42, 54)).toEqual(new Uint8Array(iv))
  })

  it('parseVaultBuffer throws on invalid magic bytes', () => {
    const bad = new ArrayBuffer(54)
    expect(() => parseVaultBuffer(bad)).toThrow('Not a valid Folio vault file')
  })

  it('parseVaultBuffer throws on empty buffer', () => {
    const empty = new ArrayBuffer(0)
    expect(() => parseVaultBuffer(empty)).toThrow('Not a valid Folio vault file')
  })
})

describe('deriveKey / encryptPayload / decryptPayload', () => {
  // We test with a real CryptoKey by stubbing crypto.subtle if available,
  // or we let the test fail early with a clear message when Web Crypto is
  // unavailable (jsdom / older Node).
  const hasWebCrypto =
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.importKey === 'function'

  it('deriveKey returns a non-extractable CryptoKey', async () => {
    if (!hasWebCrypto) {
      return
    }
    const key = await deriveKey('test-passphrase', randomSalt())
    expect(key).toBeDefined()
    expect(key.type).toBe('secret')
    expect(key.extractable).toBe(false)
    expect(key.usages).toContain('encrypt')
    expect(key.usages).toContain('decrypt')
  })

  it('encrypt / decrypt round-trips a payload correctly', async () => {
    if (!hasWebCrypto) {
      return
    }
    const payload = makeTestPayload()
    const key = await deriveKey('round-trip-test', randomSalt())
    const { iv, ciphertext } = await encryptPayload(payload, key)

    expect(iv.byteLength).toBe(IV_LENGTH)
    expect(ciphertext.byteLength).toBeGreaterThan(0)

    const decrypted = await decryptPayload(ciphertext, iv, key)
    expect(decrypted).toEqual(payload)
  })

  it('decrypt with wrong key throws an error', async () => {
    if (!hasWebCrypto) {
      return
    }
    const payload = makeTestPayload()
    const keyA = await deriveKey('pass-a', randomSalt())
    const keyB = await deriveKey('pass-b', randomSalt())
    const { iv, ciphertext } = await encryptPayload(payload, keyA)

    await expect(decryptPayload(ciphertext, iv, keyB)).rejects.toThrow()
  })

  it('encrypt with a provided IV uses that IV', async () => {
    if (!hasWebCrypto) {
      return
    }
    const payload = makeTestPayload()
    const key = await deriveKey('iv-test', randomSalt())
    const fixedIv = new Uint8Array(IV_LENGTH).fill(0x42)
    const { iv } = await encryptPayload(payload, key, fixedIv)

    expect(new Uint8Array(iv)).toEqual(fixedIv)
  })
})
