<script setup lang="ts">
import { useVaultStore } from '~/stores/vault.store'
import { useOAuthStore } from '~/stores/oauth.store'
import { useSyncStore } from '~/stores/sync.store'
import { useUiStore } from '~/stores/ui'
import { computed } from 'vue'

const vault = useVaultStore()
const oauth = useOAuthStore()
const sync = useSyncStore()
const ui = useUiStore()

const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

function toggleColorMode() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}

const connectionLabel = computed(() => {
  if (sync.isSyncing) return 'Syncing...'
  if (oauth.connectedAccountCount > 0) return 'Schwab'
  return 'Disconnected'
})

const connectionColor = computed(() => {
  if (sync.isSyncing) return 'text-[var(--color-signal-amber)]'
  if (oauth.connectedAccountCount > 0) return 'text-[var(--color-accent)]'
  return 'text-[var(--color-signal-red)]'
})
</script>

<template>
  <div class="flex h-10 items-center justify-between border-b border-(--ui-border) bg-(--ui-bg-elevated) px-4">
    <!-- Left: breadcrumb-style page context -->
    <div class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
      <NuxtLink to="/" class="transition-colors hover:text-(--ui-text)">iFolio</NuxtLink>
      <span>/</span>
      <span class="text-(--ui-text)">{{ ui.activeModal ? 'Settings' : '' }}</span>
    </div>

    <!-- Right: status indicators -->
    <div class="flex items-center gap-3">
      <!-- Save status -->
      <div class="flex items-center gap-1.5">
        <span v-if="vault.isSaving" class="flex items-center gap-1 text-xs text-(--ui-text-muted)">
          <UIcon name="i-lucide-loader-circle" class="h-3 w-3 animate-spin" />
          Saving
        </span>
        <span v-else-if="vault.hasUnsavedChanges" class="flex items-center gap-1 text-xs text-[var(--color-signal-amber)]">
          <span class="h-1.5 w-1.5 rounded-full bg-[var(--color-signal-amber)]" />
          Unsaved
        </span>
        <span v-else class="flex items-center gap-1 text-xs text-[var(--color-accent)]">
          <span class="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
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

      <!-- Connection status -->
      <div class="flex items-center gap-1 text-xs" :class="connectionColor">
        <span class="h-1.5 w-1.5 rounded-full bg-current" />
        {{ connectionLabel }}
      </div>

      <!-- Color mode toggle -->
      <UButton :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'" size="xs" color="neutral" variant="ghost" @click="toggleColorMode" />

      <!-- Lock button -->
      <UButton icon="i-lucide-lock" size="xs" color="neutral" variant="ghost" @click="vault.lockVault()" />
    </div>
  </div>
</template>
