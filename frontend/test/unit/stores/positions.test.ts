import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDataStore } from '~/stores/data.store'
import { useVaultStore } from '~/stores/vault.store'
import { useMarketStore } from '~/stores/market.store'
import { AccountType, AssetType, Bank, CostBasisMethod, DateFormat, Theme, TransactionType } from '~/types/enums'
import { TermType } from '~/types/vault'

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
    const store = useDataStore()

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

    expect(store.allPositions).toHaveLength(1)
  })

  it('dedupes identical snapshots within the same incoming batch', () => {
    const store = useDataStore()

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

    expect(store.allPositions).toHaveLength(1)
  })

  it('keeps snapshots when same symbol/account changes', () => {
    const store = useDataStore()

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

    expect(store.allPositions).toHaveLength(2)
  })

  it('rebuildLedger triggers ledger recalculation and market refresh', async () => {
    initVault()
    const store = useDataStore()
    const marketStore = useMarketStore()
    let refreshCalled = false
    marketStore.refreshMarketData = async () => {
      refreshCalled = true
    }

    await store.rebuildLedger()
    expect(refreshCalled).toBe(true)
  })

  it('scopes portfolioSummary YTD realized and income to the selected account', () => {
    const vaultStore = useVaultStore()
    const store = useDataStore()
    const year = new Date().getFullYear()

    vaultStore.payload!.accounts = [
      {
        id: 'acc-1',
        bank: Bank.OTHER,
        type: AccountType.BROKERAGE,
        displayName: 'Acc 1',
        accountNumber: '1111',
        currentBalance: 0,
        cashBalance: 0,
        lastUpdatedAt: '2026-06-05T10:00:00.000Z',
      },
      {
        id: 'acc-2',
        bank: Bank.OTHER,
        type: AccountType.BROKERAGE,
        displayName: 'Acc 2',
        accountNumber: '2222',
        currentBalance: 0,
        cashBalance: 0,
        lastUpdatedAt: '2026-06-05T10:00:00.000Z',
      },
    ]
    vaultStore.payload!.closedLots = [
      {
        id: 'closed-1',
        accountId: 'acc-1',
        symbol: 'AAPL',
        openingLotId: 'lot-1',
        openingTransactionId: 'tx-1',
        closingTransactionId: 'tx-2',
        acquiredDate: `${year}-01-10`,
        soldDate: `${year}-06-01`,
        quantity: 10,
        costBasis: 1000,
        proceeds: 1200,
        realizedGainLoss: 200,
        termType: TermType.SHORT_TERM,
        taxYear: year,
        isWashSale: false,
        washSaleDisallowedLoss: 0,
      },
      {
        id: 'closed-2',
        accountId: 'acc-2',
        symbol: 'MSFT',
        openingLotId: 'lot-2',
        openingTransactionId: 'tx-3',
        closingTransactionId: 'tx-4',
        acquiredDate: `${year}-01-10`,
        soldDate: `${year}-06-01`,
        quantity: 5,
        costBasis: 500,
        proceeds: 800,
        realizedGainLoss: 300,
        termType: TermType.LONG_TERM,
        taxYear: year,
        isWashSale: false,
        washSaleDisallowedLoss: 0,
      },
    ]
    vaultStore.payload!.dividends = [
      {
        id: 'div-1',
        accountId: 'acc-1',
        transactionId: 'tx-5',
        date: `${year}-03-01`,
        symbol: 'AAPL',
        incomeType: TransactionType.Dividend,
        amount: 50,
        taxYear: year,
      },
      {
        id: 'div-2',
        accountId: 'acc-2',
        transactionId: 'tx-6',
        date: `${year}-03-01`,
        symbol: 'MSFT',
        incomeType: TransactionType.Dividend,
        amount: 70,
        taxYear: year,
      },
      {
        id: 'int-1',
        accountId: 'acc-1',
        transactionId: 'tx-7',
        date: `${year}-04-01`,
        symbol: null,
        incomeType: TransactionType.Interest,
        amount: 30,
        taxYear: year,
      },
      {
        id: 'int-2',
        accountId: 'acc-2',
        transactionId: 'tx-8',
        date: `${year}-04-01`,
        symbol: null,
        incomeType: TransactionType.Interest,
        amount: 40,
        taxYear: year,
      },
    ]

    store.selectAccount('acc-1')
    expect(store.portfolioSummary.ytdRealizedGainLossShortTerm).toBe(200)
    expect(store.portfolioSummary.ytdRealizedGainLossLongTerm).toBe(0)
    expect(store.portfolioSummary.ytdDividends).toBe(50)
    expect(store.portfolioSummary.ytdInterest).toBe(30)

    store.selectAccount(null)
    expect(store.portfolioSummary.ytdRealizedGainLossShortTerm).toBe(200)
    expect(store.portfolioSummary.ytdRealizedGainLossLongTerm).toBe(300)
    expect(store.portfolioSummary.ytdDividends).toBe(120)
    expect(store.portfolioSummary.ytdInterest).toBe(70)
  })

  it('filters visibleClosedLots by selected tax year and account', () => {
    const vaultStore = useVaultStore()
    const store = useDataStore()
    const year = new Date().getFullYear()

    vaultStore.payload!.closedLots = [
      {
        id: 'closed-1',
        accountId: 'acc-1',
        symbol: 'AAPL',
        openingLotId: 'lot-1',
        openingTransactionId: 'tx-1',
        closingTransactionId: 'tx-2',
        acquiredDate: `${year}-01-10`,
        soldDate: `${year}-06-01`,
        quantity: 10,
        costBasis: 1000,
        proceeds: 1200,
        realizedGainLoss: 200,
        termType: TermType.SHORT_TERM,
        taxYear: year,
        isWashSale: false,
        washSaleDisallowedLoss: 0,
      },
      {
        id: 'closed-2',
        accountId: 'acc-2',
        symbol: 'MSFT',
        openingLotId: 'lot-2',
        openingTransactionId: 'tx-3',
        closingTransactionId: 'tx-4',
        acquiredDate: `${year}-01-10`,
        soldDate: `${year}-06-01`,
        quantity: 5,
        costBasis: 500,
        proceeds: 800,
        realizedGainLoss: 300,
        termType: TermType.LONG_TERM,
        taxYear: year,
        isWashSale: false,
        washSaleDisallowedLoss: 0,
      },
      {
        id: 'closed-3',
        accountId: 'acc-1',
        symbol: 'AAPL',
        openingLotId: 'lot-3',
        openingTransactionId: 'tx-7',
        closingTransactionId: 'tx-8',
        acquiredDate: `${year - 1}-01-10`,
        soldDate: `${year - 1}-06-01`,
        quantity: 2,
        costBasis: 200,
        proceeds: 250,
        realizedGainLoss: 50,
        termType: TermType.SHORT_TERM,
        taxYear: year - 1,
        isWashSale: false,
        washSaleDisallowedLoss: 0,
      },
    ]

    store.setSelectedTaxYear(year)
    store.selectAccount('acc-1')
    expect(store.visibleClosedLots.map((l) => l.id)).toEqual(['closed-1'])

    store.selectAccount(null)
    expect(store.visibleClosedLots.map((l) => l.id).sort()).toEqual(['closed-1', 'closed-2'])

    store.setSelectedTaxYear(year - 1)
    store.selectAccount(null)
    expect(store.visibleClosedLots.map((l) => l.id)).toEqual(['closed-3'])
  })

  it('includes closed-lot years in availableTaxYears', () => {
    const vaultStore = useVaultStore()
    const store = useDataStore()
    const year = new Date().getFullYear()

    vaultStore.payload!.closedLots = [
      {
        id: 'closed-only-year',
        accountId: 'acc-1',
        symbol: 'AAPL',
        openingLotId: 'lot-9',
        openingTransactionId: 'tx-9',
        closingTransactionId: 'tx-10',
        acquiredDate: `${year - 2}-01-10`,
        soldDate: `${year - 2}-06-01`,
        quantity: 1,
        costBasis: 100,
        proceeds: 150,
        realizedGainLoss: 50,
        termType: TermType.SHORT_TERM,
        taxYear: year - 2,
        isWashSale: false,
        washSaleDisallowedLoss: 0,
      },
    ]

    expect(store.availableTaxYears).toContain(year - 2)
  })

  it('scopes getTaxYearSummary income to the selected account', () => {
    const vaultStore = useVaultStore()
    const store = useDataStore()
    const year = new Date().getFullYear()

    vaultStore.payload!.dividends = [
      {
        id: 'div-1',
        accountId: 'acc-1',
        transactionId: 'tx-5',
        date: `${year}-03-01`,
        symbol: 'AAPL',
        incomeType: TransactionType.Dividend,
        amount: 50,
        taxYear: year,
      },
      {
        id: 'div-2',
        accountId: 'acc-2',
        transactionId: 'tx-6',
        date: `${year}-03-01`,
        symbol: 'MSFT',
        incomeType: TransactionType.Interest,
        amount: 70,
        taxYear: year,
      },
    ]

    store.selectAccount('acc-1')
    const filtered = store.getTaxYearSummary(year)
    expect(filtered.dividends).toBe(50)
    expect(filtered.interest).toBe(0)

    store.selectAccount(null)
    const unfiltered = store.getTaxYearSummary(year)
    expect(unfiltered.dividends).toBe(50)
    expect(unfiltered.interest).toBe(70)
  })

  it('scopes getTaxYearSummary wash-sale losses to the selected account', () => {
    const vaultStore = useVaultStore()
    const store = useDataStore()
    const year = new Date().getFullYear()

    vaultStore.payload!.taxLots = [
      {
        id: 'lot-wash-1',
        accountId: 'acc-1',
        symbol: 'AAPL',
        openingTransactionId: 'tx-1',
        acquiredDate: `${year}-01-10`,
        acquiredPrice: 100,
        originalQuantity: 10,
        remainingQuantity: 0,
        costBasis: 0,
        currentValue: 0,
        unrealizedGainLoss: 0,
        unrealizedGainLossPct: 0,
        daysHeld: 100,
        isLongTerm: false,
        isOpen: false,
        isWashSale: true,
        washSaleDisallowedLoss: 150,
        adjustedCostBasis: 0,
      },
      {
        id: 'lot-wash-2',
        accountId: 'acc-2',
        symbol: 'MSFT',
        openingTransactionId: 'tx-2',
        acquiredDate: `${year}-01-10`,
        acquiredPrice: 200,
        originalQuantity: 5,
        remainingQuantity: 0,
        costBasis: 0,
        currentValue: 0,
        unrealizedGainLoss: 0,
        unrealizedGainLossPct: 0,
        daysHeld: 100,
        isLongTerm: false,
        isOpen: false,
        isWashSale: true,
        washSaleDisallowedLoss: 250,
        adjustedCostBasis: 0,
      },
    ]

    store.selectAccount('acc-1')
    expect(store.getTaxYearSummary(year).washSaleDisallowedLosses).toBe(150)

    store.selectAccount(null)
    expect(store.getTaxYearSummary(year).washSaleDisallowedLosses).toBe(400)
  })
})
