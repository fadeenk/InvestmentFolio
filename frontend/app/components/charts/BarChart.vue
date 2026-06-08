<script setup lang="ts">
import { VisSingleContainer, VisGroupedBar } from '@unovis/vue'

type BarItem = { category: string; value: number }

withDefaults(
  defineProps<{
    data: BarItem[]
    orientation?: 'vertical' | 'horizontal'
  }>(),
  {
    orientation: 'vertical',
  },
)

const CHART_HEIGHT = 256
</script>

<template>
  <div v-if="data.length > 0" class="h-64 w-full p-4">
    <VisSingleContainer :data="data" :height="CHART_HEIGHT">
      <VisGroupedBar :x="(d: BarItem) => d.category" :y="(d: BarItem) => d.value" :orientation="orientation" />
    </VisSingleContainer>
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-gray-500">No data available</div>
</template>
