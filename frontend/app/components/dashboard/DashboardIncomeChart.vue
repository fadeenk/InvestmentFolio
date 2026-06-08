<script setup lang="ts">
import { VisXYContainer, VisStackedBar, VisAxis } from '@unovis/vue'
import { formatCurrency } from '~/utils/format'

interface IncomeYoyRow {
  accountName: string
  currentYear: number
  priorYear: number
}

const props = defineProps<{
  data: IncomeYoyRow[]
  currentYear: number
  priorYear: number
}>()

const CHART_HEIGHT = 224

function xTickFormat(i: number): string {
  return props.data[i]?.accountName ?? ''
}
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
      <VisXYContainer :data="data" :height="CHART_HEIGHT" :margin="{ top: 16, right: 16, bottom: 64, left: 64 }">
        <VisStackedBar
          :x="(_d: IncomeYoyRow, i: number) => i"
          :y="[(d: IncomeYoyRow) => d.priorYear, (d: IncomeYoyRow) => d.currentYear]"
          :color="(_d: IncomeYoyRow, i: number) => (i === 0 ? '#94a3b8' : '#3b82f6')"
          :rounded-corners="2"
          :bar-padding="0.2"
        />
        <VisAxis type="x" :tick-format="xTickFormat" :grid-line="false" />
        <VisAxis type="y" :num-ticks="6" :tick-format="formatCurrency" />
      </VisXYContainer>
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
