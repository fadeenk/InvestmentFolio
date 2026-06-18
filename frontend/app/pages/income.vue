<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '~/stores/data.store'
import { TransactionType } from '~/types/enums'
import type { IncomeRecord } from '~/types/vault'

const dataStore = useDataStore()

const selectedYear = computed({
  get: () => dataStore.selectedYear,
  set: (year: number) => dataStore.setSelectedTaxYear(year),
})
const selectedAccountId = ref<string>('ALL')

const availableYears = computed(() => {
  if (dataStore.availableYears.length > 0) return dataStore.availableYears
  return [new Date().getFullYear()]
})

const filteredRecords = computed(() => {
  return dataStore.allIncome.filter((record) => {
    if (record.taxYear !== selectedYear.value) return false
    if (selectedAccountId.value === 'ALL') return true
    return record.accountId === selectedAccountId.value
  })
})

const priorYearRecords = computed(() => {
  return dataStore.allIncome.filter((record) => {
    if (record.taxYear !== selectedYear.value - 1) return false
    if (selectedAccountId.value === 'ALL') return true
    return record.accountId === selectedAccountId.value
  })
})

const totals = computed(() => aggregateIncome(filteredRecords.value))
const priorTotals = computed(() => aggregateIncome(priorYearRecords.value))

const bySymbol = computed(() => {
  const map = new Map<string, { symbol: string; ytdTotal: number; priorYearTotal: number; dividend: number; interest: number }>()

  for (const record of filteredRecords.value) {
    if (!record.symbol) continue
    const item = map.get(record.symbol) ?? {
      symbol: record.symbol,
      ytdTotal: 0,
      priorYearTotal: 0,
      dividend: 0,
      interest: 0,
    }

    item.ytdTotal += record.amount
    if (record.incomeType === TransactionType.Dividend) {
      item.dividend += record.amount
    }
    if (record.incomeType === TransactionType.Interest) {
      item.interest += record.amount
    }

    map.set(record.symbol, item)
  }

  for (const record of priorYearRecords.value) {
    if (!record.symbol) continue
    const item = map.get(record.symbol) ?? {
      symbol: record.symbol,
      ytdTotal: 0,
      priorYearTotal: 0,
      dividend: 0,
      interest: 0,
    }

    item.priorYearTotal += record.amount
    map.set(record.symbol, item)
  }

  return Array.from(map.values()).sort((a, b) => b.ytdTotal - a.ytdTotal)
})

const monthlyGrid = computed(() => {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    totalDividends: 0,
    totalInterest: 0,
    total: 0,
  }))

  for (const record of filteredRecords.value) {
    const monthIndex = Number(record.date.slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) continue

    const month = months[monthIndex]
    if (!month) continue

    if (record.incomeType === TransactionType.Dividend) {
      month.totalDividends += record.amount
    }
    if (record.incomeType === TransactionType.Interest) {
      month.totalInterest += record.amount
    }

    month.total = month.totalDividends + month.totalInterest
  }

  return months
})

function aggregateIncome(records: IncomeRecord[]) {
  return records.reduce(
    (acc, record) => {
      acc.total += record.amount
      if (record.incomeType === TransactionType.Dividend) {
        acc.dividend += record.amount
      }
      if (record.incomeType === TransactionType.Interest) {
        acc.interest += record.amount
      }
      return acc
    },
    {
      total: 0,
      dividend: 0,
      interest: 0,
    },
  )
}

function monthLabel(month: number): string {
  return new Date(selectedYear.value, month - 1, 1).toLocaleString('en-US', { month: 'short' })
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Income</h1>
        <p class="text-sm text-(--ui-text-muted)">Year-over-year totals, by-security breakdown, and monthly calendar grid.</p>
      </div>
      <UButton label="Dashboard" to="/dashboard" color="neutral" variant="outline" />
    </div>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Filters</h2>
      </template>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Year</span>
          <select v-model.number="selectedYear" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
          </select>
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Account</span>
          <select v-model="selectedAccountId" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
            <option value="ALL">All accounts</option>
            <option v-for="account in dataStore.allAccounts" :key="account.id" :value="account.id">{{ account.displayName }}</option>
          </select>
        </label>
      </div>
    </UCard>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard>
        <template #header>
          <p class="text-sm text-(--ui-text-muted)">Income total ({{ selectedYear }})</p>
        </template>
        <p class="text-2xl font-bold">{{ formatCurrency(totals.total) }}</p>
      </UCard>

      <UCard>
        <template #header>
          <p class="text-sm text-(--ui-text-muted)">Dividends</p>
        </template>
        <p class="text-2xl font-bold">{{ formatCurrency(totals.dividend) }}</p>
      </UCard>

      <UCard>
        <template #header>
          <p class="text-sm text-(--ui-text-muted)">Interest</p>
        </template>
        <p class="text-2xl font-bold">{{ formatCurrency(totals.interest) }}</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Year-over-year</h2>
      </template>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Year</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Total dividends</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Total interest</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Total income</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-(--ui-border)/60">
              <td class="px-3 py-2 font-medium">{{ selectedYear }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(totals.dividend) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(totals.interest) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(totals.total) }}</td>
            </tr>
            <tr class="border-b border-(--ui-border)/60">
              <td class="px-3 py-2 font-medium">{{ selectedYear - 1 }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(priorTotals.dividend) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(priorTotals.interest) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(priorTotals.total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Income by security</h2>
      </template>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Symbol</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">YTD total</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Prior year</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Dividend</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Interest</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in bySymbol" :key="row.symbol" class="border-b border-(--ui-border)/60">
              <td class="px-3 py-2 font-medium">{{ row.symbol }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(row.ytdTotal) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(row.priorYearTotal) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(row.dividend) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(row.interest) }}</td>
            </tr>
            <tr v-if="bySymbol.length === 0">
              <td colspan="5" class="px-3 py-6 text-center text-(--ui-text-muted)">No income records for this selection.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Monthly calendar grid</h2>
      </template>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div v-for="month in monthlyGrid" :key="month.month" class="rounded-md border border-(--ui-border) p-3">
          <p class="text-sm font-semibold">{{ monthLabel(month.month) }}</p>
          <p class="mt-1 text-xs text-(--ui-text-muted)">Dividends</p>
          <p class="text-sm">{{ formatCurrency(month.totalDividends) }}</p>
          <p class="mt-1 text-xs text-(--ui-text-muted)">Interest</p>
          <p class="text-sm">{{ formatCurrency(month.totalInterest) }}</p>
          <p class="mt-2 text-xs text-(--ui-text-muted)">Total</p>
          <p class="text-base font-semibold">{{ formatCurrency(month.total) }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>
