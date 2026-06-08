<script setup lang="ts">
import { VisSingleContainer, VisDonut } from '@unovis/vue'
import { formatCurrency } from '~/utils/format'

type Slice = { label: string; value: number }

const props = withDefaults(
  defineProps<{
    data: Slice[]
    innerRadius?: number
    color?: (value: number, index: number) => string | undefined
  }>(),
  {
    innerRadius: 0.6,
    color: (_d: number, i: number) => ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][i],
  },
)

const CHART_HEIGHT = 192
</script>

<template>
  <div v-if="data.length > 0" class="h-64 w-full p-4">
    <VisSingleContainer :data="data" :height="CHART_HEIGHT">
      <VisDonut :value="(d: Slice) => d.value" :color="(d: Slice, i: number) => props.color?.(d.value, i) ?? '#6B7280'" :inner-radius="innerRadius" />
    </VisSingleContainer>
    <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
      <div v-for="(slice, i) in data" :key="slice.label" class="flex items-center gap-1.5 text-xs text-(--ui-text-muted)">
        <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: props.color?.(slice.value, i) ?? '#6B7280' }" />
        {{ slice.label }}
        <span class="font-medium tabular-nums">{{ formatCurrency(slice.value) }}</span>
      </div>
    </div>
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-gray-500">No data available</div>
</template>
