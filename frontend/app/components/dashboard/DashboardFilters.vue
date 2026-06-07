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
  <UCard>
    <template #header>
      <div class="space-y-3">
        <div>
          <h2 class="text-lg font-semibold">Filters</h2>
          <p class="text-sm text-(--ui-text-muted)">Select account and time range for chart data.</p>
        </div>

        <div class="space-y-2">
          <p class="text-xs font-medium tracking-wide text-(--ui-text-muted) uppercase">Account</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="option in accountOptions"
              :key="option.label"
              :label="option.label"
              size="xs"
              :color="selectedAccountId === option.id ? 'primary' : 'neutral'"
              :variant="selectedAccountId === option.id ? 'solid' : 'outline'"
              @click="emit('selectAccount', option.id)"
            />
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-xs font-medium tracking-wide text-(--ui-text-muted) uppercase">Range</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="option in timeRangeOptions"
              :key="option"
              :label="option"
              size="xs"
              :color="selectedTimeRange === option ? 'primary' : 'neutral'"
              :variant="selectedTimeRange === option ? 'solid' : 'outline'"
              @click="emit('selectRange', option)"
            />
          </div>
        </div>

        <div class="border-t border-(--ui-border)/60 pt-3">
          <div class="flex flex-wrap items-center gap-3">
            <UButton label="Refresh Prices" color="primary" variant="outline" size="sm" :loading="isSyncing" :disabled="isSyncing" @click="emit('refresh')" />
            <span v-if="lastError" class="text-xs text-red-600 dark:text-red-300">
              {{ lastError }}
            </span>
            <span v-if="syncStatus === 'SUCCESS' && !isSyncing" class="text-xs text-emerald-600 dark:text-emerald-300"> Prices updated </span>
          </div>
        </div>
      </div>
    </template>
  </UCard>
</template>
