// ─────────────────────────────────────────────────────────────────────────────
// utils/crypto.ts
//
// Thin wrappers around browser crypto primitives used by the stores.
// All heavy-lifting (vault encrypt/decrypt) lives in vault.store.ts.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random UUID v4.
 * Uses the native crypto.randomUUID() where available (all modern browsers),
 * with a manual fallback for environments that don't support it (e.g. older
 * Node.js versions in unit tests).
 */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // RFC 4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
