<script setup lang="ts">
import { computed } from 'vue'
import type { Account } from '~/types/vault'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#a855f7']

const props = defineProps<{
  accounts: Account[]
}>()

const chartSeries = computed<{ name: string; data: { x: number; y: number }[]; color: string }[]>(() => {
  return props.accounts.map((account, i) => {
    const history = account.balanceHistory ?? []
    return {
      name: account.displayName,
      data: history.map((bp) => ({ x: new Date(bp.date).getTime(), y: bp.balance })),
      color: COLORS[i % COLORS.length] ?? '#6B7280',
    }
  })
})
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">Account Balances</h2>
    </template>
    <ApexAreaChart :series="chartSeries" />
  </UCard>
</template>
