<script setup lang="ts">
import { VisSingleContainer, VisDonut } from '@unovis/vue'

const props = withDefaults(defineProps<{
  data: { label: string; value: number }[]
  innerRadius?: number
  colors?: string[]
}>(), {
  innerRadius: 0.6,
  colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
})
</script>

<template>
  <div v-if="data.length > 0" class="w-full h-64 p-4">
    <VisSingleContainer :data="data">
      <VisDonut 
        :value="(d: any) => d.value" 
        :color="(d: any, i: number) => props.colors?.[i] ?? '#6B7280'"
        :innerRadius="innerRadius"
      />
    </VisSingleContainer>
  </div>
  <div v-else class="w-full h-64 flex items-center justify-center text-gray-500">
    No data available
  </div>
</template>
