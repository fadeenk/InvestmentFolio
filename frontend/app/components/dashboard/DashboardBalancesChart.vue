<script setup lang="ts">
import { computed } from 'vue'
import type { Account } from '~/types/vault'
import { cutoffDate } from '~/stores/data.store'
import type { TimeRange } from '~/types/enums'
import { chartSeriesVar } from '~/utils/chartPalette'

const props = defineProps<{
  accounts: Account[]
  timeRange: TimeRange
}>()

const chartSeries = computed<{ name: string; data: { x: number; y: number }[]; color: string }[]>(() => {
  const cutoff = cutoffDate(props.timeRange)
  return props.accounts.map((account, i) => {
    const history = account.balanceHistory ?? []
    return {
      name: account.displayName,
      data: history.filter((bp) => bp.date >= cutoff).map((bp) => ({ x: new Date(bp.date).getTime(), y: bp.balance })),
      color: chartSeriesVar(i),
    }
  })
})
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Account balances</span>
    </div>
    <ApexAreaChart :series="chartSeries" />
  </div>
</template>
