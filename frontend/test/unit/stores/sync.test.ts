import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSyncStore } from '~/stores/sync.store'
import { useVaultStore } from '~/stores/vault.store'
import { AccountType, Bank, CostBasisMethod, DateFormat, Theme, TransactionType } from '~/types/enums'

function initVault(bank: Bank): void {
  const vaultStore = useVaultStore()
  const now = new Date().toISOString()

  vaultStore.payload = {
    schemaVersion: 1,
    createdAt: now,
    lastSyncedAt: null,
    accounts: [
      {
        id: 'acc-1',
        bank,
        type: AccountType.BROKERAGE,
        displayName: `${bank} Account`,
        accountNumber: '1234',
        currentBalance: 0,
        cashBalance: 0,
        lastUpdatedAt: now,
        isActive: true,
      },
    ],
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
      costBasisMethodByAccount: {},
      lastSavedAt: null,
    },
  }
}

describe('sync store csv import schemas', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('imports OTHER account csv format', async () => {
    initVault(Bank.OTHER)
    const store = useSyncStore()

    const csv = ['Date,type,action,symbol,amount,price,fees,total', '2026-06-01,BUY,BUY,AAPL,2,190.50,1.25,382.25'].join('\n')

    const result = await store.importCsv(new File([csv], 'other.csv', { type: 'text/csv' }), 'acc-1')

    expect(result.errors).toEqual([])
    expect(result.added).toBe(1)

    const tx = useVaultStore().payload?.transactions[0]
    expect(tx?.type).toBe(TransactionType.Buy)
    expect(tx?.symbol).toBe('AAPL')
    expect(tx?.quantity).toBe(2)
    expect(tx?.price).toBe(190.5)
    expect(tx?.fees).toBe(1.25)
  })

  it('imports OPTUM account csv format', async () => {
    initVault(Bank.OPTUM)
    const store = useSyncStore()

    const csv = ['Date,Transaction type,Requested action,Amount,Fund name,Shares,Share price', '2026-06-01,Contribution,BUY,200.00,VTSAX,1.5,133.33'].join('\n')

    const result = await store.importCsv(new File([csv], 'optum.csv', { type: 'text/csv' }), 'acc-1')

    expect(result.errors).toEqual([])
    expect(result.added).toBe(1)

    const tx = useVaultStore().payload?.transactions[0]
    expect(tx?.type).toBe(TransactionType.Buy)
    expect(tx?.symbol).toBe('VTSAX')
    expect(tx?.quantity).toBe(1.5)
    expect(tx?.price).toBe(133.33)
    expect(tx?.fees).toBe(0)
  })

  it('imports SCHWAB account csv format', async () => {
    initVault(Bank.SCHWAB)
    const store = useSyncStore()

    const csv = [
      '"Date","Action","Symbol","Description","Quantity","Price","Fees & Comm","Amount"',
      '"2026-06-01","SELL","MSFT","SELL TRADE","3","420.00","0.65","1260.00"',
    ].join('\n')

    const result = await store.importCsv(new File([csv], 'schwab.csv', { type: 'text/csv' }), 'acc-1')

    expect(result.errors).toEqual([])
    expect(result.added).toBe(1)

    const tx = useVaultStore().payload?.transactions[0]
    expect(tx?.type).toBe(TransactionType.Sell)
    expect(tx?.symbol).toBe('MSFT')
    expect(tx?.quantity).toBe(3)
    expect(tx?.price).toBe(420)
    expect(tx?.fees).toBe(0.65)
  })

  it('parses formatted numeric values with commas, currency symbols, and negatives', async () => {
    initVault(Bank.SCHWAB)
    const store = useSyncStore()

    const csv = [
      '"Date","Action","Symbol","Description","Quantity","Price","Fees & Comm","Amount"',
      '"2026-06-01","SELL","MSFT","SELL TRADE","30,000","$30000.00","$0.22","-30,000"',
    ].join('\n')

    const result = await store.importCsv(new File([csv], 'schwab-formatted.csv', { type: 'text/csv' }), 'acc-1')

    expect(result.errors).toEqual([])
    expect(result.added).toBe(1)

    const tx = useVaultStore().payload?.transactions[0]
    expect(tx?.quantity).toBe(30000)
    expect(tx?.price).toBe(30000)
    expect(tx?.fees).toBe(0.22)
  })

  it('validates required columns for account bank format', async () => {
    initVault(Bank.OPTUM)
    const store = useSyncStore()

    const csv = ['Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount', '2026-06-01,BUY,AAPL,BUY,1,100,0,100'].join('\n')

    const result = await store.importCsv(new File([csv], 'wrong.csv', { type: 'text/csv' }), 'acc-1')

    expect(result.added).toBe(0)
    expect(result.errors[0]).toContain('Missing required CSV columns')
    expect(result.errors[0]).toContain('transaction type')
    expect(result.errors[0]).toContain('requested action')
    expect(result.errors[0]).toContain('fund name')
    expect(result.errors[0]).toContain('shares')
    expect(result.errors[0]).toContain('share price')
  })
})
