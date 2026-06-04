// ─────────────────────────────────────────────────────────────────────────────
// utils/vault.ts
//
// Pure functions for vault crypto operations and binary serialisation.
// No state — all inputs explicit. Designed to be easily unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

import type { VaultPayload } from '@/types/vault'

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAGIC_BYTES = new Uint8Array([0x46, 0x4f, 0x4c, 0x49]) // 'FOLI'
export const FORMAT_VERSION = 0x01
export const PBKDF2_ITERATIONS = 600_000
export const SALT_LENGTH = 32
export const IV_LENGTH = 12
export const ALGO_BYTE = 0x01 // PBKDF2-HMAC-SHA256

// ── Salt & IV generators ───────────────────────────────────────────────────────

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

export function randomIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

// ── Key derivation ─────────────────────────────────────────────────────────────

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const passphraseBytes = enc.encode(passphrase)
  const baseKey = await crypto.subtle.importKey('raw', passphraseBytes.buffer as ArrayBuffer, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────────────

export async function encryptPayload(data: VaultPayload, key: CryptoKey, iv?: Uint8Array): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const nonce = iv ?? crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer }, key, plaintext.buffer as ArrayBuffer)
  return { iv: nonce, ciphertext }
}

export async function decryptPayload(ciphertext: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<VaultPayload> {
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, ciphertext)
  return JSON.parse(new TextDecoder().decode(plaintext)) as VaultPayload
}

// ── Binary vault format ────────────────────────────────────────────────────────

/**
 * On-disk binary layout:
 * [magic 4B][version 1B][iterations 4B][salt 32B][algo 1B][iv 12B][ciphertext nB]
 *
 * The AES-GCM auth tag (16 bytes) is appended by SubtleCrypto as the last
 * 16 bytes of the ciphertext buffer; we don't manage it separately.
 */
export function buildVaultBuffer(salt: Uint8Array, iv: Uint8Array, ciphertext: ArrayBuffer): ArrayBuffer {
  const iterBytes = new Uint8Array(4)
  new DataView(iterBytes.buffer).setUint32(0, PBKDF2_ITERATIONS, false)

  const parts = [MAGIC_BYTES, new Uint8Array([FORMAT_VERSION]), iterBytes, salt, new Uint8Array([ALGO_BYTE]), iv, new Uint8Array(ciphertext)]

  const total = parts.reduce((acc, p) => acc + p.byteLength, 0)
  const buffer = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    buffer.set(part, offset)
    offset += part.byteLength
  }
  return buffer.buffer
}

export interface ParsedVault {
  iterations: number
  salt: Uint8Array
  iv: Uint8Array
  ciphertext: ArrayBuffer
}

export function parseVaultBuffer(buffer: ArrayBuffer): ParsedVault {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  if (bytes[0] !== 0x46 || bytes[1] !== 0x4f || bytes[2] !== 0x4c || bytes[3] !== 0x49) {
    throw new Error('Not a valid Folio vault file')
  }

  const iterations = view.getUint32(5, false)
  const salt = bytes.slice(9, 9 + SALT_LENGTH)
  const iv = bytes.slice(42, 42 + IV_LENGTH)
  const ciphertext = buffer.slice(54)

  return { iterations, salt, iv, ciphertext }
}
