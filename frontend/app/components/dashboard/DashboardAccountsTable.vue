<script setup lang="ts">
interface AccountRow {
  id: string
  name: string
  costBasis: number
  cashBalance: number
  marketValue: number
  gain: number
  gainPct: number
}

defineProps<{
  accounts: AccountRow[]
}>()
</script>

<template>
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
            <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Cost</th>
            <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Cash</th>
            <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Market Value</th>
            <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Gain</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in accounts" :key="account.id" class="border-b border-(--ui-border)/60">
            <td class="px-3 py-2 font-medium">{{ account.name }}</td>
            <td class="px-3 py-2 text-right">{{ formatCurrency(account.costBasis) }}</td>
            <td class="px-3 py-2 text-right">{{ formatCurrency(account.cashBalance) }}</td>
            <td class="px-3 py-2 text-right">{{ formatCurrency(account.marketValue) }}</td>
            <td class="px-3 py-2 text-right" :class="signClass(account.gain)">{{ formatCurrency(account.gain) }} ({{ formatPercent(account.gainPct) }})</td>
          </tr>
          <tr v-if="accounts.length === 0">
            <td class="px-3 py-6 text-center text-(--ui-text-muted)" colspan="5">No accounts found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
