<script setup lang="ts">
import { computed } from 'vue'
import { useAccountsStore } from '~/stores/accounts.store'
import { usePositionsStore } from '~/stores/positions.store'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()
const accountsStore = useAccountsStore()
const positionsStore = usePositionsStore()

const isUnlocked = computed(() => vault.status === VaultStatus.UNLOCKED)
const accounts = computed(() => accountsStore.active)
const allAccounts = computed(() => vault.accounts)
const positions = computed(() => positionsStore.latest)

const accountNameById = computed(() => {
  return new Map(allAccounts.value.map((account) => [account.id, account.displayName]))
})

const positionsWithAccount = computed(() => {
  return [...positions.value]
    .map((position) => ({
      ...position,
      accountName: accountNameById.value.get(position.accountId) ?? 'Unknown account',
    }))
    .sort((a, b) => b.marketValue - a.marketValue)
})

const totals = computed(() => positionsStore.summary)

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function gainLossClass(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-300'
  if (value < 0) return 'text-red-600 dark:text-red-300'
  return 'text-(--ui-text-muted)'
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Dashboard</h1>
        <p class="text-sm text-(--ui-text-muted)">Accounts and latest position snapshots</p>
      </div>
      <UButton label="Home" color="neutral" variant="outline" to="/" />
    </div>

    <template v-if="!isUnlocked">
      <UCard>
        <div class="space-y-3">
          <p class="text-sm text-(--ui-text-muted)">Unlock your vault to view account and position data.</p>
          <UButton label="Go to vault" color="primary" to="/" />
        </div>
      </UCard>
    </template>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UCard>
          <template #header>
            <p class="text-sm text-(--ui-text-muted)">Active accounts</p>
          </template>
          <p class="text-2xl font-bold">{{ accounts.length }}</p>
        </UCard>

        <UCard>
          <template #header>
            <p class="text-sm text-(--ui-text-muted)">Open positions</p>
          </template>
          <p class="text-2xl font-bold">{{ positions.length }}</p>
        </UCard>

        <UCard>
          <template #header>
            <p class="text-sm text-(--ui-text-muted)">Market value</p>
          </template>
          <p class="text-2xl font-bold">{{ formatCurrency(totals.totalMarketValue) }}</p>
        </UCard>

        <UCard>
          <template #header>
            <p class="text-sm text-(--ui-text-muted)">Cash balance</p>
          </template>
          <p class="text-2xl font-bold">{{ formatCurrency(totals.totalCashBalance) }}</p>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold">Accounts</h2>
            <span class="text-sm text-(--ui-text-muted)">{{ accounts.length }} total</span>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-(--ui-border)">
                <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Name</th>
                <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Bank</th>
                <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Type</th>
                <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Acct #</th>
                <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Current</th>
                <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Cash</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="account in accounts" :key="account.id" class="border-b border-(--ui-border)/60">
                <td class="px-3 py-2 font-medium">{{ account.displayName }}</td>
                <td class="px-3 py-2">{{ account.bank }}</td>
                <td class="px-3 py-2">{{ account.type }}</td>
                <td class="px-3 py-2">••••{{ account.accountNumber }}</td>
                <td class="px-3 py-2 text-right">{{ formatCurrency(account.currentBalance) }}</td>
                <td class="px-3 py-2 text-right">{{ formatCurrency(account.cashBalance) }}</td>
              </tr>
              <tr v-if="accounts.length === 0">
                <td class="px-3 py-6 text-center text-(--ui-text-muted)" colspan="6">No accounts found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold">Positions</h2>
            <span class="text-sm text-(--ui-text-muted)">{{ positionsWithAccount.length }} total</span>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-(--ui-border)">
                <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Symbol</th>
                <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Account</th>
                <th class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">Asset</th>
                <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Quantity</th>
                <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Avg Cost</th>
                <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Price</th>
                <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Market Value</th>
                <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Unrealized</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="position in positionsWithAccount" :key="position.id" class="border-b border-(--ui-border)/60">
                <td class="px-3 py-2 font-medium">{{ position.symbol }}</td>
                <td class="px-3 py-2">{{ position.accountName }}</td>
                <td class="px-3 py-2">{{ position.assetType }}</td>
                <td class="px-3 py-2 text-right">{{ position.quantity }}</td>
                <td class="px-3 py-2 text-right">{{ formatCurrency(position.avgCost) }}</td>
                <td class="px-3 py-2 text-right">{{ formatCurrency(position.currentPrice) }}</td>
                <td class="px-3 py-2 text-right">{{ formatCurrency(position.marketValue) }}</td>
                <td class="px-3 py-2 text-right" :class="gainLossClass(position.unrealizedGainLoss)">
                  {{ formatCurrency(position.unrealizedGainLoss) }} ({{ formatPercent(position.unrealizedGainLossPct) }})
                </td>
              </tr>
              <tr v-if="positionsWithAccount.length === 0">
                <td class="px-3 py-6 text-center text-(--ui-text-muted)" colspan="8">No positions found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>
