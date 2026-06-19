<script setup lang="ts">
import { computed } from 'vue'
import type { Account } from '~/types/vault'

const TERMINAL_COLORS = ['#00c853', '#40c4ff', '#ffd740', '#ff5252', '#b388ff', '#64ffda', '#ffab40', '#ff6e40']

const props = defineProps<{
  accounts: Account[]
}>()

const chartSeries = computed<{ name: string; data: { x: number; y: number }[]; color: string }[]>(() => {
  return props.accounts.map((account, i) => {
    const history = account.balanceHistory ?? []
    return {
      name: account.displayName,
      data: history.map((bp) => ({ x: new Date(bp.date).getTime(), y: bp.balance })),
      color: TERMINAL_COLORS[i % TERMINAL_COLORS.length] ?? '#6B7280',
    }
  })
})
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Account Balances</span>
    </div>
    <ApexAreaChart :series="chartSeries" />
  </div>
</template>
