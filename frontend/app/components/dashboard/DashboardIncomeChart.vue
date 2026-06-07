<script setup lang="ts">
import { VisSingleContainer, VisGroupedBar } from '@unovis/vue'

interface IncomeYoyRow {
  accountName: string
  currentYear: number
  priorYear: number
}

defineProps<{
  data: IncomeYoyRow[]
  currentYear: number
  priorYear: number
}>()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Income by Account</h2>
        <span class="text-xs text-(--ui-text-muted)">{{ priorYear }} vs {{ currentYear }}</span>
      </div>
    </template>

    <div v-if="data.length > 0" class="h-64 w-full p-4">
      <VisSingleContainer :data="data">
        <VisGroupedBar
          :x="(d: unknown, i: number) => i"
          :y="[(d: unknown) => (d as IncomeYoyRow).priorYear, (d: unknown) => (d as IncomeYoyRow).currentYear]"
          :color="(d: unknown, i: number) => (i === 0 ? '#94a3b8' : '#3b82f6')"
        />
      </VisSingleContainer>
    </div>
    <div v-else class="flex h-64 w-full items-center justify-center text-gray-500">No data available</div>
    <div v-if="data.length > 0" class="flex justify-center gap-4 pb-3 text-xs text-(--ui-text-muted)">
      <span class="flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-sm" style="background-color: #94a3b8" />
        {{ priorYear }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-sm" style="background-color: #3b82f6" />
        {{ currentYear }}
      </span>
    </div>
  </UCard>
</template>
