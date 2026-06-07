import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOAuthStore } from '~/stores/oauth.store'
import { useUiStore } from '~/stores/ui'
import { useVaultStore } from '~/stores/vault.store'
import { CostBasisMethod, DateFormat, Theme } from '~/types/enums'
import { TokenStatus } from '~/types/vault'

function initVault(): void {
  const vaultStore = useVaultStore()
  const now = new Date().toISOString()

  vaultStore.payload = {
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
    metadata: {
      displayPreferences: {
        theme: Theme.SYSTEM,
        currencyFormat: 'USD',
        dateFormat: DateFormat.MM_DD_YYYY,
        defaultAccountFilter: null,
        defaultCostBasisMethod: CostBasisMethod.FIFO,
        defaultTimeRange: 'YTD',
      },
      schwabTokenMeta: null,
      costBasisMethodByAccount: {},
      lastSavedAt: null,
    },
  }
}

describe('oauth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    const g = globalThis as typeof globalThis & { __FOLIO_WORKER_URL__?: string }
    g.__FOLIO_WORKER_URL__ = 'http://localhost:8787'
  })

  it('polls auth status and marks token as valid', async () => {
    const store = useOAuthStore()

    const now = Date.now()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          isConnected: true,
          accessTokenExpiresAt: new Date(now + 30 * 60_000).toISOString(),
          refreshTokenExpiresAt: new Date(now + 48 * 60 * 60_000).toISOString(),
          accessTokenSecondsRemaining: 1800,
          refreshTokenSecondsRemaining: 172800,
          isRefreshTokenExpiringSoon: false,
          warning: null,
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

  it('marks token as expired and shows a warning banner when refresh endpoint fails', async () => {
    const store = useOAuthStore()
    const uiStore = useUiStore()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 401 }))

    const refreshed = await store.refreshAccessToken()

    expect(refreshed).toBe(false)
    expect(store.tokenStatus).toBe(TokenStatus.EXPIRED)
    expect(uiStore.banner?.type).toBe('warning')
    expect(uiStore.banner?.message).toContain('Re-authorize')
  })

  it('consumes auth callback from query params with connected state', () => {
    const store = useOAuthStore()
    const params = new URLSearchParams('auth=connected')

    store.consumeAuthCallbackFromQuery(params)

    expect(store.callbackMessage).toEqual({
      type: 'success',
      text: 'Schwab account connected successfully.',
    })
  })

  it('consumes auth callback from query params with error state', () => {
    const store = useOAuthStore()
    const params = new URLSearchParams('auth=error&reason=Authorization+was+denied')

    store.consumeAuthCallbackFromQuery(params)

    expect(store.callbackMessage).toEqual({
      type: 'error',
      text: 'Authorization was denied',
    })
  })

  it('clears callback message', () => {
    const store = useOAuthStore()
    store.consumeAuthCallbackFromQuery(new URLSearchParams('auth=connected'))

    expect(store.callbackMessage).not.toBeNull()

    store.clearCallbackMessage()

    expect(store.callbackMessage).toBeNull()
  })

  it('does not set callback message when no auth state in query', () => {
    const store = useOAuthStore()
    store.consumeAuthCallbackFromQuery(new URLSearchParams('other=param'))

    expect(store.callbackMessage).toBeNull()
  })

  it('polls token status on ensureSyncedAfterUnlockOrAuth when unlocked', async () => {
    const store = useOAuthStore()
    const vaultStore = useVaultStore()
    const now = new Date().toISOString()

    vaultStore.payload = {
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
      metadata: {
        displayPreferences: {
          theme: Theme.SYSTEM,
          currencyFormat: 'USD',
          dateFormat: DateFormat.MM_DD_YYYY,
          defaultAccountFilter: null,
          defaultCostBasisMethod: CostBasisMethod.FIFO,
          defaultTimeRange: 'YTD',
        },
        schwabTokenMeta: null,
        costBasisMethodByAccount: {},
        lastSavedAt: null,
      },
    }

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          isConnected: false,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          accessTokenSecondsRemaining: null,
          refreshTokenSecondsRemaining: null,
          isRefreshTokenExpiringSoon: false,
          warning: null,
          connectedAccountCount: 0,
          lastRefreshedAt: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    await store.ensureSyncedAfterUnlockOrAuth()

    expect(store.requiresReauth).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stores token meta in vault on successful poll', async () => {
    const store = useOAuthStore()
    const vaultStore = useVaultStore()
    initVault()

    const now = Date.now()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          isConnected: true,
          accessTokenExpiresAt: new Date(now + 30 * 60_000).toISOString(),
          refreshTokenExpiresAt: new Date(now + 48 * 60 * 60_000).toISOString(),
          accessTokenSecondsRemaining: 1800,
          refreshTokenSecondsRemaining: 172800,
          isRefreshTokenExpiringSoon: false,
          warning: null,
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

    expect(vaultStore.payload?.metadata.schwabTokenMeta).not.toBeNull()
    expect(vaultStore.payload?.metadata.schwabTokenMeta?.connectedAccountCount).toBe(1)
  })
})
