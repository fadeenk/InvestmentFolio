<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: { accountName: string; currentYear: number; priorYear: number }[]
  currentYear: number
  priorYear: number
}>()

const chartSeries = computed(() => [
  { name: String(props.priorYear), data: props.data.map((d) => d.priorYear), color: 'var(--color-text-disabled, #5f6368)' },
  { name: String(props.currentYear), data: props.data.map((d) => d.currentYear), color: 'var(--color-signal-blue, #40c4ff)' },
])

const categories = computed(() => props.data.map((d) => d.accountName))
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="flex items-center justify-between border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Income by Account</span>
      <span class="text-2xs text-(--ui-text-muted)">{{ priorYear }} vs {{ currentYear }}</span>
    </div>
    <ApexStackedBar :categories="categories" :series="chartSeries" />
  </div>
</template>
