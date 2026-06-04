<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSyncStore } from '~/stores/sync.store'
import { useUiStore } from '~/stores/ui'
import { useVaultStore } from '~/stores/vault.store'
import { TokenStatus, VaultStatus } from '~/types/vault'

const vault = useVaultStore()
const sync = useSyncStore()
const ui = useUiStore()

const title = 'Folio'
const description = 'Private portfolio tracker — all data encrypted at rest'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
})

const isUnlocked = computed(() => vault.status === VaultStatus.UNLOCKED)

const settingsOpen = computed({
  get: () => ui.activeModal === 'auth-settings',
  set: (value: boolean) => {
    if (value) {
      ui.openModal('auth-settings')
    } else {
      ui.closeModal()
    }
  },
})

const authStatusLabel = computed(() => {
  switch (sync.tokenStatus) {
    case TokenStatus.VALID:
      return 'Connected'
    case TokenStatus.EXPIRING_SOON:
      return 'Expiring soon'
    case TokenStatus.EXPIRED:
      return 'Expired'
    default:
      return 'Not connected'
  }
})

watch(
  () => vault.status,
  async () => {
    if (vault.status === VaultStatus.UNLOCKED) {
      await sync.ensureSyncedAfterUnlockOrAuth()
    }
  },
)

function openAuthSettings() {
  ui.openModal('auth-settings')
}

function connectSchwab() {
  sync.initiateOAuthFlow()
}
</script>

<template>
  <UApp>
    <template v-if="isUnlocked">
      <UHeader>
        <template #left>
          <div class="flex items-center gap-3">
            <NuxtLink to="/">
              <AppLogo class="h-6 w-auto shrink-0" />
            </NuxtLink>
            <UButton label="Home" to="/" size="xs" color="neutral" variant="ghost" />
            <UButton label="Dashboard" to="/dashboard" size="xs" color="neutral" variant="ghost" />
          </div>
        </template>

        <template #right>
          <UColorModeButton />
          <UButton icon="i-lucide-settings" size="xs" color="neutral" variant="ghost" aria-label="Open auth settings" @click="openAuthSettings" />

          <div class="flex items-center gap-2">
            <span v-if="vault.isSaving" class="flex items-center gap-1 text-xs text-(--ui-text-muted)">
              <UIcon name="i-lucide-loader-circle" class="h-3 w-3 animate-spin" />
              Saving...
            </span>
            <span v-else-if="vault.hasUnsavedChanges" class="text-xs text-amber-500"> Unsaved </span>
            <span v-else class="text-xs text-(--ui-text-muted)"> Saved </span>
            <UButton v-if="vault.hasUnsavedChanges" label="Save" size="xs" color="primary" @click="vault.saveVault()" />
            <UButton label="Lock" size="xs" color="neutral" variant="ghost" @click="vault.lockVault()" />
          </div>
        </template>
      </UHeader>
    </template>

    <UMain>
      <NuxtPage />
    </UMain>

    <UModal v-model:open="settingsOpen" title="Settings" description="Authentication" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="space-y-4">
          <div class="rounded-lg border border-(--ui-border) p-3">
            <p class="text-sm text-(--ui-text-muted)">Schwab status</p>
            <p class="text-base font-semibold">
              {{ authStatusLabel }}
            </p>
          </div>

          <p class="text-sm text-(--ui-text-muted)">Use this panel to reconnect or verify token health before running sync.</p>

          <p v-if="sync.lastError" class="rounded-md bg-red-500/15 p-2 text-sm text-red-700 dark:text-red-200">
            {{ sync.lastError }}
          </p>
        </div>
      </template>

      <template #footer>
        <UButton label="Refresh status" color="neutral" variant="outline" @click="sync.pollTokenStatus" />
        <UButton :label="sync.requiresReauth ? 'Connect Schwab' : 'Re-authorize Schwab'" color="primary" @click="connectSchwab" />
      </template>
    </UModal>

    <template v-if="isUnlocked">
      <USeparator icon="i-lucide-lock" />
      <UFooter>
        <template #left>
          <p class="text-sm text-(--ui-text-muted)">Encrypted at rest &bull; {{ new Date().getFullYear() }}</p>
        </template>
      </UFooter>
    </template>
  </UApp>
</template>
