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
  <div class="overflow-hidden rounded-sm border border-(--ui-border)">
    <div class="overflow-x-auto">
      <table class="min-w-full text-xs">
        <thead>
          <tr class="border-b border-(--ui-border) bg-(--ui-bg-elevated)">
            <th class="text-2xs px-3 py-2 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Name</th>
            <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Cost</th>
            <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Cash</th>
            <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Market Value</th>
            <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Gain</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(account, i) in accounts"
            :key="account.id"
            class="border-b border-(--ui-border)/60 transition-colors hover:bg-(--ui-bg-elevated)/50"
            :class="i % 2 === 1 ? 'bg-(--ui-bg-elevated)/30' : ''"
          >
            <td class="px-3 py-2.5 font-medium text-(--ui-text)">{{ account.name }}</td>
            <td class="px-3 py-2.5 text-right font-[var(--font-mono)] text-(--ui-text)">{{ formatCurrency(account.costBasis) }}</td>
            <td class="px-3 py-2.5 text-right font-[var(--font-mono)] text-(--ui-text)">{{ formatCurrency(account.cashBalance) }}</td>
            <td class="px-3 py-2.5 text-right font-[var(--font-mono)] text-(--ui-text)">{{ formatCurrency(account.marketValue) }}</td>
            <td class="px-3 py-2.5 text-right font-[var(--font-mono)]" :class="signClass(account.gain)">
              {{ formatCurrency(account.gain) }} ({{ formatPercent(account.gainPct) }})
            </td>
          </tr>
          <tr v-if="accounts.length === 0">
            <td colspan="5" class="px-3 py-6 text-center text-(--ui-text-muted)">No accounts found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
