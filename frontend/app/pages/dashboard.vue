<script setup lang="ts">
import { computed, ref } from 'vue'
import { useIncomeStore } from '~/stores/income.store'
import { useMarketStore } from '~/stores/market.store'
import { usePositionsStore } from '~/stores/positions.store'
import { useVaultStore } from '~/stores/vault.store'
import { useGoogleSheetsSync } from '~/composables/useGoogleSheetsSync'
import { TimeRange, TransactionType } from '~/types/enums'
import { TermType, VaultStatus } from '~/types/vault'
import type { PortfolioSummary } from '~/types/vault'

const vault = useVaultStore()
const positionsStore = usePositionsStore()
const incomeStore = useIncomeStore()
const marketStore = useMarketStore()

const { state, error, sync, reset } = useGoogleSheetsSync()
const sheetsError = ref<string | null>(null)
const sheetsSuccess = ref(false)

const hasGoogleClientId = computed(() => !!vault.payload?.googleSheetsClientId)

const syncLabel = computed(() => {
  switch (state.value) {
    case 'authenticating':
      return 'Authenticating...'
    case 'loading':
      return 'Syncing...'
    default:
      return 'Sync to Sheets'
  }
})

async function syncToSheets(): Promise<void> {
  sheetsError.value = null
  sheetsSuccess.value = false
  reset()
  await sync()
  if (state.value === 'error') {
    sheetsError.value = error.value
  } else if (state.value === 'success') {
    sheetsSuccess.value = true
    setTimeout(() => {
      sheetsSuccess.value = false
    }, 3000)
  }
}

const isUnlocked = computed(() => vault.status === VaultStatus.UNLOCKED)
const allAccounts = computed(() => vault.accounts)
const accountFilter = computed(() => positionsStore.selectedAccountId)
const selectedTimeRange = computed(() => positionsStore.selectedTimeRange)

const accountNameById = computed(() => {
  return new Map(allAccounts.value.map((account) => [account.id, account.displayName]))
})

const accountOptions = computed(() => {
  return [
    { id: null as string | null, label: 'All' },
    ...allAccounts.value.map((account) => ({
      id: account.id,
      label: account.displayName,
    })),
  ]
})

const timeRangeOptions = [TimeRange.ONE_DAY, TimeRange.ONE_WEEK, TimeRange.ONE_MONTH, TimeRange.THREE_MONTHS, TimeRange.YTD, TimeRange.ONE_YEAR, TimeRange.ALL]

const allAccountsSummary = computed<PortfolioSummary>(() => {
  const positions = positionsStore.latest
  const accounts = vault.accounts ?? []
  const payload = vault.payload

  const totalMarketValue = positions.reduce((s, p) => s + p.marketValue, 0)
  const totalCostBasis = positions.reduce((s, p) => s + p.avgCost * p.quantity, 0)
  const totalUnrealizedGainLoss = positions.reduce((s, p) => s + p.unrealizedGainLoss, 0)
  const totalDayGainLoss = positions.reduce((s, p) => s + p.dayGainLoss, 0)
  const unrealizedPct = totalCostBasis > 0 ? (totalUnrealizedGainLoss / totalCostBasis) * 100 : 0
  const dayPct = totalCostBasis > 0 ? (totalDayGainLoss / (totalMarketValue - totalDayGainLoss)) * 100 : 0
  const totalCashBalance = accounts.reduce((s, a) => s + a.cashBalance, 0)

  const currentYear = new Date().getFullYear()
  const closedLots = payload?.closedLots ?? []
  const ytdRealizedClosed = closedLots.filter((l) => l.taxYear === currentYear)
  const ytdRealizedShort = ytdRealizedClosed.filter((l) => l.termType === TermType.SHORT_TERM).reduce((s, l) => s + l.realizedGainLoss, 0)
  const ytdRealizedLong = ytdRealizedClosed.filter((l) => l.termType === TermType.LONG_TERM).reduce((s, l) => s + l.realizedGainLoss, 0)

  const dividends = payload?.dividends ?? []
  const ytdDividends = dividends.filter((d) => d.taxYear === currentYear && d.incomeType === TransactionType.Dividend).reduce((s, d) => s + d.amount, 0)
  const ytdInterest = dividends.filter((d) => d.taxYear === currentYear && d.incomeType === TransactionType.Interest).reduce((s, d) => s + d.amount, 0)

  return {
    totalMarketValue,
    totalCostBasis,
    totalUnrealizedGainLoss,
    totalUnrealizedGainLossPct: unrealizedPct,
    totalDayGainLoss,
    totalDayGainLossPct: dayPct,
    totalCashBalance,
    ytdRealizedGainLossShortTerm: ytdRealizedShort,
    ytdRealizedGainLossLongTerm: ytdRealizedLong,
    ytdRealizedGainLossTotal: ytdRealizedShort + ytdRealizedLong,
    ytdIncomeTotal: ytdDividends + ytdInterest,
    ytdDividends,
    ytdInterest,
  }
})

