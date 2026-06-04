import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncStore } from '~/stores/sync.store'
import { useVaultStore } from '~/stores/vault.store'
import { TokenStatus } from '~/types/vault'
import { CostBasisMethod, DateFormat, Theme } from '~/types/enums'

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

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 401 }))

    const refreshed = await store.refreshAccessToken()

    expect(refreshed).toBe(false)
    expect(store.tokenStatus).toBe(TokenStatus.EXPIRED)
  })

  it('syncs account numbers and positions into vault state', async () => {
    const store = useSyncStore()
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
        schwabAccountHashesByFullNumber: {},
        schwabTokenMeta: null,
        costBasisMethodByAccount: {},
        lastSavedAt: null,
      },
    }

    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            isConnected: true,
            accessTokenExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
            refreshTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
            connectedAccountCount: 1,
            lastRefreshedAt: now,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ accountNumber: '12345678', hashValue: 'hash-1234' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accounts: [
              {
                securitiesAccount: {
                  type: 'MARGIN',
                  accountNumber: '12345678',
                  roundTrips: 0,
                  isDayTrader: false,
                  isClosingOnlyRestricted: false,
                  pfcbFlag: false,
                  positions: [
                    {
                      shortQuantity: 0,
                      averagePrice: 100,
                      currentDayProfitLoss: 5,
                      currentDayProfitLossPercentage: 1,
                      longQuantity: 10,
                      settledLongQuantity: 10,
                      settledShortQuantity: 0,
                      instrument: {
                        assetType: 'EQUITY',
                        symbol: 'AAPL',
                      },
                      marketValue: 1050,
                      maintenanceRequirement: 0,
                      averageLongPrice: 100,
                      averageShortPrice: 0,
                      taxLotAverageLongPrice: 100,
                      taxLotAverageShortPrice: 0,
                      longOpenProfitLoss: 50,
                      shortOpenProfitLoss: 0,
                      previousSessionLongQuantity: 10,
                      previousSessionShortQuantity: 0,
                      currentDayCost: 0,
                    },
                  ],
                  initialBalances: {
                    accruedInterest: 0,
                    cashBalance: 250,
                    cashReceipts: 0,
                    longOptionMarketValue: 0,
                    liquidationValue: 1300,
                    longMarketValue: 1050,
                    moneyMarketFund: 0,
                    savings: 0,
                    shortMarketValue: 0,
                    pendingDeposits: 0,
                    cashAvailableForTrading: 0,
                    cashAvailableForWithdrawal: 0,
                    cashCall: 0,
                    longNonMarginableMarketValue: 0,
                    totalCash: 250,
                    totalEquityPercentage: 0,
                    interestDebtDue: 0,
                    marginBalance: 0,
                    shortBalance: 0,
                    accountValue: 1300,
                  },
                  currentBalances: {
                    accruedInterest: 0,
                    cashBalance: 250,
                    cashReceipts: 0,
                    longOptionMarketValue: 0,
                    liquidationValue: 1300,
                    longMarketValue: 1050,
                    moneyMarketFund: 0,
                    savings: 0,
                    shortMarketValue: 0,
                    pendingDeposits: 0,
                    cashAvailableForTrading: 0,
                    cashAvailableForWithdrawal: 0,
                    cashCall: 0,
                    longNonMarginableMarketValue: 0,
                    totalCash: 250,
                    totalEquityPercentage: 0,
                    interestDebtDue: 0,
                    marginBalance: 0,
                    shortBalance: 0,
                    accountValue: 1300,
                  },
                  projectedBalances: {
                    accruedInterest: 0,
                    cashBalance: 250,
                    cashReceipts: 0,
                    longOptionMarketValue: 0,
                    liquidationValue: 1300,
                    longMarketValue: 1050,
                    moneyMarketFund: 0,
                    savings: 0,
                    shortMarketValue: 0,
                    pendingDeposits: 0,
                    cashAvailableForTrading: 0,
                    cashAvailableForWithdrawal: 0,
                    cashCall: 0,
                    longNonMarginableMarketValue: 0,
                    totalCash: 250,
                    totalEquityPercentage: 0,
                    interestDebtDue: 0,
                    marginBalance: 0,
                    shortBalance: 0,
                    accountValue: 1300,
                  },
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ transactions: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )

    const result = await store.syncSchwab()

    expect(result.accountsSynced).toBe(1)
    expect(result.positionsUpdated).toBe(1)
    expect(result.transactionsAdded).toBe(0)
    expect(vaultStore.payload?.metadata.schwabAccountHashes['5678']).toBe('hash-1234')
    expect(vaultStore.payload?.metadata.schwabAccountHashesByFullNumber['12345678']).toBe('hash-1234')
    expect(vaultStore.payload?.accounts).toHaveLength(1)
    expect(vaultStore.payload?.positions).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/accounts/hash-1234/transactions?startDate='), expect.anything())
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('&endDate='), expect.anything())
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('&types=TRADE%2CRECEIVE_AND_DELIVER'), expect.anything())
  })

  it('does not sync when unlock/auth helper sees reauth required', async () => {
    const store = useSyncStore()
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
        schwabAccountHashesByFullNumber: {},
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
})
