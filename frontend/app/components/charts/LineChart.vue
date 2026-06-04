<script setup lang="ts">
import { computed } from 'vue'
import { VisLine as Line, VisSingleContainer as SingleContainer } from '@unovis/vue'
import type { PricePoint } from '~/types/vault'

type chartPoint = {
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
    color: '--color-primary',
  },
)

const chartData = computed(() => {
  if (!props.data || props.data.length === 0) return []
  return props.data.map((d: PricePoint) => ({
    x: new Date(d[props.xKey as 'date']),
    y: d[props.yKey],
  }))
})
</script>

<template>
  <div v-if="chartData.length > 0" class="h-64 w-full p-4">
    <SingleContainer v-if="chartData" :data="chartData">
      <Line :x="(d: chartPoint) => d.x" :y="(d: chartPoint) => d.y" :color="`var(${color})`" />
    </SingleContainer>
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-gray-500">No data available</div>
</template>
