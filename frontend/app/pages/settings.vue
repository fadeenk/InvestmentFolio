<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAccountsStore } from '~/stores/accounts.store'
import { useSyncStore } from '~/stores/sync.store'
import { useVaultStore } from '~/stores/vault.store'
import { AccountType, Bank, CostBasisMethod, DateFormat, Theme, TimeRange } from '~/types/enums'
import { TokenStatus } from '~/types/vault'

const vaultStore = useVaultStore()
const syncStore = useSyncStore()
const accountsStore = useAccountsStore()

const newAccount = ref({
  displayName: '',
  accountNumber: '',
  bank: Bank.OTHER,
  type: AccountType.CASH,
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

const themeOptions = [Theme.LIGHT, Theme.DARK, Theme.SYSTEM]
const currencyOptions = ['USD']
const dateFormatOptions = [DateFormat.MM_DD_YYYY, DateFormat.DD_MM_YYYY, DateFormat.YYYY_MM_DD]
const costBasisOptions = [CostBasisMethod.FIFO, CostBasisMethod.LIFO, CostBasisMethod.SpecificLot]
const timeRangeOptions = [TimeRange.ONE_DAY, TimeRange.ONE_WEEK, TimeRange.ONE_MONTH, TimeRange.THREE_MONTHS, TimeRange.YTD, TimeRange.ONE_YEAR, TimeRange.ALL]

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

const tokenLabel = computed(() => {
  switch (syncStore.tokenStatus) {
    case TokenStatus.VALID:
      return 'Connected'
    case TokenStatus.EXPIRING_SOON:
      return 'Expiring soon'
    case TokenStatus.EXPIRED:
      return 'Expired'
    default:
      return 'Not connected'
  }
})

const orderedAccounts = computed(() => accountsStore.all)

const accountOptions = computed(() => {
  return [
    {
      id: 'ALL',
      label: 'All accounts',
    },
    ...accountsStore.active.map((account) => ({
      id: account.id,
      label: account.displayName,
    })),
  ]
})

function formatRemaining(secondsRemaining: number | null): string {
  if (secondsRemaining === null) return 'Unknown'
  if (secondsRemaining <= 0) return 'Expired'

  const hours = Math.floor(secondsRemaining / 3600)
  if (hours < 1) return 'Less than 1 hour'
  if (hours < 24) return `${hours}h remaining`

  const days = Math.floor(hours / 24)
  return `${days}d remaining`
}

function updateDisplayPreference<K extends keyof typeof displayPreferences.value>(key: K, value: (typeof displayPreferences.value)[K]): void {
  vaultStore.mutatePayload((payload) => {
    payload.metadata.displayPreferences[key] = value
  })
}

function addAccount(): void {
  if (!newAccount.value.displayName || !newAccount.value.accountNumber) return

  accountsStore.addAccount({
    bank: newAccount.value.bank,
    type: newAccount.value.type,
    displayName: newAccount.value.displayName,
    accountNumber: newAccount.value.accountNumber.slice(-4),
    accountHash: null,
    initialBalance: Number(newAccount.value.initialBalance) || 0,
  })

  newAccount.value = {
    displayName: '',
    accountNumber: '',
    bank: Bank.OTHER,
    type: AccountType.CASH,
    initialBalance: 0,
  }
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

function toggleAccount(accountId: string, isActive: boolean): void {
  if (isActive) {
    accountsStore.deactivateAccount(accountId)
  } else {
    accountsStore.reactivateAccount(accountId)
  }
}

function exportVaultJson(): void {
  if (!vaultStore.payload) return

  const blob = new Blob([JSON.stringify(vaultStore.payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `folio-vault-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
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
        <p class="text-sm text-(--ui-text-muted)">Schwab connection, account management, vault controls, and display preferences.</p>
      </div>
      <UButton label="Dashboard" to="/dashboard" color="neutral" variant="outline" />
    </div>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Schwab connection</h2>
      </template>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-(--ui-border) p-3">
          <p class="text-sm text-(--ui-text-muted)">Status</p>
          <p class="text-base font-semibold">{{ tokenLabel }}</p>
        </div>

        <div class="rounded-md border border-(--ui-border) p-3">
          <p class="text-sm text-(--ui-text-muted)">Connected accounts</p>
          <p class="text-base font-semibold">{{ syncStore.connectedAccountCount }}</p>
        </div>

        <div class="rounded-md border border-(--ui-border) p-3">
          <p class="text-sm text-(--ui-text-muted)">Access token</p>
          <p class="text-base font-semibold">{{ formatRemaining(syncStore.accessTokenSecondsRemaining) }}</p>
        </div>

        <div class="rounded-md border border-(--ui-border) p-3">
          <p class="text-sm text-(--ui-text-muted)">Refresh token</p>
          <p class="text-base font-semibold">{{ formatRemaining(syncStore.refreshTokenSecondsRemaining) }}</p>
        </div>
      </div>

      <div v-if="syncStore.expirationWarning" class="mt-3 rounded-md bg-amber-500/15 p-2 text-sm text-amber-700 dark:text-amber-200">
        Re-authorization is recommended within 24 hours to avoid sync interruptions.
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <UButton label="Refresh status" color="neutral" variant="outline" @click="syncStore.pollTokenStatus" />
        <UButton :label="syncStore.requiresReauth ? 'Connect Schwab' : 'Re-authorize Schwab'" color="primary" @click="syncStore.initiateOAuthFlow" />
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
              <p class="text-xs text-(--ui-text-muted)">
                {{ account.bank }} · {{ account.type }} · ••••{{ account.accountNumber }} · {{ account.isActive ? 'Active' : 'Inactive' }}
              </p>
            </div>

            <div class="flex gap-2">
              <UButton label="Up" size="xs" color="neutral" variant="outline" :disabled="index === 0" @click="moveAccount(account.id, -1)" />
              <UButton
                label="Down"
                size="xs"
                color="neutral"
                variant="outline"
                :disabled="index === orderedAccounts.length - 1"
                @click="moveAccount(account.id, 1)"
              />
              <UButton
                :label="account.isActive ? 'Deactivate' : 'Activate'"
                size="xs"
                :color="account.isActive ? 'warning' : 'primary'"
                variant="outline"
                @click="toggleAccount(account.id, account.isActive)"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 rounded-md border border-(--ui-border) p-3">
        <p class="mb-3 text-sm font-medium">Add account</p>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input v-model="newAccount.displayName" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" placeholder="Display name" />
          <input v-model="newAccount.accountNumber" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" placeholder="Account number" />

          <select v-model="newAccount.bank" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
            <option :value="Bank.OTHER">OTHER</option>
            <option :value="Bank.SCHWAB">SCHWAB</option>
            <option :value="Bank.OPTUM">OPTUM</option>
          </select>

          <select v-model="newAccount.type" class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
            <option :value="AccountType.CASH">CASH</option>
            <option :value="AccountType.BROKERAGE">BROKERAGE</option>
            <option :value="AccountType.ROTH">ROTH</option>
            <option :value="AccountType.TRADITIONAL">TRADITIONAL</option>
            <option :value="AccountType.TRADITIONAL401K">TRADITIONAL 401K</option>
            <option :value="AccountType.Roth401K">401K ROTH</option>
            <option :value="AccountType.HSA">HSA</option>
          </select>

          <input
            v-model.number="newAccount.initialBalance"
            class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            placeholder="Initial balance"
            type="number"
            step="0.01"
          />
        </div>

        <div class="mt-3">
          <UButton label="Add account" color="primary" @click="addAccount" />
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
            @change="updateDisplayPreference('defaultAccountFilter', ($event.target as HTMLSelectElement).value === 'ALL' ? null : ($event.target as HTMLSelectElement).value)"
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
