<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    series: { name: string; data: { x: number; y: number }[]; color: string }[]
    height?: number
  }>(),
  { height: 260 },
)

const options = computed(() => ({
  chart: {
    type: 'area' as const,
    zoom: { enabled: true, type: 'x' as const },
    toolbar: { show: true, tools: { download: true, selection: true, zoom: true, pan: true, reset: true } },
  },
  colors: props.series.map((s) => s.color),
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth' as const, width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 0.1, opacityFrom: 0.4, opacityTo: 0.1 } },
  xaxis: { type: 'datetime' as const, labels: { format: 'MMM dd' } },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  tooltip: { x: { format: 'MMM dd, yyyy' }, y: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  grid: { borderColor: 'var(--ui-border)', strokeDashArray: 3 },
  legend: { position: 'bottom' as const },
}))

const chartKey = computed(() => props.series.length)
</script>

<template>
  <div v-if="series.length > 0 && series.some((s) => s.data.length > 0)" class="w-full px-2 py-2">
    <apexchart :key="chartKey" type="area" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-(--ui-text-muted) text-sm">
    No data available
  </div>
</template>
