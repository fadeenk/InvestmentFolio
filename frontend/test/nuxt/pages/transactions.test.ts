import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import TransactionsPage from '~/pages/transactions.vue'
import { useVaultStore } from '~/stores/vault.store'
import { AccountType, AssetType, Bank, CostBasisMethod, DateFormat, ImportSource, Theme, TransactionType } from '~/types/enums'
import { VaultStatus, type VaultPayload } from '~/types/vault'

function createPayload(): VaultPayload {
  const now = new Date().toISOString()

  return {
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
      costBasisMethodByAccount: {},
      schwabTokenMeta: null,
      lastSavedAt: null,
    },
  }
}

function mountPage() {
  return mount(TransactionsPage, {
    global: {
      stubs: {
        UCard: {
          template: '<section><header><slot name="header" /></header><div><slot /></div></section>',
        },
        UButton: {
          props: ['label'],
          emits: ['click'],
          template: '<button @click="$emit(\'click\')">{{ label }}</button>',
        },
        UModal: {
          template: '<div><slot name="body" /><slot name="footer" /></div>',
        },
      },
    },
  })
}

describe('transactions page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const vault = useVaultStore()
    vault.payload = createPayload()
    vault.status = VaultStatus.UNLOCKED
  })

  it('renders transaction tabs and rows', () => {
    const vault = useVaultStore()
    vault.payload!.accounts = [
      {
        id: 'acc-1',
        bank: Bank.OTHER,
        type: AccountType.BROKERAGE,
        displayName: 'Manual Account',
        accountNumber: '4321',
        currentBalance: 1000,
        cashBalance: 1000,
        lastUpdatedAt: '2026-06-05T10:00:00.000Z',
      },
    ]

    vault.payload!.transactions = [
      {
        id: 'tx-1',
        externalId: null,
        accountId: 'acc-1',
        type: TransactionType.Buy,
        assetType: AssetType.Stock,
        symbol: 'AAPL',
        description: 'Buy Apple',
        quantity: 2,
        price: 100,
        date: '2026-06-01',
        fees: 1,
        importSource: ImportSource.MANUAL,
        importedAt: '2026-06-01T10:00:00.000Z',
        notes: null,
        matchedLotIds: [],
      },
    ]

    const wrapper = mountPage()
    const text = wrapper.text()

    expect(text).toContain('Transactions')
    expect(text).toContain('Trades')
    expect(text).toContain('AAPL')
    expect(text).toContain('Buy Apple')
  })
})
