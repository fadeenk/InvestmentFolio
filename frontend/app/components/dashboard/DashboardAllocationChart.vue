<script setup lang="ts">
defineProps<{
  data: { label: string; value: number }[]
}>()
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">Asset Allocation</h2>
    </template>
    <ApexDonutChart :data="data" />
  </UCard>
</template>
