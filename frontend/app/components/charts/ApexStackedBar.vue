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
  chart: { type: 'bar' as const, stacked: true, toolbar: { show: true } },
  colors: props.series.map((s) => s.color),
  xaxis: { categories: props.categories },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  tooltip: { y: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  legend: { position: 'bottom' as const },
  grid: { borderColor: 'var(--ui-border)', strokeDashArray: 3 },
  plotOptions: { bar: { horizontal: false, borderRadius: 4 } },
}))

const chartKey = computed(() => props.categories.length)
</script>

<template>
  <div v-if="categories.length > 0 && series.some((s) => s.data.length > 0)" class="w-full px-2 py-2">
    <apexchart :key="chartKey" type="bar" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-(--ui-text-muted) text-sm">
    No data available
  </div>
</template>
