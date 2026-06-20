import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import DashboardPage from '~/pages/dashboard.vue'
import { useVaultStore } from '~/stores/vault.store'
import { AccountType, AssetType, Bank, CostBasisMethod, DateFormat, Theme } from '~/types/enums'
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

function mountDashboard() {
  return mount(DashboardPage, {
    global: {
      stubs: {
        NuxtLink: { template: '<a><slot /></a>' },
        UButton: {
          props: ['label'],
          template: '<button>{{ label }}</button>',
        },
        DashboardPortfolioChart: { template: '<div />' },
        DashboardAllocationChart: { template: '<div />' },
        DashboardBalancesChart: { template: '<div />' },
        DashboardIncomeChart: { template: '<div />' },
      },
    },
  })
}

describe('dashboard page', () => {
  let wrapper: ReturnType<typeof mountDashboard>

  beforeEach(() => {
    setActivePinia(createPinia())

    const vault = useVaultStore()
    vault.payload = createPayload()
    vault.status = VaultStatus.LOCKED
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('shows unlock prompt when vault is locked', () => {
    wrapper = mountDashboard()

    expect(wrapper.text()).toContain('Unlock your vault to view account and position data.')
    expect(wrapper.text()).toContain('Go to vault')
  })

  it('shows empty-state table messages when unlocked with no data', () => {
    const vault = useVaultStore()
    vault.status = VaultStatus.UNLOCKED

    wrapper = mountDashboard()

    expect(wrapper.text()).not.toContain('Unlock your vault')
    expect(wrapper.text()).toContain('No accounts found.')
  })

  it('renders account and position rows with computed summary values', () => {
    const vault = useVaultStore()
    const payload = createPayload()

    payload.accounts = [
      {
        id: 'acc-1',
        bank: Bank.OTHER,
        type: AccountType.BROKERAGE,
        displayName: 'Main Brokerage',
        accountNumber: '1234',
        currentBalance: 10000,
        cashBalance: 1200,
        lastUpdatedAt: '2026-06-03T10:00:00.000Z',
      },
      {
        id: 'acc-2',
        bank: Bank.OTHER,
        type: AccountType.TRADITIONAL,
        displayName: 'Legacy IRA',
        accountNumber: '9999',
        currentBalance: 5000,
        cashBalance: 300,
        lastUpdatedAt: '2026-06-03T10:00:00.000Z',
      },
    ]

    payload.positions = [
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
        dayGainLoss: 5,
        dayGainLossPct: 0.42,
        costBasisMethod: CostBasisMethod.FIFO,
        snapshotAt: '2026-06-03T10:00:00.000Z',
      },
      {
        id: 'pos-2',
        accountId: 'acc-2',
        symbol: 'MSFT',
        assetType: AssetType.Stock,
        quantity: 5,
        avgCost: 200,
        currentPrice: 240,
        marketValue: 1200,
        unrealizedGainLoss: 200,
        unrealizedGainLossPct: 20,
        dayGainLoss: 4,
        dayGainLossPct: 0.33,
        costBasisMethod: CostBasisMethod.FIFO,
        snapshotAt: '2026-06-03T10:00:00.000Z',
      },
    ]

    vault.payload = payload
    vault.status = VaultStatus.UNLOCKED

    wrapper = mountDashboard()
    const text = wrapper.text()

    expect(text).not.toContain('Unlock your vault')
    expect(text).toContain('Main Brokerage')
    expect(text).toContain('Legacy IRA')
  })
})
