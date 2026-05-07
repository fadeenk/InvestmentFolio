<script setup lang="ts">
import { Bar } from '@unovis/vue'

const props = withDefaults(defineProps<{
  data: { category: string; value: number }[]
  orientation?: 'vertical' | 'horizontal'
}>(), {
  orientation: 'vertical'
})
</script>

<template>
  <div v-if="data.length > 0" class="w-full h-64 p-4">
    <Bar 
      :data="data" 
      :value="(d: { value: number }) => d.value" 
      :label="(d: { category: string }) => d.category"
      :orientation="orientation"
    />
  </div>
  <div v-else class="w-full h-64 flex items-center justify-center text-gray-500">
    No data available
  </div>
</template>
