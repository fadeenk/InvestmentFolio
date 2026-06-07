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

    <PieChart :data="data" />
  </UCard>
</template>
