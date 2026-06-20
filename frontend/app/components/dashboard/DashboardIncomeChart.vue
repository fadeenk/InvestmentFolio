<script setup lang="ts">
import { computed } from 'vue'

export interface IncomeByYearEntry {
  year: number
  accounts: { accountName: string; dividends: number; interest: number }[]
}

const props = defineProps<{
  data: IncomeByYearEntry[]
}>()

const divPalette = [
  'var(--color-signal-blue, #40c4ff)',
  'var(--color-signal-green, #4caf50)',
  'var(--color-signal-orange, #ff9800)',
  'var(--color-signal-purple, #ab47bc)',
  'var(--color-signal-cyan, #00bcd4)',
  'var(--color-signal-pink, #e91e63)',
  'var(--color-signal-teal, #009688)',
  'var(--color-signal-indigo, #3f51b5)',
]

const intPalette = ['#40c4ff66', '#4caf5066', '#ff980066', '#ab47bc66', '#00bcd466', '#e91e6366', '#00968866', '#3f51b566']

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
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Income by Year</span>
    </div>
    <ApexStackedBar v-if="hasData" :categories="categories" :series="chartSeries" />
    <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
  </div>
</template>
