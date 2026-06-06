import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import PositionsPage from '~/pages/positions.vue'
import { useVaultStore } from '~/stores/vault.store'
import { AccountType, AssetType, Bank, CostBasisMethod, DateFormat, SyncMethod, Theme } from '~/types/enums'
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

function mountPage() {
  return mount(PositionsPage, {
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
      },
    },
  })
}

describe('positions page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const vault = useVaultStore()
    vault.payload = createPayload()
    vault.status = VaultStatus.UNLOCKED
  })

  it('renders open positions and cost basis controls', () => {
    const vault = useVaultStore()
    vault.payload!.accounts = [
      {
        id: 'acc-1',
        bank: Bank.OTHER,
        type: AccountType.BROKERAGE,
        displayName: 'Main',
        accountNumber: '1234',
        syncMethod: SyncMethod.Manual,
        currentBalance: 5000,
        cashBalance: 200,
        lastUpdatedAt: '2026-06-05T10:00:00.000Z',
        isActive: true,
      },
    ]
    vault.payload!.positions = [
      {
        id: 'pos-1',
        accountId: 'acc-1',
        symbol: 'AAPL',
        assetType: AssetType.Stock,
        quantity: 10,
        avgCost: 100,
        currentPrice: 120,
        marketValue: 1200,
        unrealizedGainLoss: 200,
        unrealizedGainLossPct: 20,
        dayGainLoss: 8,
        dayGainLossPct: 0.67,
        costBasisMethod: CostBasisMethod.FIFO,
        snapshotAt: '2026-06-05T10:00:00.000Z',
      },
    ]

    const wrapper = mountPage()
    const text = wrapper.text()

    expect(text).toContain('Positions & Tax Lots')
    expect(text).toContain('Cost basis method by account')
    expect(text).toContain('AAPL')
    expect(text).toContain('Open positions')
  })
})
