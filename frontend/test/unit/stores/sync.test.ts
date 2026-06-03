import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncStore } from '~/stores/sync.store'
import { TokenStatus } from '~/types/vault'

describe('sync store auth workflow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    const g = globalThis as typeof globalThis & { __FOLIO_WORKER_URL__?: string }
    g.__FOLIO_WORKER_URL__ = 'http://localhost:8787'
  })

  it('polls auth status and marks token as valid', async () => {
    const store = useSyncStore()

    const now = Date.now()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          isConnected: true,
          accessTokenExpiresAt: new Date(now + 30 * 60_000).toISOString(),
          refreshTokenExpiresAt: new Date(now + 48 * 60 * 60_000).toISOString(),
          connectedAccountCount: 1,
          lastRefreshedAt: new Date(now).toISOString(),
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )

    await store.pollTokenStatus()

    expect(store.tokenStatus).toBe(TokenStatus.VALID)
    expect(store.accessTokenSecondsRemaining).not.toBeNull()
    expect(store.refreshTokenSecondsRemaining).not.toBeNull()
  })

  it('auto-starts OAuth when sync intent occurs while disconnected', async () => {
    const store = useSyncStore()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          isConnected: false,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          connectedAccountCount: 0,
          lastRefreshedAt: null,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )

    const originalHref = window.location.href

    const result = await store.syncSchwabWithAuth()

    expect(result).toBeNull()
    expect(window.location.href).toBe('http://localhost:8787/auth/login')
    window.location.href = originalHref
  })

  it('marks token as expired when refresh endpoint fails', async () => {
    const store = useSyncStore()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 401 }),
    )

    const refreshed = await store.refreshAccessToken()

    expect(refreshed).toBe(false)
    expect(store.tokenStatus).toBe(TokenStatus.EXPIRED)
  })
})
