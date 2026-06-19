<script setup lang="ts">
import { computed } from 'vue'
import type { PortfolioSummary } from '~/types/vault'

const props = defineProps<{
  summary: PortfolioSummary
}>()

const totalValue = computed(() => props.summary.totalMarketValue + props.summary.totalCashBalance)
</script>

<template>
  <div class="flex overflow-x-auto rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="flex shrink-0 items-stretch divide-x divide-(--ui-border) text-xs">
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Total Value</span>
        <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(totalValue) }}</span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Day G/L</span>
        <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(summary.totalDayGainLoss)">
          {{ formatCurrency(summary.totalDayGainLoss) }}
          <span class="text-2xs">({{ formatPercent(summary.totalDayGainLossPct) }})</span>
        </span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Unrealized G/L</span>
        <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(summary.totalUnrealizedGainLoss)">
          {{ formatCurrency(summary.totalUnrealizedGainLoss) }}
          <span class="text-2xs">({{ formatPercent(summary.totalUnrealizedGainLossPct) }})</span>
        </span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Cost Basis</span>
        <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(summary.totalCostBasis) }}</span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Realized YTD</span>
        <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(summary.ytdRealizedGainLossTotal)">
          {{ formatCurrency(summary.ytdRealizedGainLossTotal) }}
        </span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Income YTD</span>
        <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(summary.ytdIncomeTotal) }}</span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Cash</span>
        <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(summary.totalCashBalance) }}</span>
      </div>
    </div>
  </div>
</template>
