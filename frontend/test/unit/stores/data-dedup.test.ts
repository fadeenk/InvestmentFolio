import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDataStore } from '~/stores/data.store'
import { useVaultStore } from '~/stores/vault.store'
import { AccountType, AssetType, Bank, CostBasisMethod, DateFormat, ImportSource, Theme, TransactionType } from '~/types/enums'
import type { Transaction } from '~/types/vault'

function initVaultTwoAccounts(): void {
  const vaultStore = useVaultStore()
  const now = new Date().toISOString()
  vaultStore.payload = {
    schemaVersion: 1,
    createdAt: now,
    lastSyncedAt: null,
    accounts: [
      {
        id: 'acc-a',
        bank: Bank.SCHWAB,
        type: AccountType.BROKERAGE,
        displayName: 'Account A',
        accountNumber: '1111',
        currentBalance: 0,
        cashBalance: 0,
        lastUpdatedAt: now,
        isActive: true,
      },
      {
        id: 'acc-b',
        bank: Bank.SCHWAB,
        type: AccountType.BROKERAGE,
        displayName: 'Account B',
        accountNumber: '2222',
        currentBalance: 0,
        cashBalance: 0,
        lastUpdatedAt: now,
        isActive: true,
      },
    ],
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
      lastSavedAt: null,
    },
  }
}

function dividendRow(accountId: string, price: number, symbol = 'SCHWAB US BROAD MARKET ETF'): Omit<Transaction, 'id' | 'importedAt'> {
  return {
    externalId: null,
    accountId,
    type: TransactionType.Dividend,
    assetType: AssetType.Stock,
    symbol,
    description: 'QUALIFIED DIVIDEND',
    quantity: null,
    price,
    date: '2026-06-15T00:00:00.000Z',
    fees: 0,
    importSource: ImportSource.CSV_IMPORT,
    notes: null,
    matchedLotIds: [],
  }
}

describe('csv dedup scoping', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('imports same dividend in two accounts with different amounts', () => {
    initVaultTwoAccounts()
    const store = useDataStore()
    const added = store.insertMany([dividendRow('acc-a', 10), dividendRow('acc-b', 25)])
    expect(added).toBe(2)
  })

  it('re-import of identical file into same account adds 0', () => {
    initVaultTwoAccounts()
    const store = useDataStore()
    expect(store.insertMany([dividendRow('acc-a', 10)])).toBe(1)
    expect(store.insertMany([dividendRow('acc-a', 10)])).toBe(0)
  })

  it('dedupes duplicate rows within one batch', () => {
    initVaultTwoAccounts()
    const store = useDataStore()
    expect(store.insertMany([dividendRow('acc-a', 10), dividendRow('acc-a', 10)])).toBe(1)
  })

  it('same date/type/quantity but different symbol is not a duplicate', () => {
    initVaultTwoAccounts()
    const store = useDataStore()
    const added = store.insertMany([dividendRow('acc-a', 10, 'AAA'), dividendRow('acc-a', 10, 'BBB')])
    expect(added).toBe(2)
  })
})
