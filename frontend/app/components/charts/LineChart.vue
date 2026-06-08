<script setup lang="ts">
import { computed } from 'vue'
import { VisLine, VisXYContainer, VisAxis } from '@unovis/vue'
import type { PricePoint } from '~/types/vault'
import { formatCurrency } from '~/utils/format'

type ChartPoint = {
  x: Date
  y: number | undefined
}

const props = withDefaults(
  defineProps<{
    data: PricePoint[]
    xKey?: string
    yKey?: string
    color?: string
  }>(),
  {
    xKey: 'date',
    yKey: 'value',
    color: '#3b82f6',
  },
)

const CHART_HEIGHT = 224

const chartData = computed(() => {
  if (!props.data || props.data.length === 0) return []
  return props.data.map((d: PricePoint) => ({
    x: new Date(d[props.xKey as 'date']),
    y: d[props.yKey],
  }))
})

const xAccessor = (d: ChartPoint) => d.x
const yAccessor = (d: ChartPoint) => d.y

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function xTickFormat(d: Date): string {
  return dateFormat.format(d)
}
</script>

<template>
  <div v-if="chartData.length > 0" class="h-64 w-full p-4">
    <VisXYContainer :data="chartData" :height="CHART_HEIGHT" :margin="{ top: 16, right: 16, bottom: 32, left: 48 }">
      <VisLine :x="xAccessor" :y="yAccessor" :color="color" />
      <VisAxis type="x" :grid-line="false" :tick-format="xTickFormat" />
      <VisAxis type="y" :num-ticks="6" :tick-format="formatCurrency" />
    </VisXYContainer>
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-gray-500">No data available</div>
</template>
