<script setup lang="ts">
import { computed, ref } from 'vue'
import { maskAccountNumber } from '~/utils/accounts'
import { useAccountsStore } from '~/stores/accounts.store'
import { useSyncStore } from '~/stores/sync.store'
import { useVaultStore } from '~/stores/vault.store'
import { AccountType, Bank, CostBasisMethod, DateFormat, Theme, TimeRange } from '~/types/enums'
import type { Account } from '~/types/vault'

const vaultStore = useVaultStore()
const syncStore = useSyncStore()
const accountsStore = useAccountsStore()

const editAccountId = ref<string | null>(null)

const editForm = ref({
  displayName: '',
  accountNumber: '',
  bank: Bank.OTHER,
  type: AccountType.CASH,
  costBasisMethod: CostBasisMethod.FIFO,
  initialBalance: 0,
})

const passphraseForm = ref({
  current: '',
  next: '',
  confirm: '',
})
const passphraseError = ref<string | null>(null)
const passphraseSuccess = ref<string | null>(null)
const passphraseSaving = ref(false)
const importAccountId = ref<string | null>(null)
const importFile = ref<File | null>(null)
const importErrors = ref<string[]>([])

const themeOptions = [Theme.LIGHT, Theme.DARK, Theme.SYSTEM]
const currencyOptions = ['USD']
const dateFormatOptions = [DateFormat.MM_DD_YYYY, DateFormat.DD_MM_YYYY, DateFormat.YYYY_MM_DD]
const timeRangeOptions = [TimeRange.ONE_DAY, TimeRange.ONE_WEEK, TimeRange.ONE_MONTH, TimeRange.THREE_MONTHS, TimeRange.YTD, TimeRange.ONE_YEAR, TimeRange.ALL]
const bankOptions = Object.values(Bank)
const costBasisOptions = Object.values(CostBasisMethod)

const displayPreferences = computed(() => {
  return (
    vaultStore.payload?.metadata.displayPreferences ?? {
      theme: Theme.SYSTEM,
      currencyFormat: 'USD',
      dateFormat: DateFormat.MM_DD_YYYY,
      defaultAccountFilter: null,
      defaultCostBasisMethod: CostBasisMethod.FIFO,
      defaultTimeRange: TimeRange.YTD,
    }
  )
})

const importStatusLabel = computed(() => {
  if (syncStore.isSyncing) return 'Importing'
  if (syncStore.lastError) return 'Error'
  if (vaultStore.payload?.lastSyncSummary) return 'Ready'
  return 'Idle'
})

const orderedAccounts = computed(() => accountsStore.all)

const accountOptions = computed(() => {
  return [
    {
      id: 'ALL',
      label: 'All accounts',
    },
    ...accountsStore.all.map((account) => ({
      id: account.id,
      label: account.displayName,
    })),
  ]
})

function updateDisplayPreference<K extends keyof typeof displayPreferences.value>(key: K, value: (typeof displayPreferences.value)[K]): void {
  vaultStore.mutatePayload((payload) => {
    payload.metadata.displayPreferences[key] = value
  })
}

function resetForm(): void {
  editAccountId.value = null
  editForm.value = {
    displayName: '',
    accountNumber: '',
    bank: Bank.OTHER,
    type: AccountType.CASH,
    costBasisMethod: CostBasisMethod.FIFO,
    initialBalance: 0,
  }
}

function startEdit(account: Account): void {
  editAccountId.value = account.id
  const payload = vaultStore.payload
  const costBasisMethod =
    payload?.metadata.costBasisMethodByAccount[account.id] ?? payload?.metadata.displayPreferences.defaultCostBasisMethod ?? CostBasisMethod.FIFO
  editForm.value = {
    displayName: account.displayName,
    accountNumber: account.accountNumber,
    bank: account.bank,
    type: account.type,
    costBasisMethod,
    initialBalance: 0,
  }
}

