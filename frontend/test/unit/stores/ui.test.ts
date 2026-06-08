import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '~/stores/ui'
import { useVaultStore } from '~/stores/vault.store'
import { CostBasisMethod, DateFormat, Theme } from '~/types/enums'

describe('ui store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    const vault = useVaultStore()
    const now = new Date().toISOString()

    vault.payload = {
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
  })

  it('should toggle sidebar', () => {
    const store = useUiStore()
    expect(store.sidebarOpen).toBe(false)
    store.toggleSidebar()
    expect(store.sidebarOpen).toBe(true)
  })

  it('should open and close modal', () => {
    const store = useUiStore()
    store.openModal('settings')
    expect(store.activeModal).toBe('settings')
    store.closeModal()
    expect(store.activeModal).toBeNull()
  })

  it('should set and clear banner', () => {
    const store = useUiStore()
    store.setBanner('success', 'Connected')
    expect(store.banner).toEqual({ type: 'success', message: 'Connected' })

    store.clearBanner()
    expect(store.banner).toBeNull()
  })

  it('should format dates using configured date format', () => {
    const uiStore = useUiStore()
    const vaultStore = useVaultStore()

    expect(uiStore.formatDate('2026-06-01')).toBe('06/01/2026')

    vaultStore.mutatePayload((payload) => {
      payload.metadata.displayPreferences.dateFormat = DateFormat.DD_MM_YYYY
    })
    expect(uiStore.formatDate('2026-06-01')).toBe('01/06/2026')

    vaultStore.mutatePayload((payload) => {
      payload.metadata.displayPreferences.dateFormat = DateFormat.YYYY_MM_DD
    })
    expect(uiStore.formatDate('2026-06-01')).toBe('2026-06-01')
  })
})
