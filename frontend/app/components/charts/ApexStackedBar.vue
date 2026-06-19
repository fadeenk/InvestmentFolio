<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    categories: string[]
    series: { name: string; data: number[]; color: string }[]
    height?: number
  }>(),
  { height: 260 },
)

const options = computed(() => ({
  chart: { type: 'bar' as const, stacked: true, toolbar: { show: true }, background: 'transparent', foreColor: 'var(--color-text-muted, #9aa0a6)' },
  colors: props.series.map((s) => s.color),
  xaxis: { categories: props.categories, labels: { style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}`, style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  tooltip: { y: { formatter: (v: number) => `$${v.toLocaleString()}` }, theme: 'dark' as const },
  legend: { position: 'bottom' as const, labels: { colors: 'var(--color-text-muted, #9aa0a6)' } },
  grid: { borderColor: 'var(--color-chart-grid, #2d3140)', strokeDashArray: 3 },
  plotOptions: { bar: { horizontal: false, borderRadius: 4 } },
}))

const chartKey = computed(() => props.categories.length)
</script>

<template>
  <div v-if="categories.length > 0 && series.some((s) => s.data.length > 0)" class="w-full">
    <apexchart :key="chartKey" type="bar" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
