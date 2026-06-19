<script setup lang="ts">
defineProps<{
  data: { date: string; value: number }[]
  timeRange: string
}>()
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="flex items-center justify-between border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Portfolio Value</span>
      <span class="text-2xs text-(--ui-text-muted)">{{ timeRange }}</span>
    </div>
    <ApexLineChart :data="data" />
  </div>
</template>
