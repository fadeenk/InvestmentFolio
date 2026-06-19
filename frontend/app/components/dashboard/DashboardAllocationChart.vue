<script setup lang="ts">
defineProps<{
  data: { label: string; value: number }[]
}>()
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Asset Allocation</span>
    </div>
    <ApexDonutChart :data="data" />
  </div>
</template>
