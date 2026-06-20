<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    data: { date: string; value: number }[]
    color?: string
    height?: number
    format?: 'currency' | 'percent'
  }>(),
  {
    color: 'var(--color-accent, #00c853)',
    height: 260,
    format: 'currency',
  },
)

const series = computed(() => [
  {
    name: 'Value',
    data: props.data.map((d) => ({ x: new Date(d.date).getTime(), y: d.value })),
  },
])

const options = computed(() => {
  const yFormatter = props.format === 'percent' ? (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : (v: number) => `$${v.toLocaleString()}`

  const tooltipFormatter = props.format === 'percent' ? (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : (v: number) => `$${v.toLocaleString()}`

  return {
    chart: {
      type: 'line' as const,
      zoom: { enabled: true, type: 'x' as const, autoScaleYaxis: true },
      toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
      background: 'transparent',
      foreColor: 'var(--color-text-muted, #9aa0a6)',
    },
    colors: [props.color],
    stroke: { curve: 'smooth' as const, width: 2 },
    xaxis: { type: 'datetime' as const, labels: { format: 'MMM dd', style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
    yaxis: {
      labels: { formatter: yFormatter, style: { colors: 'var(--color-text-muted, #9aa0a6)' } },
    },
    tooltip: {
      x: { format: 'MMM dd, yyyy' },
      y: { formatter: tooltipFormatter },
      theme: 'dark' as const,
    },
    grid: { borderColor: 'var(--color-chart-grid, #2d3140)', strokeDashArray: 3 },
  }
})

const chartKey = computed(() => props.data.length)
</script>

<template>
  <div v-if="data.length > 0" class="w-full">
    <apexchart :key="chartKey" type="line" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
