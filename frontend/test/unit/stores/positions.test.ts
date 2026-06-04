import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePositionsStore } from '~/stores/positions.store'
import { useVaultStore } from '~/stores/vault.store'
import { AssetType, CostBasisMethod, DateFormat, Theme } from '~/types/enums'

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
}

describe('positions store dedupe', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    initVault()
  })

  it('skips identical snapshot that already exists', () => {
    const store = usePositionsStore()

    const snapshot = {
      accountId: 'acc-1',
      symbol: 'AAPL',
      assetType: AssetType.Stock,
      quantity: 10,
      avgCost: 100,
      currentPrice: 105,
      marketValue: 1050,
      unrealizedGainLoss: 50,
      unrealizedGainLossPct: 5,
      dayGainLoss: 3,
      dayGainLossPct: 0.29,
      costBasisMethod: CostBasisMethod.FIFO,
      snapshotAt: '2026-06-03T10:00:00.000Z',
    }

    store.upsertSnapshots([snapshot])
    store.upsertSnapshots([snapshot])

    expect(store.all).toHaveLength(1)
  })

  it('dedupes identical snapshots within the same incoming batch', () => {
    const store = usePositionsStore()

    const duplicate = {
      accountId: 'acc-1',
      symbol: 'MSFT',
      assetType: AssetType.Stock,
      quantity: 5,
      avgCost: 300,
      currentPrice: 310,
      marketValue: 1550,
      unrealizedGainLoss: 50,
      unrealizedGainLossPct: 3.33,
      dayGainLoss: 10,
      dayGainLossPct: 0.65,
      costBasisMethod: CostBasisMethod.FIFO,
      snapshotAt: '2026-06-03T10:00:00.000Z',
    }

    store.upsertSnapshots([duplicate, duplicate])

    expect(store.all).toHaveLength(1)
  })

  it('keeps snapshots when same symbol/account changes', () => {
    const store = usePositionsStore()

    const base = {
      accountId: 'acc-1',
      symbol: 'NVDA',
      assetType: AssetType.Stock,
      quantity: 2,
      avgCost: 900,
      marketValue: 1900,
      unrealizedGainLoss: 100,
      unrealizedGainLossPct: 5.56,
      dayGainLoss: 20,
      dayGainLossPct: 1.06,
      costBasisMethod: CostBasisMethod.FIFO,
      snapshotAt: '2026-06-03T10:00:00.000Z',
    }

    store.upsertSnapshots([
      {
        ...base,
        currentPrice: 950,
      },
      {
        ...base,
        currentPrice: 960,
      },
    ])

    expect(store.all).toHaveLength(2)
  })
})
