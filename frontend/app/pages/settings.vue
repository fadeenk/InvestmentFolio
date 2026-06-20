<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { maskAccountNumber } from '~/utils/accounts'
import { useDataStore } from '~/stores/data.store'
import { useMarketStore } from '~/stores/market.store'
import { useOAuthStore } from '~/stores/oauth.store'
import { useSyncStore } from '~/stores/sync.store'
import { useVaultStore } from '~/stores/vault.store'
import { AccountType, Bank, CostBasisMethod, DateFormat, Theme, TimeRange } from '~/types/enums'
import { TokenStatus } from '~/types/vault'
import type { Account } from '~/types/vault'

const vaultStore = useVaultStore()
const oauthStore = useOAuthStore()
const syncStore = useSyncStore()
const dataStore = useDataStore()
const marketStore = useMarketStore()

const editAccountId = ref<string | null>(null)

const editForm = ref({
  displayName: '',
  accountNumber: '',
  bank: Bank.OTHER,
  type: AccountType.CASH,
  costBasisMethod: CostBasisMethod.FIFO,
  initialBalance: 0,
})

const googleSheetsClientId = ref('')
const googleSheetsClientIdSaved = ref(false)

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

watch(
  () => vaultStore.payload?.googleSheetsClientId,
  (val) => {
    googleSheetsClientId.value = val ?? ''
  },
  { immediate: true },
)

function saveGoogleSheetsClientId(): void {
  vaultStore.mutatePayload((p) => {
    p.googleSheetsClientId = googleSheetsClientId.value
  })
  googleSheetsClientIdSaved.value = true
  setTimeout(() => {
    googleSheetsClientIdSaved.value = false
  }, 2000)
}

const origin = computed(() => {
  if (import.meta.client) return window.location.origin
  return ''
})

const importStatusLabel = computed(() => {
  if (syncStore.isSyncing) return 'Importing'
  if (syncStore.lastError) return 'Error'
  if (vaultStore.payload?.lastSyncSummary) return 'Ready'
  return 'Idle'
})

