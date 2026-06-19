<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDataStore } from '~/stores/data.store'
import { useMarketStore } from '~/stores/market.store'

const dataStore = useDataStore()
const marketStore = useMarketStore()

const activeTab = ref<'OPEN' | 'CLOSED'>('OPEN')
const expandedPositionIds = ref<Set<string>>(new Set())

const totals = computed(() => dataStore.portfolioSummary)

const positions = computed(() => {
  return [...dataStore.visiblePositions].sort((a, b) => b.marketValue - a.marketValue)
})

const accountNameById = computed(() => {
  return new Map(dataStore.allAccounts.map((account) => [account.id, account.displayName]))
})

const accountOptions = computed(() => {
  return [
    {
      id: null,
      label: 'All accounts',
    },
    ...dataStore.allAccounts.map((account) => ({
      id: account.id,
      label: account.displayName,
    })),
  ]
})

const availableTaxYears = computed(() => {
  if (dataStore.availableTaxYears.length > 0) return dataStore.availableTaxYears
  return [new Date().getFullYear()]
})

const closedLotsForYear = computed(() => {
  return dataStore.closedLots.filter((lot) => lot.taxYear === dataStore.selectedTaxYear)
})

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US')
}

function toggleExpanded(positionId: string): void {
  const next = new Set(expandedPositionIds.value)
  if (next.has(positionId)) {
    next.delete(positionId)
  } else {
    next.add(positionId)
  }
  expandedPositionIds.value = next
}

function isExpanded(positionId: string): boolean {
  return expandedPositionIds.value.has(positionId)
}

function lotsForPosition(accountId: string, symbol: string) {
  return dataStore.openLots.filter((lot) => lot.accountId === accountId && lot.symbol.toUpperCase() === symbol.toUpperCase())
}

