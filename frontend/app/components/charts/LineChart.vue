<script setup lang="ts">
import { computed } from 'vue'
import { VisLine as Line, VisSingleContainer as SingleContainer } from '@unovis/vue'
import type { PricePoint } from '~/types/vault'

const props = withDefaults(defineProps<{
  data: PricePoint[]
  xKey?: string
  yKey?: string
  color?: string
}>(), {
  xKey: 'date',
  yKey: 'value',
  color: '--color-primary'
})

const chartData = computed(() => {
  if (!props.data || props.data.length ===0) return []
  return props.data.map(d => ({
    x: new Date(d[props.xKey as keyof PricePoint] as string),
    y: d[props.yKey as keyof PricePoint] as number
  }))
})
</script>

<template>
  <div v-if="chartData.length > 0" class="w-full h-64 p-4">
    <SingleContainer :data="chartData">
      <Line :x="(d) => d.x" :y="(d) => d.y" :color="`var(${color})`" />
    </SingleContainer>
  </div>
  <div v-else class="w-full h-64 flex items-center justify-center text-gray-500">
    No data available
  </div>
</template>
