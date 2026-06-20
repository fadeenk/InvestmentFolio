<script setup lang="ts">
import { computed } from 'vue'
import { useVaultStore } from '~/stores/vault.store'
import { useRouter } from '#imports'

const vault = useVaultStore()
const router = useRouter()

const refreshExpiryLabel = computed(() => {
  if (!vault.payload?.lastSyncSummary?.completedAt) return 'No imports yet'
  return new Date(vault.payload.lastSyncSummary.completedAt).toLocaleString()
})

const lastSavedLabel = computed(() => {
  if (!vault.payload?.metadata.lastSavedAt) return '\u2014'
  return new Date(vault.payload.metadata.lastSavedAt).toLocaleString()
})

async function handleLock() {
  if (vault.hasUnsavedChanges) {
    const discard = window.confirm('You have unsaved changes. Discard them?')
    if (!discard) return
  }
  vault.lockVault()
  await router.push('/')
}
</script>

<template>
  <div class="w-full max-w-md">
    <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-6 shadow-lg">
      <!-- Terminal success -->
      <div class="mb-4 flex items-center gap-2 border-b border-(--ui-border) pb-3">
        <span class="text-xs font-[var(--font-mono)] text-(--ui-text-muted)">ifolio@vault:~$</span>
        <span class="text-xs font-[var(--font-mono)] text-[var(--color-accent)]">unlocked</span>
      </div>

      <!-- Compact summary -->
      <div class="mb-4 grid grid-cols-2 gap-3">
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg) p-3">
          <p class="text-xs text-(--ui-text-muted)">Accounts</p>
          <p class="text-lg font-[var(--font-mono)] font-bold text-(--ui-text)">{{ vault.accounts.length }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg) p-3">
          <p class="text-xs text-(--ui-text-muted)">Last saved</p>
          <p class="text-sm font-[var(--font-mono)] text-(--ui-text)">
            {{ lastSavedLabel }}
          </p>
        </div>
      </div>

      <!-- Import status -->
      <div class="mb-4 rounded-sm border border-(--ui-border) bg-(--ui-bg) p-3">
        <div class="flex items-center justify-between">
          <span class="text-xs text-(--ui-text-muted)">Last import:</span>
          <span class="text-xs font-[var(--font-mono)] text-(--ui-text)">{{ refreshExpiryLabel }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-2">
        <UButton label="$ cd dashboard" color="primary" size="sm" block to="/dashboard" />
        <div class="flex gap-2">
          <UButton label="Settings" color="neutral" variant="outline" size="xs" block to="/settings" />
          <UButton label="Lock" color="neutral" variant="ghost" size="xs" block @click="handleLock" />
        </div>
      </div>
    </div>
  </div>
</template>
