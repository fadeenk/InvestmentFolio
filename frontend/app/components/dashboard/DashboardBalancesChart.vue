<script setup lang="ts">
import { computed } from 'vue'
import { VisXYContainer, VisArea, VisAxis } from '@unovis/vue'
import type { Account } from '~/types/vault'
import { formatCurrency } from '~/utils/format'

const props = defineProps<{
  accounts: Account[]
}>()

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#a855f7']

interface SeriesInfo {
  id: string
  name: string
}

interface BalanceRow {
  date: Date
  [key: string]: Date | number
}

const chartConfig = computed(() => {
  const withHistory = props.accounts
  if (!withHistory.length) return { data: [] as BalanceRow[], accessors: [] as ((d: BalanceRow) => number)[], series: [] as SeriesInfo[] }

  const dates = new Set<string>()
  for (const a of withHistory) {
    for (const bp of a.balanceHistory ?? []) {
      dates.add(bp.date)
    }
  }
  const sortedDates = Array.from(dates).sort()

  const balanceIndex = new Map<string, Map<string, number>>()
  for (const a of withHistory) {
    const m = new Map<string, number>()
    if (a.balanceHistory?.length) {
      for (const bp of a.balanceHistory) {
        m.set(bp.date, bp.balance)
      }
    }
    // For accounts without balanceHistory, synthesize a flat series
    // using their currentBalance across all dates.
    if (m.size === 0 && a.currentBalance) {
      for (const date of sortedDates) {
        m.set(date, a.currentBalance)
      }
    }
    balanceIndex.set(a.id, m)
  }

  const series: SeriesInfo[] = withHistory.map((a: Account) => ({ id: a.id, name: a.displayName }))

  const latestByAccount = new Map<string, number>()
  for (const a of withHistory) {
    latestByAccount.set(a.id, 0)
  }

  // Carry each account's most recent known balance forward to avoid false drop-offs to zero.
  const data: BalanceRow[] = sortedDates.map((date: string) => {
    const row: BalanceRow = { date: new Date(date) }
    for (const a of withHistory) {
      const currentValue = balanceIndex.get(a.id)?.get(date)
      if (typeof currentValue === 'number') {
        latestByAccount.set(a.id, currentValue)
      }
      row[a.id] = latestByAccount.get(a.id) ?? 0
    }
    return row
  })

  const accessors = series.map((s: SeriesInfo) => (d: BalanceRow) => d[s.id] as number)

  return { data, accessors, series }
})

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function xTickFormat(d: Date): string {
  return dateFormat.format(d)
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">Account Balances</h2>
    </template>

    <div v-if="chartConfig.data.length > 0" class="h-64 w-full p-4">
      <VisXYContainer :data="chartConfig.data" :height="224" :margin="{ top: 16, right: 16, bottom: 32, left: 48 }">
        <VisArea :x="(d: BalanceRow) => d.date" :y="chartConfig.accessors" :color="(d: unknown, i: number) => COLORS[i % COLORS.length]" />
        <VisAxis type="x" :grid-line="false" :tick-format="xTickFormat" />
        <VisAxis type="y" :num-ticks="6" :tick-format="formatCurrency" />
      </VisXYContainer>
    </div>
    <div v-else class="flex h-64 w-full items-center justify-center text-gray-500">No data available</div>
    <div v-if="chartConfig.series.length > 0" class="flex flex-wrap gap-3 px-4 pb-3">
      <div v-for="(s, i) in chartConfig.series" :key="s.id" class="flex items-center gap-1.5 text-xs text-(--ui-text-muted)">
        <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: COLORS[i % COLORS.length] }" />
        {{ s.name }}
      </div>
    </div>
  </UCard>
</template>