function holdingPeriodLabel(accountId: string, symbol: string): string {
  const lots = lotsForPosition(accountId, symbol)
  if (lots.length === 0) return 'N/A'
  const maxDays = Math.max(...lots.map((lot) => lot.daysHeld))
  return `${maxDays}d`
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-4">
    <div class="flex items-center justify-between">
      <h1 class="text-sm font-[var(--font-mono)] text-(--ui-text-muted)">
        <NuxtLink to="/" class="hover:text-(--ui-text)">~</NuxtLink>
        <span class="mx-1">/</span>
        <span class="text-(--ui-text)">positions</span>
      </h1>
      <UButton label="Dashboard" to="/dashboard" color="neutral" variant="ghost" size="xs" />
    </div>

    <div class="flex overflow-x-auto rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
      <div class="flex divide-x divide-(--ui-border) text-xs">
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Total Value</span>
          <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">
            {{ formatCurrency(totals.totalMarketValue + totals.totalCashBalance) }}
          </span>
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Market Value</span>
          <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">
            {{ formatCurrency(totals.totalMarketValue) }}
          </span>
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Cash</span>
          <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">
            {{ formatCurrency(totals.totalCashBalance) }}
          </span>
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Cost Basis</span>
          <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">
            {{ formatCurrency(totals.totalCostBasis) }}
          </span>
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Day Change</span>
          <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(totals.totalDayGainLoss)">
            {{ formatCurrency(totals.totalDayGainLoss) }}
            <span class="text-2xs">({{ formatPercent(totals.totalDayGainLossPct) }})</span>
          </span>
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Total G/L</span>
          <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(totals.totalUnrealizedGainLoss)">
            {{ formatCurrency(totals.totalUnrealizedGainLoss) }}
            <span class="text-2xs">({{ formatPercent(totals.totalUnrealizedGainLossPct) }})</span>
          </span>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
      <div class="flex items-center gap-1.5">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Account</span>
        <UButton
          v-for="option in accountOptions"
          :key="option.label"
          :label="option.label"
          size="xs"
          :color="dataStore.selectedAccountId === option.id ? 'primary' : 'neutral'"
          :variant="dataStore.selectedAccountId === option.id ? 'solid' : 'ghost'"
          @click="dataStore.selectAccount(option.id)"
        />
      </div>
      <div class="ml-auto flex items-center gap-2">
        <UButton
          label="Refresh"
          icon="i-lucide-refresh-cw"
          size="xs"
          color="neutral"
          variant="ghost"
          :loading="marketStore.isSyncing"
          :disabled="marketStore.isSyncing"
          @click="marketStore.refreshMarketData()"
        />
        <span v-if="marketStore.lastError" class="text-2xs text-[var(--color-signal-red)]">{{ marketStore.lastError }}</span>
        <span v-if="marketStore.syncStatus === 'SUCCESS' && !marketStore.isSyncing" class="text-2xs text-[var(--color-accent)]">Updated</span>
      </div>
    </div>

    <div class="flex gap-2">
      <UButton
        label="Open positions"
        size="xs"
        :color="activeTab === 'OPEN' ? 'primary' : 'neutral'"
        :variant="activeTab === 'OPEN' ? 'solid' : 'ghost'"
        @click="activeTab = 'OPEN'"
      />
      <UButton
        label="Closed positions"
        size="xs"
        :color="activeTab === 'CLOSED' ? 'primary' : 'neutral'"
        :variant="activeTab === 'CLOSED' ? 'solid' : 'ghost'"
        @click="activeTab = 'CLOSED'"
      />
    </div>

    <div v-if="activeTab === 'OPEN'" class="overflow-hidden rounded-sm border border-(--ui-border)">
      <div class="flex items-center justify-between border-b border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-1.5">
        <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Open positions</span>
        <span class="text-2xs text-(--ui-text-muted)">{{ positions.length }} total</span>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th class="text-2xs px-3 py-2 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Symbol</th>
              <th class="text-2xs px-3 py-2 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Account</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Quantity</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Avg cost</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Price</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Market value</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Unrealized G/L</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Day G/L</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Holding period</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Lots</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="position in positions" :key="position.id">
              <tr class="border-b border-(--ui-border)/60">
                <td class="px-3 py-2 font-medium">{{ position.symbol }}</td>
                <td class="px-3 py-2">{{ accountNameById.get(position.accountId) ?? 'Unknown account' }}</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(position.quantity) }}</td>
                <td class="px-3 py-2 text-right">{{ formatCurrency(position.avgCost) }}</td>
                <td class="px-3 py-2 text-right">{{ formatCurrency(position.currentPrice) }}</td>
                <td class="px-3 py-2 text-right">{{ formatCurrency(position.marketValue) }}</td>
                <td class="px-3 py-2 text-right" :class="signClass(position.unrealizedGainLoss)">
                  {{ formatCurrency(position.unrealizedGainLoss) }} ({{ formatPercent(position.unrealizedGainLossPct) }})
                </td>
                <td class="px-3 py-2 text-right" :class="signClass(position.dayGainLoss)">
                  {{ formatCurrency(position.dayGainLoss) }} ({{ formatPercent(position.dayGainLossPct) }})
                </td>
                <td class="px-3 py-2 text-right">{{ holdingPeriodLabel(position.accountId, position.symbol) }}</td>
                <td class="px-3 py-2 text-right">
                  <UButton :label="isExpanded(position.id) ? 'Hide' : 'Show'" size="xs" color="neutral" variant="ghost" @click="toggleExpanded(position.id)" />
                </td>
              </tr>
              <tr v-if="isExpanded(position.id)" class="border-b border-(--ui-border)/60 bg-(--ui-bg-elevated)">
                <td colspan="10" class="px-3 py-3">
                  <div class="overflow-x-auto">
                    <table class="min-w-full text-xs">
                      <thead>
                        <tr class="border-b border-(--ui-border)">
                          <th class="text-2xs px-2 py-1 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Lot ID</th>
                          <th class="text-2xs px-2 py-1 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Acquired</th>
                          <th class="text-2xs px-2 py-1 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Acquired price</th>
                          <th class="text-2xs px-2 py-1 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Qty</th>
                          <th class="text-2xs px-2 py-1 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Cost basis</th>
                          <th class="text-2xs px-2 py-1 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Current value</th>
                          <th class="text-2xs px-2 py-1 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Unrealized G/L</th>
                          <th class="text-2xs px-2 py-1 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Wash sale</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="lot in lotsForPosition(position.accountId, position.symbol)" :key="lot.id" class="border-b border-(--ui-border)/40">
                          <td class="px-2 py-1">{{ lot.id.slice(0, 8) }}</td>
                          <td class="px-2 py-1">{{ formatDate(lot.acquiredDate) }}</td>
                          <td class="px-2 py-1 text-right">{{ formatCurrency(lot.acquiredPrice) }}</td>
                          <td class="px-2 py-1 text-right">{{ formatNumber(lot.remainingQuantity) }}</td>
                          <td class="px-2 py-1 text-right">{{ formatCurrency(lot.adjustedCostBasis) }}</td>
                          <td class="px-2 py-1 text-right">{{ formatCurrency(lot.currentValue) }}</td>
                          <td class="px-2 py-1 text-right" :class="signClass(lot.unrealizedGainLoss)">
                            {{ formatCurrency(lot.unrealizedGainLoss) }} ({{ formatPercent(lot.unrealizedGainLossPct) }})
                          </td>
                          <td class="px-2 py-1 text-right">{{ lot.isWashSale ? 'Yes' : 'No' }}</td>
                        </tr>
                        <tr v-if="lotsForPosition(position.accountId, position.symbol).length === 0">
                          <td colspan="8" class="px-2 py-2 text-center text-(--ui-text-muted)">No open tax lots for this position.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="positions.length === 0">
              <td colspan="10" class="px-3 py-6 text-center text-(--ui-text-muted)">No positions found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="overflow-hidden rounded-sm border border-(--ui-border)">
      <div class="flex items-center justify-between border-b border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-1.5">
        <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Closed positions</span>
        <div class="flex items-center gap-2">
          <USelect
            :value="dataStore.selectedTaxYear"
            :items="availableTaxYears.map((y) => ({ label: String(y), value: y }))"
            size="xs"
            variant="outline"
            color="neutral"
            @update:model-value="dataStore.setSelectedTaxYear(Number($event))"
          />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th class="text-2xs px-3 py-2 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Sold date</th>
              <th class="text-2xs px-3 py-2 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Symbol</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Cost</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Proceeds</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Realized G/L</th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Term</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lot in closedLotsForYear" :key="lot.id" class="border-b border-(--ui-border)/60">
              <td class="px-3 py-2">{{ formatDate(lot.soldDate) }}</td>
              <td class="px-3 py-2 font-medium">{{ lot.symbol }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(lot.costBasis) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(lot.proceeds) }}</td>
              <td class="px-3 py-2 text-right" :class="signClass(lot.realizedGainLoss)">
                {{ formatCurrency(lot.realizedGainLoss) }} ({{ formatPercent(lot.costBasis > 0 ? (lot.realizedGainLoss / lot.costBasis) * 100 : 0) }})
              </td>
              <td class="px-3 py-2 text-right">{{ lot.termType }}</td>
            </tr>
            <tr v-if="closedLotsForYear.length === 0">
              <td colspan="6" class="px-3 py-6 text-center text-(--ui-text-muted)">No closed lots found for this tax year.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
