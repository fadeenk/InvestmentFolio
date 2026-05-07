<script setup lang="ts">
import { VisSingleContainer, VisGroupedBar } from '@unovis/vue'

const props = withDefaults(defineProps<{
  data: { category: string; value: number }[]
  orientation?: 'vertical' | 'horizontal'
}>(), {
  orientation: 'vertical'
})
</script>

<template>
  <div v-if="data.length > 0" class="w-full h-64 p-4">
    <VisSingleContainer :data="data">
      <VisGroupedBar 
        :value="(d: any) => d.value" 
        :label="(d: any) => d.category"
        :orientation="orientation"
      />
    </VisSingleContainer>
  </div>
  <div v-else class="w-full h-64 flex items-center justify-center text-gray-500">
    No data available
  </div>
</template>
