<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: { accountName: string; currentYear: number; priorYear: number }[]
  currentYear: number
  priorYear: number
}>()

const chartSeries = computed(() => [
  { name: String(props.priorYear), data: props.data.map((d) => d.priorYear), color: '#94a3b8' },
  { name: String(props.currentYear), data: props.data.map((d) => d.currentYear), color: '#3b82f6' },
])

const categories = computed(() => props.data.map((d) => d.accountName))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Income by Account</h2>
        <span class="text-xs text-(--ui-text-muted)">{{ priorYear }} vs {{ currentYear }}</span>
      </div>
    </template>
    <ApexStackedBar :categories="categories" :series="chartSeries" />
  </UCard>
</template>
