<script setup lang="ts">
import { useVaultStore } from '~/stores/vault.store'
import { computed } from 'vue'

const vault = useVaultStore()

const lastSavedLabel = computed(() => {
  if (!vault.payload?.metadata.lastSavedAt) return '\u2014'
  return new Date(vault.payload.metadata.lastSavedAt).toLocaleString()
})

const lastImportLabel = computed(() => {
  if (!vault.payload?.lastSyncSummary?.completedAt) return 'Never'
  return new Date(vault.payload.lastSyncSummary.completedAt).toLocaleString()
})

const lastSyncLabel = computed(() => {
  if (!vault.payload?.lastSyncedAt) return 'Never'
  return new Date(vault.payload.lastSyncedAt).toLocaleString()
})
</script>

<template>
  <footer class="text-2xs flex items-center justify-between border-t border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-1">
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1">
        <span v-if="vault.isSaving" class="flex items-center gap-1 text-(--ui-text-muted)">
          <UIcon name="i-lucide-loader-circle" class="h-2.5 w-2.5 animate-spin" />
          Saving
        </span>
        <span v-else-if="vault.hasUnsavedChanges" class="flex items-center gap-1 text-[var(--color-signal-amber)]">
          <span class="h-1 w-1 rounded-full bg-[var(--color-signal-amber)]" />
          Unsaved
        </span>
        <span v-else class="flex items-center gap-1 text-[var(--color-accent)]">
          <span class="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
          Saved
        </span>
        <UButton
          v-if="vault.hasUnsavedChanges"
          icon="i-lucide-save"
          size="xs"
          color="primary"
          variant="solid"
          :loading="vault.isSaving"
          @click="vault.saveVault()"
        />
      </div>
      <span class="text-(--ui-text-muted)">{{ lastSavedLabel }}</span>
    </div>
    <div class="flex items-center gap-2 text-(--ui-text-muted)">
      <span>Import: {{ lastImportLabel }}</span>
      <span>Sync: {{ lastSyncLabel }}</span>
      <span>Encrypted at rest &bull; 2026</span>
    </div>
  </footer>
</template>
