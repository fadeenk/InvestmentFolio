<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { usePortfolioStore } from '~/stores/portfolio'
import { usePreferencesStore } from '~/stores/preferences'
import { useUiStore } from '~/stores/ui'
import LineChart from '~/components/charts/LineChart.vue'
import PieChart from '~/components/charts/PieChart.vue'
import BarChart from '~/components/charts/BarChart.vue'
import type { PricePoint } from '~/types/vault'
import { AssetType } from '~/types/enums'

const portfolio = usePortfolioStore()
const preferences = usePreferencesStore()
const ui = useUiStore()

// Computed data for charts
const allocationData = computed(() => portfolio.allocationByAsset)

const assetComparison = computed(() => {
  return portfolio.positions.map(pos => ({
    category: pos.symbol,
    value: pos.shares * pos.currentPrice
  }))
})

// Sample data for demo
onMounted(() => {
  // Add sample positions
  portfolio.addPosition({
    id: '1',
    accountId: 'acc1',
    symbol: 'AAPL',
    assetType: AssetType.Stock,
    shares: 10,
    avgCost: 150,
    currentPrice: 155,
    costBasisMethod: 'FIFO'
  })
  
  portfolio.addPosition({
    id: '2',
    accountId: 'acc1',
    symbol: 'GOOGL',
    assetType: AssetType.Stock,
    shares: 5,
    avgCost: 2800,
    currentPrice: 2850,
    costBasisMethod: 'FIFO'
  })

  // Sample price history (6 months per spec)
  portfolio.priceHistory = [
    { date: '2026-01-01', value: 10000 },
    { date: '2026-02-01', value: 10500 },
    { date: '2026-03-01', value: 11000 },
    { date: '2026-04-01', value: 10800 },
    { date: '2026-05-01', value: 11500 },
    { date: '2026-06-01', value: 12000 }
  ] as PricePoint[]
})
</script>

<template>
  <UContainer class="py-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-text">Investment Dashboard</h1>
      <div class="flex gap-4 items-center">
        <USelect 
          :modelValue="preferences.currency" 
          @update:modelValue="preferences.setCurrency($event)"
          :items="['USD', 'EUR', 'GBP']"
        />
        <UButton @click="preferences.toggleDarkMode()">
          {{ preferences.darkMode ? 'Light Mode' : 'Dark Mode' }}
        </UButton>
        <span class="text-sm text-gray-500">
          Sidebar: {{ ui.sidebarOpen ? 'Open' : 'Closed' }}
        </span>
      </div>
    </div>

    <div class="mb-6">
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Total Portfolio Value</h2>
        </template>
        <p class="text-3xl font-bold text-primary">
          {{ portfolio.totalValue.toLocaleString() }} {{ preferences.currency }}
        </p>
      </UCard>
    </div>

    <div class="mb-6">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Portfolio Value Over Time</h3>
        </template>
        <LineChart :data="portfolio.priceHistory" />
      </UCard>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Asset Allocation</h3>
        </template>
        <PieChart :data="allocationData" />
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Asset Comparison</h3>
        </template>
        <BarChart :data="assetComparison" />
      </UCard>
    </div>
  </UContainer>
</template>