const accountsSummary = computed(() => {
  return allAccounts.value.map((account) => {
    const accountPositions = positionsStore.latest.filter((p) => p.accountId === account.id)
    const costBasis = accountPositions.reduce((s, p) => s + p.avgCost * p.quantity, 0)
    const marketValue = accountPositions.reduce((s, p) => s + p.marketValue, 0)
    const gain = marketValue - costBasis
    const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0
    return {
      id: account.id,
      name: account.displayName,
      costBasis,
      cashBalance: account.cashBalance,
      marketValue,
      gain,
      gainPct,
    }
  })
})

const incomeByAccount = computed(() => {
  const records = accountFilter.value ? incomeStore.all.filter((r) => r.accountId === accountFilter.value) : incomeStore.all
  const currentYear = incomeStore.selectedYear
  const priorYear = currentYear - 1

  const byAccount = new Map<string, { currentYear: number; priorYear: number }>()
  for (const r of records) {
    if (!byAccount.has(r.accountId)) {
      byAccount.set(r.accountId, { currentYear: 0, priorYear: 0 })
    }
    const entry = byAccount.get(r.accountId)!
    if (r.taxYear === currentYear) entry.currentYear += r.amount
    if (r.taxYear === priorYear) entry.priorYear += r.amount
  }

  return Array.from(byAccount.entries())
    .map(([accountId, totals]) => ({
      accountId,
      accountName: accountNameById.value.get(accountId) ?? 'Unknown',
      currentYear: totals.currentYear,
      priorYear: totals.priorYear,
    }))
    .filter((entry) => entry.currentYear > 0 || entry.priorYear > 0)
    .sort((a, b) => b.currentYear - a.currentYear)
})

const filteredAccounts = computed(() => {
  if (!accountFilter.value) return allAccounts.value
  return allAccounts.value.filter((a) => a.id === accountFilter.value)
})

const portfolioValueChartData = computed(() => {
  return positionsStore.portfolioValueSeries.map((point) => ({
    date: point.date,
    value: point.totalValue,
  }))
})

const allocationChartData = computed(() => {
  return positionsStore.allocation.map((slice) => ({
    label: slice.label,
    value: slice.marketValue,
  }))
})

function selectAccount(accountId: string | null): void {
  positionsStore.selectAccount(accountId)
}

function selectRange(range: TimeRange): void {
  positionsStore.selectTimeRange(range)
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Dashboard</h1>
        <p class="text-sm text-(--ui-text-muted)">Accounts and latest position snapshots</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          v-if="hasGoogleClientId && isUnlocked"
          :label="syncLabel"
          color="primary"
          variant="outline"
          :loading="state === 'authenticating' || state === 'loading'"
          :disabled="state === 'authenticating' || state === 'loading'"
          @click="syncToSheets"
        />
        <span v-if="sheetsError" class="text-xs text-red-600 dark:text-red-300">{{ sheetsError }}</span>
        <span v-if="sheetsSuccess" class="text-xs text-emerald-600 dark:text-emerald-300">Synced!</span>
        <UButton label="Home" color="neutral" variant="outline" to="/" />
      </div>
    </div>

    <template v-if="!isUnlocked">
      <UCard>
        <div class="space-y-3">
          <p class="text-sm text-(--ui-text-muted)">Unlock your vault to view account and position data.</p>
          <UButton label="Go to vault" color="primary" to="/" />
        </div>
      </UCard>
    </template>

    <template v-else>
      <DashboardOverview :summary="allAccountsSummary" />

      <DashboardFilters
        :account-options="accountOptions"
        :selected-account-id="accountFilter"
        :selected-time-range="selectedTimeRange"
        :time-range-options="timeRangeOptions"
        :is-syncing="marketStore.isSyncing"
        :sync-status="marketStore.syncStatus"
        :last-error="marketStore.lastError"
        @select-account="selectAccount"
        @select-range="selectRange"
        @refresh="marketStore.refreshMarketData()"
      />

      <DashboardAccountsTable :accounts="accountsSummary" />

      <div class="grid gap-4 xl:grid-cols-2">
        <DashboardPortfolioChart :data="portfolioValueChartData" :time-range="selectedTimeRange" />
        <DashboardAllocationChart :data="allocationChartData" />
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <DashboardBalancesChart :accounts="filteredAccounts" />
        <DashboardIncomeChart :data="incomeByAccount" :current-year="incomeStore.selectedYear" :prior-year="incomeStore.selectedYear - 1" />
      </div>
    </template>
  </div>
</template>
