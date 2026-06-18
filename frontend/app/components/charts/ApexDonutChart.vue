<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '~/utils/format'

const props = withDefaults(
  defineProps<{
    data: { label: string; value: number }[]
    height?: number
  }>(),
  { height: 300 },
)

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

const series = computed(() => props.data.map((d) => d.value))
const labels = computed(() => props.data.map((d) => d.label))

const options = computed(() => ({
  chart: { type: 'donut' as const },
  colors: COLORS.slice(0, props.data.length),
  labels: labels.value,
  legend: { show: true, position: 'bottom' as const, fontSize: '12px' },
  tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
  plotOptions: {
    pie: {
      donut: { size: '55%' },
      expandOnClick: true,
    },
  },
  responsive: [{ breakpoint: 640, options: { chart: { width: '100%' }, legend: { position: 'bottom' } } }],
}))

const chartKey = computed(() => props.data.length)
</script>

<template>
  <div v-if="data.length > 0" class="w-full px-2 py-2">
    <apexchart :key="chartKey" type="donut" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-(--ui-text-muted) text-sm">
    No data available
  </div>
</template>
