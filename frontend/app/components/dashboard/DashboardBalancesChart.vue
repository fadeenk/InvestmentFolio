<script setup lang="ts">
import { computed } from 'vue'
import { VisSingleContainer, VisArea } from '@unovis/vue'
import type { Account } from '~/types/vault'

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
  const withHistory = props.accounts.filter((a: Account) => a.balanceHistory?.length)
  if (!withHistory.length) return { data: [] as BalanceRow[], accessors: [] as ((d: BalanceRow) => number)[], series: [] as SeriesInfo[] }

  const dates = new Set<string>()
  for (const a of withHistory) {
    for (const bp of a.balanceHistory!) {
      dates.add(bp.date)
    }
  }
  const sortedDates = Array.from(dates).sort()

  const balanceIndex = new Map<string, Map<string, number>>()
  for (const a of withHistory) {
    const m = new Map<string, number>()
    for (const bp of a.balanceHistory!) {
      m.set(bp.date, bp.balance)
    }
    balanceIndex.set(a.id, m)
  }

  const series: SeriesInfo[] = withHistory.map((a: Account) => ({ id: a.id, name: a.displayName }))

  const data: BalanceRow[] = sortedDates.map((date: string) => {
    const row: BalanceRow = { date: new Date(date) }
    for (const a of withHistory) {
      row[a.id] = balanceIndex.get(a.id)?.get(date) ?? 0
    }
    return row
  })

  const accessors = series.map((s: SeriesInfo) => (d: BalanceRow) => d[s.id] as number)

  return { data, accessors, series }
})
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">Account Balances</h2>
    </template>

    <div v-if="chartConfig.data.length > 0" class="h-64 w-full p-4">
      <VisSingleContainer :data="chartConfig.data">
        <VisArea :x="(d: BalanceRow) => d.date" :y="chartConfig.accessors" :color="(d: unknown, i: number) => COLORS[i % COLORS.length]" />
      </VisSingleContainer>
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
