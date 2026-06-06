<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSyncStore } from '~/stores/sync.store'
import { useUiStore } from '~/stores/ui'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()
const sync = useSyncStore()
const ui = useUiStore()

const title = 'iFolio'
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
  if (sync.isSyncing) return 'Importing'
  if (vault.payload?.lastSyncSummary) return 'Ready'
  return 'Idle'
})

const bannerClasses = computed(() => {
  if (!ui.banner) return ''

  if (ui.banner.type === 'success') {
    return ['border-emerald-200 bg-emerald-50 text-emerald-800', 'dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'].join(' ')
  }

  if (ui.banner.type === 'warning') {
    return ['border-amber-200 bg-amber-50 text-amber-800', 'dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'].join(' ')
  }

  return ['border-red-200 bg-red-50 text-red-800', 'dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'].join(' ')
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

function openImportSettings() {
  navigateTo('/settings')
}

function dismissBanner() {
  ui.clearBanner()
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
            <UButton label="Positions" to="/positions" size="xs" color="neutral" variant="ghost" />
            <UButton label="Transactions" to="/transactions" size="xs" color="neutral" variant="ghost" />
            <UButton label="Income" to="/income" size="xs" color="neutral" variant="ghost" />
            <UButton label="Settings" to="/settings" size="xs" color="neutral" variant="ghost" />
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

    <div v-if="isUnlocked && ui.banner" class="mx-auto mt-4 mb-4 w-full max-w-6xl px-4">
      <div class="flex items-center justify-between rounded-lg border p-3 text-sm" :class="bannerClasses">
        <span>{{ ui.banner.message }}</span>
        <UButton label="Dismiss" size="xs" color="neutral" variant="ghost" @click="dismissBanner" />
      </div>
    </div>

    <UMain>
      <NuxtPage />
    </UMain>

    <UModal v-model:open="settingsOpen" title="Settings" description="Import status" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="space-y-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Import status</p>
              <p class="text-base font-semibold">
                {{ authStatusLabel }}
              </p>
            </div>

            <div class="rounded-lg border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Imported records</p>
              <p class="text-base font-semibold">
                {{ vault.payload?.lastSyncSummary?.transactionsAdded ?? 0 }}
              </p>
            </div>

            <div class="rounded-lg border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Last import</p>
              <p class="text-base font-semibold">
                {{ vault.payload?.lastSyncSummary?.completedAt ? new Date(vault.payload.lastSyncSummary.completedAt).toLocaleString() : 'Never' }}
              </p>
            </div>

            <div class="rounded-lg border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Deduplicated</p>
              <p class="text-base font-semibold">
                {{ vault.payload?.lastSyncSummary?.deduplicatedCount ?? 0 }}
              </p>
            </div>
          </div>

          <div v-if="sync.expirationWarning" class="rounded-md bg-amber-500/15 p-2 text-sm text-amber-700 dark:text-amber-200">
            Import is currently in progress.
          </div>

          <p class="text-sm text-(--ui-text-muted)">Use settings to import transaction files and manage accounts.</p>

          <p v-if="sync.lastError" class="rounded-md bg-red-500/15 p-2 text-sm text-red-700 dark:text-red-200">
            {{ sync.lastError }}
          </p>
        </div>
      </template>

      <template #footer>
        <UButton label="Open settings" color="neutral" variant="outline" @click="openImportSettings" />
        <UButton label="Import transactions" color="primary" @click="openImportSettings" />
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
