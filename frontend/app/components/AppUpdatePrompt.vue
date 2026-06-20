<script setup lang="ts">
import { computed } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()

const show = computed(() => needRefresh.value || offlineReady.value)
const isRefresh = computed(() => needRefresh.value)
const message = computed(() => {
  if (needRefresh.value) return 'New version available — refresh to update.'
  if (offlineReady.value) return 'Ready for offline use.'
  return ''
})

function onRefresh() {
  updateServiceWorker(true).catch(() => {})
}

function onDismiss() {
  updateServiceWorker(false).catch(() => {})
}
</script>

<template>
  <div
    v-if="show"
    data-testid="update-prompt"
    :class="[
      'fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3',
      'rounded-sm border border-(--ui-border) bg-(--ui-bg) px-4 py-3 shadow-lg md:bottom-4',
    ]"
  >
    <span class="text-sm text-(--ui-text)">{{ message }}</span>
    <UButton v-if="isRefresh" label="Refresh" size="xs" color="primary" @click="onRefresh" />
    <UButton v-else label="Got it" size="xs" color="neutral" variant="ghost" @click="onDismiss" />
  </div>
</template>
