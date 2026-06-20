<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: { date: string; value: number }[]
  timeRange: string
}>()

const GREEN = '#00c853'
const RED = '#ff5252'

const performanceData = computed(() => {
  if (props.data.length === 0) return []
  const base = props.data[0]!.value
  if (base === 0) return []
  return props.data.map((d) => ({
    date: d.date,
    value: ((d.value - base) / base) * 100,
  }))
})

const lineColor = computed(() => {
  if (performanceData.value.length === 0) return GREEN
  const latest = performanceData.value[performanceData.value.length - 1]!.value
  return latest >= 0 ? GREEN : RED
})

const hasData = computed(() => performanceData.value.length > 0)
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="flex items-center justify-between border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Portfolio Performance</span>
      <span class="text-2xs text-(--ui-text-muted)">{{ timeRange }}</span>
    </div>
    <ApexLineChart v-if="hasData" :data="performanceData" :color="lineColor" format="percent" />
    <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
  </div>
</template>
