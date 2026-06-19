<script setup lang="ts">
import type { TimeRange } from '~/types/enums'

defineProps<{
  accountOptions: { id: string | null; label: string }[]
  selectedAccountId: string | null
  selectedTimeRange: TimeRange
  timeRangeOptions: TimeRange[]
  isSyncing: boolean
  syncStatus: string
  lastError: string | null
}>()

const emit = defineEmits<{
  selectAccount: [id: string | null]
  selectRange: [range: TimeRange]
  refresh: []
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
    <!-- Account pills -->
    <div class="flex items-center gap-1.5">
      <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Account</span>
      <UButton
        v-for="option in accountOptions"
        :key="option.label"
        :label="option.label"
        size="xs"
        :color="selectedAccountId === option.id ? 'primary' : 'neutral'"
        :variant="selectedAccountId === option.id ? 'solid' : 'ghost'"
        @click="emit('selectAccount', option.id)"
      />
    </div>

    <span class="h-4 w-px bg-(--ui-border)" />

    <!-- Range segmented control -->
    <div class="flex items-center gap-1.5">
      <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Range</span>
      <UButton
        v-for="option in timeRangeOptions"
        :key="option"
        :label="option"
        size="xs"
        :color="selectedTimeRange === option ? 'primary' : 'neutral'"
        :variant="selectedTimeRange === option ? 'solid' : 'ghost'"
        @click="emit('selectRange', option)"
      />
    </div>

    <div class="ml-auto flex items-center gap-2">
      <UButton icon="i-lucide-refresh-cw" size="xs" color="neutral" variant="ghost" :loading="isSyncing" :disabled="isSyncing" @click="emit('refresh')" />
      <span v-if="lastError" class="text-2xs text-[var(--color-signal-red)]">{{ lastError }}</span>
      <span v-if="syncStatus === 'SUCCESS' && !isSyncing" class="text-2xs text-[var(--color-accent)]">Updated</span>
    </div>
  </div>
</template>
