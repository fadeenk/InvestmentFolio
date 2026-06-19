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
    background: 'transparent',
    foreColor: 'var(--color-text-muted, #9aa0a6)',
  },
  colors: props.series.map((s) => s.color),
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth' as const, width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 0.1, opacityFrom: 0.4, opacityTo: 0.1 } },
  xaxis: { type: 'datetime' as const, labels: { format: 'MMM dd', style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}`, style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  tooltip: { x: { format: 'MMM dd, yyyy' }, y: { formatter: (v: number) => `$${v.toLocaleString()}` }, theme: 'dark' as const },
  grid: { borderColor: 'var(--color-chart-grid, #2d3140)', strokeDashArray: 3 },
  legend: { position: 'bottom' as const, labels: { colors: 'var(--color-text-muted, #9aa0a6)' } },
}))

const chartKey = computed(() => props.series.length)
</script>

<template>
  <div v-if="series.length > 0 && series.some((s) => s.data.length > 0)" class="w-full">
    <apexchart :key="chartKey" type="area" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
