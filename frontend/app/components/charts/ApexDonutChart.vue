<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '~/utils/format'
import { CHART_SERIES_VARS } from '~/utils/chartPalette'

const props = withDefaults(
  defineProps<{
    data: { label: string; value: number }[]
    height?: number
  }>(),
  { height: 300 },
)

const series = computed(() => props.data.map((d) => d.value))
const labels = computed(() => props.data.map((d) => d.label))

const options = computed(() => ({
  chart: { type: 'donut' as const, background: 'transparent', foreColor: 'var(--color-text-muted, #6b7280)' },
  colors: CHART_SERIES_VARS.slice(0, Math.max(props.data.length, 1)),
  labels: labels.value,
  legend: { show: true, position: 'bottom' as const, fontSize: '12px', labels: { colors: 'var(--color-text-muted, #6b7280)' } },
  tooltip: { y: { formatter: (v: number) => formatCurrency(v) }, theme: 'dark' as const },
  plotOptions: {
    pie: {
      donut: { size: '55%' },
      expandOnClick: true,
    },
  },
  responsive: [{ breakpoint: 640, options: { chart: { width: '100%' }, legend: { position: 'bottom' } } }],
  dataLabels: { style: { colors: ['var(--color-text, #1a1a2e)'] } },
}))

const chartKey = computed(() => props.data.length)
</script>

<template>
  <div v-if="data.length > 0" class="w-full">
    <apexchart :key="chartKey" type="donut" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
