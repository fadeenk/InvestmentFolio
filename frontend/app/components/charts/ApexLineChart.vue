<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    data: { date: string; value: number }[]
    color?: string
    height?: number
  }>(),
  {
    color: '#10b981',
    height: 260,
  },
)

const series = computed(() => [
  {
    name: 'Value',
    data: props.data.map((d) => ({ x: new Date(d.date).getTime(), y: d.value })),
  },
])

const options = computed(() => ({
  chart: {
    type: 'line' as const,
    zoom: { enabled: true, type: 'x' as const, autoScaleYaxis: true },
    toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
  },
  colors: [props.color],
  stroke: { curve: 'smooth' as const, width: 2 },
  xaxis: { type: 'datetime' as const, labels: { format: 'MMM dd' } },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  tooltip: { x: { format: 'MMM dd, yyyy' }, y: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  grid: { borderColor: 'var(--ui-border)', strokeDashArray: 3 },
}))

const chartKey = computed(() => props.data.length)
</script>

<template>
  <div v-if="data.length > 0" class="w-full px-2 py-2">
    <apexchart :key="chartKey" type="line" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-(--ui-text-muted) text-sm">
    No data available
  </div>
</template>
