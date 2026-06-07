<script setup lang="ts">
import { VisSingleContainer, VisGroupedBar } from '@unovis/vue'

withDefaults(
  defineProps<{
    data: { category: string; value: number }[]
    orientation?: 'vertical' | 'horizontal'
  }>(),
  {
    orientation: 'vertical',
  },
)
</script>

<template>
  <div v-if="data.length > 0" class="h-64 w-full p-4">
    <VisSingleContainer :data="data">
      <VisGroupedBar :x="(d: any) => d.category" :y="(d: any) => d.value" :orientation="orientation" />
    </VisSingleContainer>
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-gray-500">No data available</div>
</template>
