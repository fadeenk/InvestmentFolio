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
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-4">
    <div class="flex items-center justify-between">
      <UButton label="Dashboard" to="/dashboard" color="neutral" variant="ghost" size="xs" />
    </div>

    <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
      <div class="grid gap-3 sm:grid-cols-2">
        <USelect v-model="selectedYear" :items="availableYears.map((y) => ({ label: String(y), value: y }))" size="xs" variant="outline" color="neutral" />
        <USelect
          v-model="selectedAccountId"
          :items="[{ label: 'All accounts', value: 'ALL' }, ...dataStore.allAccounts.map((a) => ({ label: a.displayName, value: a.id }))]"
          size="xs"
          variant="outline"
          color="neutral"
        />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
        <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Income total ({{ selectedYear }})</p>
        <p class="text-lg font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(totals.total) }}</p>
      </div>
      <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
        <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Dividends</p>
        <p class="text-lg font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(totals.dividend) }}</p>
      </div>
      <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
        <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Interest</p>
        <p class="text-lg font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(totals.interest) }}</p>
      </div>
    </div>

    <div class="overflow-hidden rounded-sm border border-(--ui-border)">
      <div class="border-b border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-1.5">
        <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Year-over-year</span>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th class="text-2xs px-3 py-2 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Year</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Total dividends</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Total interest</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Total income</th>
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
    </div>

    <div class="overflow-hidden rounded-sm border border-(--ui-border)">
      <div class="border-b border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-1.5">
        <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Income by security</span>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th class="text-2xs px-3 py-2 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Symbol</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">YTD total</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Prior year</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Dividend</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Interest</th>
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
    </div>

    <div class="rounded-sm border border-(--ui-border)">
      <div class="border-b border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-1.5">
        <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Monthly Calendar</span>
      </div>
      <div class="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div v-for="month in monthlyGrid" :key="month.month" class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-sm font-semibold">{{ monthLabel(month.month) }}</p>
          <p class="mt-1 text-xs text-(--ui-text-muted)">Dividends</p>
          <p class="text-sm">{{ formatCurrency(month.totalDividends) }}</p>
          <p class="mt-1 text-xs text-(--ui-text-muted)">Interest</p>
          <p class="text-sm">{{ formatCurrency(month.totalInterest) }}</p>
          <p class="mt-2 text-xs text-(--ui-text-muted)">Total</p>
          <p class="text-base font-semibold">{{ formatCurrency(month.total) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
