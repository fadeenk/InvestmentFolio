<script setup lang="ts">
import { computed } from 'vue'
import { CHART_SERIES_VARS, chartSeriesSoftVar } from '~/utils/chartPalette'

export interface IncomeByYearEntry {
  year: number
  accounts: { accountName: string; dividends: number; interest: number }[]
}

const props = defineProps<{
  data: IncomeByYearEntry[]
}>()

const divPalette = CHART_SERIES_VARS

const intPalette = CHART_SERIES_VARS.map((_, i) => chartSeriesSoftVar(i))

const categories = computed(() => props.data.map((entry) => String(entry.year)))

const chartSeries = computed(() => {
  const allAccounts = new Set<string>()
  for (const entry of props.data) {
    for (const acct of entry.accounts) {
      allAccounts.add(acct.accountName)
    }
  }
  const accountList = Array.from(allAccounts).sort()
  const colorMap = new Map<string, { div: string; int: string }>()
  accountList.forEach((name, i) => {
    const idx = i % divPalette.length
    colorMap.set(name, { div: divPalette[idx]!, int: intPalette[idx]! })
  })

  const dividendsSeries = accountList.map((name) => ({
    name: `${name} · Div`,
    data: props.data.map((entry) => {
      const acct = entry.accounts.find((a) => a.accountName === name)
      return acct?.dividends ?? 0
    }),
    color: colorMap.get(name)!.div,
    group: 'dividends' as const,
  }))

  const interestSeries = accountList.map((name) => ({
    name: `${name} · Int`,
    data: props.data.map((entry) => {
      const acct = entry.accounts.find((a) => a.accountName === name)
      return acct?.interest ?? 0
    }),
    color: colorMap.get(name)!.int,
    group: 'interest' as const,
  }))

  return [...dividendsSeries, ...interestSeries]
})

const hasData = computed(() => categories.value.length > 0 && props.data.some((entry) => entry.accounts.length > 0))
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Income by year</span>
    </div>
    <ApexStackedBar v-if="hasData" :categories="categories" :series="chartSeries" />
    <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
  </div>
</template>
