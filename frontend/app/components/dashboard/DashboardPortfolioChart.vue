<script setup lang="ts">
defineProps<{
  data: { date: string; value: number }[]
  timeRange: string
}>()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Portfolio Value</h2>
        <span class="text-xs text-(--ui-text-muted)">{{ timeRange }}</span>
      </div>
    </template>
    <ApexLineChart :data="data" />
  </UCard>
</template>