function saveEdit(): void {
  if (!editAccountId.value) return
  if (!editForm.value.displayName || !editForm.value.accountNumber) return

  accountsStore.updateAccount(editAccountId.value, {
    displayName: editForm.value.displayName,
    accountNumber: editForm.value.accountNumber,
    bank: editForm.value.bank,
    type: editForm.value.type,
  })
  vaultStore.mutatePayload((p) => {
    if (editAccountId.value) {
      p.metadata.costBasisMethodByAccount[editAccountId.value] = editForm.value.costBasisMethod
    }
  })
  resetForm()
}

function addAccount(): void {
  if (!editForm.value.displayName || !editForm.value.accountNumber) return

  const accountId = accountsStore.addAccount({
    bank: editForm.value.bank,
    type: editForm.value.type,
    displayName: editForm.value.displayName,
    accountNumber: editForm.value.accountNumber,
    initialBalance: Number(editForm.value.initialBalance) || 0,
  })

  vaultStore.mutatePayload((p) => {
    p.metadata.costBasisMethodByAccount[accountId] = editForm.value.costBasisMethod
  })

  resetForm()
}

function moveAccount(accountId: string, direction: -1 | 1): void {
  const ids = [...orderedAccounts.value.map((account) => account.id)]
  const index = ids.findIndex((id) => id === accountId)
  if (index === -1) return

  const target = index + direction
  if (target < 0 || target >= ids.length) return

  const temp = ids[index]
  ids[index] = ids[target]!
  ids[target] = temp!

  accountsStore.reorderAccounts(ids)
}

