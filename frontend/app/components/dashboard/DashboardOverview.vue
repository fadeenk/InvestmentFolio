<script setup lang="ts">
import type { PortfolioSummary } from '~/types/vault'

defineProps<{
  summary: PortfolioSummary
}>()
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <UCard>
      <template #header>
        <p class="text-sm text-(--ui-text-muted)">Total Value</p>
      </template>
      <p class="text-2xl font-bold">{{ formatCurrency(summary.totalMarketValue + summary.totalCashBalance) }}</p>
    </UCard>

    <UCard>
      <template #header>
        <p class="text-sm text-(--ui-text-muted)">Today's G/L</p>
      </template>
      <p class="text-2xl font-bold" :class="signClass(summary.totalDayGainLoss)">
        {{ formatCurrency(summary.totalDayGainLoss) }}
      </p>
      <p class="text-xs text-(--ui-text-muted)">{{ formatPercent(summary.totalDayGainLossPct) }}</p>
    </UCard>

    <UCard>
      <template #header>
        <p class="text-sm text-(--ui-text-muted)">Unrealized G/L</p>
      </template>
      <p class="text-2xl font-bold" :class="signClass(summary.totalUnrealizedGainLoss)">
        {{ formatCurrency(summary.totalUnrealizedGainLoss) }}
      </p>
      <p class="text-xs text-(--ui-text-muted)">{{ formatPercent(summary.totalUnrealizedGainLossPct) }}</p>
    </UCard>

    <UCard>
      <template #header>
        <p class="text-sm text-(--ui-text-muted)">Cost Basis</p>
      </template>
      <p class="text-2xl font-bold">{{ formatCurrency(summary.totalCostBasis) }}</p>
    </UCard>

    <UCard>
      <template #header>
        <p class="text-sm text-(--ui-text-muted)">Realized G/L YTD</p>
      </template>
      <p class="text-2xl font-bold" :class="signClass(summary.ytdRealizedGainLossTotal)">
        {{ formatCurrency(summary.ytdRealizedGainLossTotal) }}
      </p>
      <p class="text-xs text-(--ui-text-muted)">
        Short {{ formatCurrency(summary.ytdRealizedGainLossShortTerm) }} / Long {{ formatCurrency(summary.ytdRealizedGainLossLongTerm) }}
      </p>
    </UCard>

    <UCard>
      <template #header>
        <p class="text-sm text-(--ui-text-muted)">Income YTD</p>
      </template>
      <p class="text-2xl font-bold">{{ formatCurrency(summary.ytdIncomeTotal) }}</p>
      <p class="text-xs text-(--ui-text-muted)">Div {{ formatCurrency(summary.ytdDividends) }} / Int {{ formatCurrency(summary.ytdInterest) }}</p>
    </UCard>

    <UCard>
      <template #header>
        <p class="text-sm text-(--ui-text-muted)">Available Cash</p>
      </template>
      <p class="text-2xl font-bold">{{ formatCurrency(summary.totalCashBalance) }}</p>
    </UCard>
  </div>
</template>
