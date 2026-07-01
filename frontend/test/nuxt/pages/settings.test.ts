import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from '~/pages/settings.vue'
import { useVaultStore } from '~/stores/vault.store'
import { useDataStore } from '~/stores/data.store'
import { CostBasisMethod, DateFormat, Theme, TimeRange } from '~/types/enums'
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
        defaultTimeRange: TimeRange.YTD,
      },
      costBasisMethodByAccount: {},
      lastSavedAt: null,
    },
  }
}

function mountPage() {
  return mount(SettingsPage, {
    global: {
      stubs: {
        NuxtLink: { template: '<a><slot /></a>' },
        UButton: {
          props: ['label', 'disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
        },
        USelect: {
          props: ['modelValue', 'items', 'value'],
          template:
            '<select :value="modelValue ?? value"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
        },
        UInput: {
          props: ['modelValue', 'type', 'placeholder'],
          emits: ['update:modelValue'],
          template:
            '<input :type="type ?? \'text\'" :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
      },
    },
  })
}

describe('settings page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const vault = useVaultStore()
    vault.payload = createPayload()
    vault.status = VaultStatus.UNLOCKED
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
  })

  it('renders settings sections', () => {
    const wrapper = mountPage()
    const text = wrapper.text()

    expect(text).toContain('Transaction import')
    expect(text).toContain('Account management')
    expect(text).toContain('Vault management')
    expect(text).toContain('Display preferences')
    expect(text).toContain('Change passphrase')
  })

  it('calls vault passphrase update when form is valid', async () => {
    const vault = useVaultStore()
    const changeSpy = vi.spyOn(vault, 'changePassphrase').mockResolvedValue(undefined)

    const wrapper = mountPage()
    const passInputs = wrapper.findAll('input[type="password"]')
    await passInputs[0]!.setValue('old-passphrase')
    await passInputs[1]!.setValue('new-passphrase')
    await passInputs[2]!.setValue('new-passphrase')

    const button = wrapper.findAll('button').find((item) => item.text() === 'Change passphrase')
    expect(button).toBeTruthy()
    await button!.trigger('click')

    expect(changeSpy).toHaveBeenCalledWith('old-passphrase', 'new-passphrase')
    expect(wrapper.text()).toContain('Passphrase updated successfully.')
  })

  it('shows validation error when confirmation does not match', async () => {
    const vault = useVaultStore()
    const changeSpy = vi.spyOn(vault, 'changePassphrase').mockResolvedValue(undefined)

    const wrapper = mountPage()
    const passInputs = wrapper.findAll('input[type="password"]')
    await passInputs[0]!.setValue('old-passphrase')
    await passInputs[1]!.setValue('new-passphrase')
    await passInputs[2]!.setValue('different')

    const button = wrapper.findAll('button').find((item) => item.text() === 'Change passphrase')
    await button!.trigger('click')

    expect(changeSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('New passphrase and confirmation do not match.')
  })

  it('triggers rebuildLedger on confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const dataStore = useDataStore()
    let rebuildCalled = false
    dataStore.rebuildLedger = async () => {
      rebuildCalled = true
    }

    const wrapper = mountPage()
    const button = wrapper.findAll('button').find((item) => item.text() === 'Rebuild ledger')
    await button!.trigger('click')

    expect(rebuildCalled).toBe(true)
  })
})