function exportVaultJson(): void {
  if (!vaultStore.payload) return

  const blob = new Blob([JSON.stringify(vaultStore.payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ifolio-vault-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function onImportFileChange(event: Event): void {
  const target = event.target as HTMLInputElement
  importFile.value = target.files?.[0] ?? null
}

async function importTransactions(): Promise<void> {
  importErrors.value = []

  if (!importAccountId.value) {
    importErrors.value = ['Select an account for the import.']
    return
  }

  if (!importFile.value) {
    importErrors.value = ['Select a CSV file to import.']
    return
  }

  const result = await syncStore.importCsv(importFile.value, importAccountId.value)
  importErrors.value = result.errors
}

function clearVaultData(): void {
  const shouldDelete = window.confirm('Delete all vault data from memory? This cannot be undone.')
  if (!shouldDelete) return

  vaultStore.mutatePayload((payload) => {
    payload.accounts = []
    payload.positions = []
    payload.transactions = []
    payload.taxLots = []
    payload.dividends = []
    payload.priceHistory = {}
    payload.lastSyncedAt = null
  })
}

async function changePassphrase(): Promise<void> {
  passphraseError.value = null
  passphraseSuccess.value = null

  if (!passphraseForm.value.current || !passphraseForm.value.next || !passphraseForm.value.confirm) {
    passphraseError.value = 'All passphrase fields are required.'
    return
  }

  if (passphraseForm.value.next.length < 8) {
    passphraseError.value = 'New passphrase must be at least 8 characters.'
    return
  }

  if (passphraseForm.value.next !== passphraseForm.value.confirm) {
    passphraseError.value = 'New passphrase and confirmation do not match.'
    return
  }

  if (passphraseForm.value.current === passphraseForm.value.next) {
    passphraseError.value = 'New passphrase must be different from current passphrase.'
    return
  }

  passphraseSaving.value = true

  try {
    await vaultStore.changePassphrase(passphraseForm.value.current, passphraseForm.value.next)
    passphraseForm.value = {
      current: '',
      next: '',
      confirm: '',
    }
    passphraseSuccess.value = 'Passphrase updated successfully.'
  } catch (error) {
    passphraseError.value = error instanceof Error ? error.message : 'Passphrase update failed.'
  } finally {
    passphraseSaving.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Settings</h1>
        <p class="text-sm text-(--ui-text-muted)">Transaction imports, account management, vault controls, and display preferences.</p>
      </div>
      <UButton label="Dashboard" to="/dashboard" color="neutral" variant="outline" />
    </div>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Transaction import</h2>
      </template>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-(--ui-border) p-3">
          <p class="text-sm text-(--ui-text-muted)">Status</p>
          <p class="text-base font-semibold">{{ importStatusLabel }}</p>
        </div>

        <div class="rounded-md border border-(--ui-border) p-3">
          <p class="text-sm text-(--ui-text-muted)">Last import</p>
          <p class="text-base font-semibold">
            {{ vaultStore.payload?.lastSyncSummary?.completedAt ? new Date(vaultStore.payload.lastSyncSummary.completedAt).toLocaleString() : 'Never' }}
          </p>
        </div>

        <div class="rounded-md border border-(--ui-border) p-3">
          <p class="text-sm text-(--ui-text-muted)">Imported rows</p>
          <p class="text-base font-semibold">{{ vaultStore.payload?.lastSyncSummary?.transactionsAdded ?? 0 }}</p>
        </div>

        <div class="rounded-md border border-(--ui-border) p-3">
          <p class="text-sm text-(--ui-text-muted)">Deduplicated</p>
          <p class="text-base font-semibold">{{ vaultStore.payload?.lastSyncSummary?.deduplicatedCount ?? 0 }}</p>
        </div>
      </div>

      <div v-if="syncStore.expirationWarning" class="mt-3 rounded-md bg-amber-500/15 p-2 text-sm text-amber-700 dark:text-amber-200">
        Import currently in progress.
      </div>

      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <select v-model="importAccountId" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
          <option :value="null">Select account</option>
          <option v-for="account in accountsStore.all" :key="account.id" :value="account.id">{{ account.displayName }}</option>
        </select>
        <input type="file" accept=".csv,text/csv" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" @change="onImportFileChange" />
      </div>

      <div v-if="importErrors.length > 0" class="mt-3 rounded-md bg-red-500/15 p-2 text-sm text-red-700 dark:text-red-200">
        {{ importErrors.join(' ') }}
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <UButton label="Import CSV" color="primary" :loading="syncStore.isSyncing" @click="importTransactions" />
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Account management</h2>
      </template>

      <div class="space-y-3">
        <div v-for="(account, index) in orderedAccounts" :key="account.id" class="rounded-md border border-(--ui-border) p-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="font-medium">{{ account.displayName }}</p>
              <p class="text-xs text-(--ui-text-muted)">{{ account.bank }} · {{ account.type }} · {{ maskAccountNumber(account.accountNumber) }}</p>
            </div>

            <div class="flex gap-2">
              <UButton label="Edit" size="xs" color="neutral" variant="outline" @click="startEdit(account)" />
              <UButton label="Up" size="xs" color="neutral" variant="outline" :disabled="index === 0" @click="moveAccount(account.id, -1)" />
              <UButton
                label="Down"
                size="xs"
                color="neutral"
                variant="outline"
                :disabled="index === orderedAccounts.length - 1"
                @click="moveAccount(account.id, 1)"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 rounded-md border border-(--ui-border) p-3">
        <p class="mb-3 text-sm font-medium">{{ editAccountId ? 'Edit account' : 'Add account' }}</p>

        <div class="grid gap-3 md:grid-cols-2">
          <input v-model="editForm.displayName" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" placeholder="Display name" />
          <input v-model="editForm.accountNumber" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" placeholder="Account number" />

          <select v-model="editForm.bank" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
            <option v-for="bank in bankOptions" :key="bank" :value="bank">{{ bank }}</option>
          </select>

          <select v-model="editForm.type" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
            <option v-for="type in Object.values(AccountType)" :key="type" :value="type">{{ type }}</option>
          </select>

          <select v-model="editForm.costBasisMethod" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
            <option v-for="option in costBasisOptions" :key="option" :value="option">{{ option }}</option>
          </select>

          <input
            v-if="!editAccountId"
            v-model.number="editForm.initialBalance"
            class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            placeholder="Initial balance"
            type="number"
            step="0.01"
          />
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <UButton :label="editAccountId ? 'Save changes' : 'Add account'" color="primary" @click="editAccountId ? saveEdit() : addAccount()" />
          <UButton v-if="editAccountId" label="Cancel" color="neutral" variant="outline" @click="resetForm" />
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Vault management</h2>
      </template>

      <div class="mb-4 rounded-md border border-(--ui-border) p-3">
        <p class="mb-3 text-sm font-medium">Change passphrase</p>

        <div class="grid gap-3 md:grid-cols-3">
          <input
            v-model="passphraseForm.current"
            class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            placeholder="Current passphrase"
            type="password"
          />
          <input
            v-model="passphraseForm.next"
            class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            placeholder="New passphrase"
            type="password"
          />
          <input
            v-model="passphraseForm.confirm"
            class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            placeholder="Confirm new passphrase"
            type="password"
          />
        </div>

        <div v-if="passphraseError" class="mt-3 rounded-md bg-red-500/15 p-2 text-sm text-red-700 dark:text-red-200">{{ passphraseError }}</div>
        <div v-if="passphraseSuccess" class="mt-3 rounded-md bg-emerald-500/15 p-2 text-sm text-emerald-700 dark:text-emerald-200">{{ passphraseSuccess }}</div>

        <div class="mt-3">
          <UButton :label="passphraseSaving ? 'Updating...' : 'Change passphrase'" color="primary" :disabled="passphraseSaving" @click="changePassphrase" />
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton label="Export vault JSON" color="neutral" variant="outline" @click="exportVaultJson" />
        <UButton label="Delete vault data" color="error" variant="outline" @click="clearVaultData" />
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Display preferences</h2>
      </template>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Theme</span>
          <select
            :value="displayPreferences.theme"
            class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            @change="updateDisplayPreference('theme', ($event.target as HTMLSelectElement).value as Theme)"
          >
            <option v-for="theme in themeOptions" :key="theme" :value="theme">{{ theme }}</option>
          </select>
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Currency format</span>
          <select
            :value="displayPreferences.currencyFormat"
            class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            @change="updateDisplayPreference('currencyFormat', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="currency in currencyOptions" :key="currency" :value="currency">{{ currency }}</option>
          </select>
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Date format</span>
          <select
            :value="displayPreferences.dateFormat"
            class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            @change="updateDisplayPreference('dateFormat', ($event.target as HTMLSelectElement).value as DateFormat)"
          >
            <option v-for="format in dateFormatOptions" :key="format" :value="format">{{ format }}</option>
          </select>
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Default account filter</span>
          <select
            :value="displayPreferences.defaultAccountFilter ?? 'ALL'"
            class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            @change="
              updateDisplayPreference(
                'defaultAccountFilter',
                ($event.target as HTMLSelectElement).value === 'ALL' ? null : ($event.target as HTMLSelectElement).value,
              )
            "
          >
            <option v-for="account in accountOptions" :key="account.id" :value="account.id">{{ account.label }}</option>
          </select>
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Default cost basis</span>
          <select
            :value="displayPreferences.defaultCostBasisMethod"
            class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            @change="updateDisplayPreference('defaultCostBasisMethod', ($event.target as HTMLSelectElement).value as CostBasisMethod)"
          >
            <option v-for="option in costBasisOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Default time range</span>
          <select
            :value="displayPreferences.defaultTimeRange"
            class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            @change="updateDisplayPreference('defaultTimeRange', ($event.target as HTMLSelectElement).value as TimeRange)"
          >
            <option v-for="range in timeRangeOptions" :key="range" :value="range">{{ range }}</option>
          </select>
        </label>
      </div>
    </UCard>
  </div>
</template>
