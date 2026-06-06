<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAccountsStore } from '~/stores/accounts.store'
import { usePositionsStore } from '~/stores/positions.store'
import { useTaxLotsStore } from '~/stores/taxLots.store'

const accountsStore = useAccountsStore()
const positionsStore = usePositionsStore()
const taxLotsStore = useTaxLotsStore()

const activeTab = ref<'OPEN' | 'CLOSED'>('OPEN')
const expandedPositionIds = ref<Set<string>>(new Set())

const totals = computed(() => positionsStore.summary)

const positions = computed(() => {
  return [...positionsStore.visible].sort((a, b) => b.marketValue - a.marketValue)
})

const accountNameById = computed(() => {
  return new Map(accountsStore.all.map((account) => [account.id, account.displayName]))
})

const accountOptions = computed(() => {
  return [
    {
      id: null,
      label: 'All accounts',
    },
    ...accountsStore.all.map((account) => ({
      id: account.id,
      label: account.displayName,
    })),
  ]
})

const availableTaxYears = computed(() => {
  if (taxLotsStore.availableTaxYears.length > 0) return taxLotsStore.availableTaxYears
  return [new Date().getFullYear()]
})

const closedLotsForYear = computed(() => {
  return taxLotsStore.closedLots.filter((lot) => lot.taxYear === taxLotsStore.selectedTaxYear)
})

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US')
}

function signClass(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-300'
  if (value < 0) return 'text-red-600 dark:text-red-300'
  return 'text-(--ui-text-muted)'
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
  return taxLotsStore.openLots.filter((lot) => lot.accountId === accountId && lot.symbol.toUpperCase() === symbol.toUpperCase())
}

function holdingPeriodLabel(accountId: string, symbol: string): string {
  const lots = lotsForPosition(accountId, symbol)
  if (lots.length === 0) return 'N/A'
  const maxDays = Math.max(...lots.map((lot) => lot.daysHeld))
  return `${maxDays}d`
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Positions & Tax Lots</h1>
        <p class="text-sm text-(--ui-text-muted)">Open positions, tax lot drilldown, and realized gains history.</p>
      </div>
      <UButton label="Dashboard" to="/dashboard" color="neutral" variant="outline" />
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <UCard>
        <template #header>
          <p class="text-sm text-(--ui-text-muted)">Total value</p>
        </template>
        <p class="text-2xl font-bold">{{ formatCurrency(totals.totalMarketValue + totals.totalCashBalance) }}</p>
      </UCard>

      <UCard>
        <template #header>
          <p class="text-sm text-(--ui-text-muted)">Market value</p>
        </template>
        <p class="text-2xl font-bold">{{ formatCurrency(totals.totalMarketValue) }}</p>
      </UCard>

      <UCard>
        <template #header>
          <p class="text-sm text-(--ui-text-muted)">Cash</p>
        </template>
        <p class="text-2xl font-bold">{{ formatCurrency(totals.totalCashBalance) }}</p>
      </UCard>

      <UCard>
        <template #header>
          <p class="text-sm text-(--ui-text-muted)">Cost basis</p>
        </template>
        <p class="text-2xl font-bold">{{ formatCurrency(totals.totalCostBasis) }}</p>
      </UCard>

      <UCard>
        <template #header>
          <p class="text-sm text-(--ui-text-muted)">Day change</p>
        </template>
        <p class="text-2xl font-bold" :class="signClass(totals.totalDayGainLoss)">
          {{ formatCurrency(totals.totalDayGainLoss) }}
        </p>
        <p class="text-xs text-(--ui-text-muted)">{{ formatPercent(totals.totalDayGainLossPct) }}</p>
      </UCard>

      <UCard>
        <template #header>
          <p class="text-sm text-(--ui-text-muted)">Total gain / loss</p>
        </template>
        <p class="text-2xl font-bold" :class="signClass(totals.totalUnrealizedGainLoss)">
          {{ formatCurrency(totals.totalUnrealizedGainLoss) }}
        </p>
        <p class="text-xs text-(--ui-text-muted)">{{ formatPercent(totals.totalUnrealizedGainLossPct) }}</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Account filter</h2>
      </template>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="option in accountOptions"
          :key="option.label"
          :label="option.label"
          size="xs"
          :color="positionsStore.selectedAccountId === option.id ? 'primary' : 'neutral'"
          :variant="positionsStore.selectedAccountId === option.id ? 'solid' : 'outline'"
          @click="positionsStore.selectAccount(option.id)"
        />
      </div>
    </UCard>

    <div class="flex gap-2">
      <UButton
        label="Open positions"
        size="sm"
        :color="activeTab === 'OPEN' ? 'primary' : 'neutral'"
        :variant="activeTab === 'OPEN' ? 'solid' : 'outline'"
        @click="activeTab = 'OPEN'"
      />
      <UButton
        label="Closed positions"
        size="sm"
        :color="activeTab === 'CLOSED' ? 'primary' : 'neutral'"
        :variant="activeTab === 'CLOSED' ? 'solid' : 'outline'"
        @click="activeTab = 'CLOSED'"
      />
    </div>

    <UCard v-if="activeTab === 'OPEN'">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">Open positions</h2>
          <span class="text-sm text-(--ui-text-muted)">{{ positions.length }} total</span>
        </div>
      </template>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Symbol</th>
              <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Account</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Quantity</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Avg cost</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Price</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Market value</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Unrealized G/L</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Day G/L</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Holding period</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Lots</th>
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
                          <th class="px-2 py-1 text-left">Lot ID</th>
                          <th class="px-2 py-1 text-left">Acquired</th>
                          <th class="px-2 py-1 text-right">Acquired price</th>
                          <th class="px-2 py-1 text-right">Qty</th>
                          <th class="px-2 py-1 text-right">Cost basis</th>
                          <th class="px-2 py-1 text-right">Current value</th>
                          <th class="px-2 py-1 text-right">Unrealized G/L</th>
                          <th class="px-2 py-1 text-right">Wash sale</th>
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
    </UCard>

    <UCard v-else>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">Closed positions</h2>
          <div class="flex items-center gap-2">
            <label class="text-xs text-(--ui-text-muted)" for="tax-year">Tax year</label>
            <select
              id="tax-year"
              class="rounded-md border border-(--ui-border) bg-(--ui-bg) px-2 py-1 text-sm"
              :value="taxLotsStore.selectedTaxYear"
              @change="taxLotsStore.setSelectedTaxYear(Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="year in availableTaxYears" :key="year" :value="year">{{ year }}</option>
            </select>
          </div>
        </div>
      </template>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Sold date</th>
              <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Symbol</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Cost</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Proceeds</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Realized G/L</th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Term</th>
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
    </UCard>
  </div>
</template>
