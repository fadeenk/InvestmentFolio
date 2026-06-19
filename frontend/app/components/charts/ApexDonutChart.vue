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

const TERMINAL_COLORS = ['#00c853', '#40c4ff', '#ffd740', '#ff5252', '#b388ff', '#64ffda', '#ffab40']

const series = computed(() => props.data.map((d) => d.value))
const labels = computed(() => props.data.map((d) => d.label))

const options = computed(() => ({
  chart: { type: 'donut' as const, background: 'transparent', foreColor: 'var(--color-text-muted, #9aa0a6)' },
  colors: TERMINAL_COLORS.slice(0, props.data.length),
  labels: labels.value,
  legend: { show: true, position: 'bottom' as const, fontSize: '12px', labels: { colors: 'var(--color-text-muted, #9aa0a6)' } },
  tooltip: { y: { formatter: (v: number) => formatCurrency(v) }, theme: 'dark' as const },
  plotOptions: {
    pie: {
      donut: { size: '55%' },
      expandOnClick: true,
    },
  },
  responsive: [{ breakpoint: 640, options: { chart: { width: '100%' }, legend: { position: 'bottom' } } }],
  dataLabels: { style: { colors: ['var(--color-text, #e8eaed)'] } },
}))

const chartKey = computed(() => props.data.length)
</script>

<template>
  <div v-if="data.length > 0" class="w-full">
    <apexchart :key="chartKey" type="donut" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
