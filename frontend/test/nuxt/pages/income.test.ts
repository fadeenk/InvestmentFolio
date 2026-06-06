import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import IncomePage from '~/pages/income.vue'
import { useVaultStore } from '~/stores/vault.store'
import { CostBasisMethod, DateFormat, Theme, TransactionType } from '~/types/enums'
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
      lastSavedAt: null,
    },
  }
}

function mountPage() {
  return mount(IncomePage, {
    global: {
      stubs: {
        UCard: {
          template: '<section><header><slot name="header" /></header><div><slot /></div></section>',
        },
        UButton: {
          props: ['label'],
          template: '<button>{{ label }}</button>',
        },
      },
    },
  })
}

describe('income page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const vault = useVaultStore()
    vault.payload = createPayload()
    vault.status = VaultStatus.UNLOCKED
  })

  it('renders income summaries and monthly grid', () => {
    const vault = useVaultStore()
    vault.payload!.dividends = [
      {
        id: 'inc-1',
        accountId: 'acc-1',
        transactionId: 'tx-1',
        date: '2026-02-01',
        symbol: 'AAPL',
        incomeType: TransactionType.Dividend,
        amount: 25,
        taxYear: 2026,
      },
    ]

    const wrapper = mountPage()
    const text = wrapper.text()

    expect(text).toContain('Income')
    expect(text).toContain('Year-over-year')
    expect(text).toContain('Income by security')
    expect(text).toContain('AAPL')
    expect(text).toContain('Monthly calendar grid')
  })
})