const tokenLabel = computed(() => {
  switch (oauthStore.tokenStatus) {
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

const orderedAccounts = computed(() => dataStore.allAccounts)

const accountOptions = computed(() => {
  return [
    {
      id: 'ALL',
      label: 'All accounts',
    },
    ...dataStore.allAccounts.map((account) => ({
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

  dataStore.updateAccount(editAccountId.value, {
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

  const accountId = dataStore.addAccount({
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
  const accountIds = orderedAccounts.value.map((a) => a.id)
  const index = accountIds.findIndex((id) => id === accountId)
  if (index === -1) return
  const target = index + direction
  if (target < 0 || target >= accountIds.length) return

  const idAtIndex = accountIds[index]
  const idAtTarget = accountIds[target]
  if (idAtIndex === undefined || idAtTarget === undefined) return

  accountIds[index] = idAtTarget
  accountIds[target] = idAtIndex

  dataStore.reorderAccounts(accountIds)
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
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-4">
    <div class="flex items-center justify-between">
      <UButton label="Dashboard" to="/dashboard" color="neutral" variant="ghost" size="xs" />
    </div>

    <!-- Schwab connection section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Schwab connection</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Status</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ tokenLabel }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Connected accounts</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ oauthStore.connectedAccountCount }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Access token</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ formatRemaining(oauthStore.accessTokenSecondsRemaining) }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Refresh token</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ formatRemaining(oauthStore.refreshTokenSecondsRemaining) }}</p>
        </div>
      </div>
      <div
        v-if="oauthStore.expirationWarning"
        :class="
          'mt-3 rounded-sm border ' +
          'border-[var(--color-signal-amber)]/30 bg-[var(--color-signal-amber)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-signal-amber)]'
        "
      >
        Re-authorization is recommended within 24 hours to avoid sync interruptions.
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton label="Refresh status" size="xs" color="neutral" variant="outline" @click="oauthStore.pollTokenStatus" />
        <UButton
          :label="oauthStore.requiresReauth ? 'Connect Schwab' : 'Re-authorize Schwab'"
          size="xs"
          color="primary"
          @click="oauthStore.initiateOAuthFlow"
        />
      </div>
    </section>

    <!-- Transaction import section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Transaction import</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Status</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ importStatusLabel }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Last import</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">
            {{ vaultStore.payload?.lastSyncSummary?.completedAt ? new Date(vaultStore.payload.lastSyncSummary.completedAt).toLocaleString() : 'Never' }}
          </p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Imported rows</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ vaultStore.payload?.lastSyncSummary?.transactionsAdded ?? 0 }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Deduplicated</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ vaultStore.payload?.lastSyncSummary?.deduplicatedCount ?? 0 }}</p>
        </div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <USelect
          v-model="importAccountId"
          :items="[{ label: 'Select account', value: null }, ...dataStore.allAccounts.map((a) => ({ label: a.displayName, value: a.id }))]"
          size="xs"
          variant="outline"
          color="neutral"
        />
        <!-- File input needs native <input> -- UInput doesn't support file type -->
        <input
          type="file"
          accept=".csv,text/csv"
          :class="
            'rounded-sm border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-xs ' +
            'file:mr-3 file:rounded-sm file:border-0 file:bg-(--ui-bg-elevated) file:px-2 file:py-1 file:text-xs file:text-(--ui-text)'
          "
          @change="onImportFileChange"
        />
      </div>
      <div
        v-if="importErrors.length > 0"
        :class="
          'mt-3 rounded-sm border ' +
          'border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-signal-red)]'
        "
      >
        {{ importErrors.join(' ') }}
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton label="Import CSV" size="xs" color="primary" :loading="syncStore.isSyncing" @click="importTransactions" />
      </div>
    </section>

    <!-- Market data section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Market data</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Status</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ marketStore.syncStatus }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Symbols cached</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ Object.keys(vaultStore.payload?.priceHistory ?? {}).length }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">
            {{ marketStore.progress ? `Fetching ${marketStore.progress.current} / ${marketStore.progress.total}` : 'Progress' }}
          </p>
        </div>
      </div>
      <div
        v-if="marketStore.lastError"
        :class="
          'mt-3 rounded-sm border ' +
          'border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-signal-red)]'
        "
      >
        {{ marketStore.lastError }}
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          label="Refresh Prices"
          size="xs"
          color="primary"
          :loading="marketStore.isSyncing"
          :disabled="marketStore.isSyncing"
          @click="marketStore.refreshMarketData()"
        />
      </div>
    </section>

    <!-- Account management section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Account management</h2>
      <div class="space-y-2">
        <div v-for="(account, index) in orderedAccounts" :key="account.id" class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-sm font-medium text-(--ui-text)">{{ account.displayName }}</p>
              <p class="text-2xs text-(--ui-text-muted)">
                {{ account.bank }} &middot; {{ account.type }} &middot; {{ maskAccountNumber(account.accountNumber) }}
              </p>
            </div>
            <div class="flex gap-1">
              <UButton label="Edit" size="xs" color="neutral" variant="ghost" @click="startEdit(account)" />
              <UButton icon="i-lucide-chevron-up" size="xs" color="neutral" variant="ghost" :disabled="index === 0" @click="moveAccount(account.id, -1)" />
              <UButton
                icon="i-lucide-chevron-down"
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="index === orderedAccounts.length - 1"
                @click="moveAccount(account.id, 1)"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- Add/edit form -->
      <div class="mt-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
        <p class="mb-3 text-xs font-medium text-(--ui-text)">{{ editAccountId ? 'Edit account' : 'Add account' }}</p>
        <div class="grid gap-3 md:grid-cols-2">
          <UInput v-model="editForm.displayName" placeholder="Display name" size="xs" variant="outline" color="neutral" />
          <UInput v-model="editForm.accountNumber" placeholder="Account number" size="xs" variant="outline" color="neutral" />
          <USelect v-model="editForm.bank" :items="bankOptions.map((b) => ({ label: b, value: b }))" size="xs" variant="outline" color="neutral" />
          <USelect
            v-model="editForm.type"
            :items="Object.values(AccountType).map((t) => ({ label: t, value: t }))"
            size="xs"
            variant="outline"
            color="neutral"
          />
          <USelect
            v-model="editForm.costBasisMethod"
            :items="costBasisOptions.map((c) => ({ label: c, value: c }))"
            size="xs"
            variant="outline"
            color="neutral"
          />
          <UInput
            v-if="!editAccountId"
            :model-value="editForm.initialBalance"
            placeholder="Initial balance"
            type="number"
            step="0.01"
            size="xs"
            variant="outline"
            color="neutral"
            @update:model-value="editForm.initialBalance = Number($event)"
          />
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <UButton :label="editAccountId ? 'Save changes' : 'Add account'" size="xs" color="primary" @click="editAccountId ? saveEdit() : addAccount()" />
          <UButton v-if="editAccountId" label="Cancel" size="xs" color="neutral" variant="outline" @click="resetForm" />
        </div>
      </div>
    </section>

    <!-- Google Sheets sync section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Google Sheets sync</h2>
      <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
        <p class="mb-3 text-xs text-(--ui-text-muted)">
          Paste your Google OAuth Client ID to enable syncing portfolio balances to the Google Sheet.
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" class="text-(--ui-primary) underline"
            >Create one in Google Cloud Console</a
          >
          (Web application type, authorised JavaScript origin: <code class="text-2xs rounded-sm bg-(--ui-bg) px-1 py-0.5">{{ origin }}</code
          >).
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <UInput
            v-model="googleSheetsClientId"
            placeholder="Paste your Google OAuth Client ID"
            size="xs"
            variant="outline"
            color="neutral"
            class="min-w-0 flex-1"
          />
          <UButton label="Save" size="xs" color="primary" :disabled="!googleSheetsClientId" @click="saveGoogleSheetsClientId" />
        </div>
        <p v-if="googleSheetsClientIdSaved" class="mt-2 text-xs text-[var(--color-accent)]">Saved to vault</p>
      </div>
    </section>

    <!-- Vault management section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Vault management</h2>
      <!-- Change passphrase -->
      <div class="mb-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
        <p class="mb-3 text-xs font-medium text-(--ui-text)">Change passphrase</p>
        <div class="grid gap-3 md:grid-cols-3">
          <UInput v-model="passphraseForm.current" placeholder="Current passphrase" type="password" size="xs" variant="outline" color="neutral" />
          <UInput v-model="passphraseForm.next" placeholder="New passphrase" type="password" size="xs" variant="outline" color="neutral" />
          <UInput v-model="passphraseForm.confirm" placeholder="Confirm new passphrase" type="password" size="xs" variant="outline" color="neutral" />
        </div>
        <div
          v-if="passphraseError"
          :class="
            'mt-3 rounded-sm border ' +
            'border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-signal-red)]'
          "
        >
          {{ passphraseError }}
        </div>
        <div
          v-if="passphraseSuccess"
          :class="
            'mt-3 rounded-sm border ' +
            'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-accent)]'
          "
        >
          {{ passphraseSuccess }}
        </div>
        <div class="mt-3">
          <UButton
            :label="passphraseSaving ? 'Updating...' : 'Change passphrase'"
            size="xs"
            color="primary"
            :disabled="passphraseSaving"
            @click="changePassphrase"
          />
        </div>
      </div>
      <!-- Remembered vault -->
      <div v-if="vaultStore.isRemembered" class="mb-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
        <p class="mb-1 text-xs font-medium text-(--ui-text)">Remembered vault</p>
        <p class="text-xs text-(--ui-text-muted)">
          Last used: <strong>{{ vaultStore.rememberedFileName }}</strong>
        </p>
        <UButton label="Forget this vault" size="xs" color="neutral" variant="outline" class="mt-2" @click="vaultStore.forgetHandle()" />
      </div>
      <!-- Export / Delete -->
      <div class="flex flex-wrap gap-2">
        <UButton label="Export vault JSON" size="xs" color="neutral" variant="outline" @click="exportVaultJson" />
        <UButton label="Delete vault data" size="xs" color="error" variant="outline" @click="clearVaultData" />
      </div>
    </section>

    <!-- Display preferences section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Display preferences</h2>
      <div class="grid gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <p class="mb-1 text-xs text-(--ui-text-muted)">Theme</p>
          <USelect
            :value="displayPreferences.theme"
            :items="themeOptions.map((t) => ({ label: t, value: t }))"
            size="sm"
            variant="outline"
            color="neutral"
            class="w-full"
            @update:model-value="updateDisplayPreference('theme', $event as Theme)"
          />
        </div>
        <div>
          <p class="mb-1 text-xs text-(--ui-text-muted)">Currency format</p>
          <USelect
            :value="displayPreferences.currencyFormat"
            :items="currencyOptions.map((c) => ({ label: c, value: c }))"
            size="sm"
            variant="outline"
            color="neutral"
            class="w-full"
            @update:model-value="updateDisplayPreference('currencyFormat', $event)"
          />
        </div>
        <div>
          <p class="mb-1 text-xs text-(--ui-text-muted)">Date format</p>
          <USelect
            :value="displayPreferences.dateFormat"
            :items="dateFormatOptions.map((d) => ({ label: d, value: d }))"
            size="sm"
            variant="outline"
            color="neutral"
            class="w-full"
            @update:model-value="updateDisplayPreference('dateFormat', $event as DateFormat)"
          />
        </div>
        <div>
          <p class="mb-1 text-xs text-(--ui-text-muted)">Default account filter</p>
          <USelect
            :value="displayPreferences.defaultAccountFilter ?? 'ALL'"
            :items="accountOptions.map((a) => ({ label: a.label, value: a.id }))"
            size="sm"
            variant="outline"
            color="neutral"
            class="w-full"
            @update:model-value="updateDisplayPreference('defaultAccountFilter', $event === 'ALL' ? null : $event)"
          />
        </div>
        <div>
          <p class="mb-1 text-xs text-(--ui-text-muted)">Default cost basis</p>
          <USelect
            :value="displayPreferences.defaultCostBasisMethod"
            :items="costBasisOptions.map((c) => ({ label: c, value: c }))"
            size="sm"
            variant="outline"
            color="neutral"
            class="w-full"
            @update:model-value="updateDisplayPreference('defaultCostBasisMethod', $event as CostBasisMethod)"
          />
        </div>
        <div>
          <p class="mb-1 text-xs text-(--ui-text-muted)">Default time range</p>
          <USelect
            :value="displayPreferences.defaultTimeRange"
            :items="timeRangeOptions.map((r) => ({ label: r, value: r }))"
            size="sm"
            variant="outline"
            color="neutral"
            class="w-full"
            @update:model-value="updateDisplayPreference('defaultTimeRange', $event as TimeRange)"
          />
        </div>
      </div>
    </section>
  </div>
</template>
