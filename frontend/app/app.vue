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

const refreshExpiryLabel = computed(() => formatRemaining(sync.refreshTokenSecondsRemaining))
const accessExpiryLabel = computed(() => formatRemaining(sync.accessTokenSecondsRemaining))

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

function dismissBanner() {
  ui.clearBanner()
}

function formatRemaining(secondsRemaining: number | null): string {
  if (secondsRemaining === null) return 'Unknown'

  if (secondsRemaining <= 0) {
    return 'Expired'
  }

  const hours = Math.floor(secondsRemaining / 3600)
  if (hours < 1) return 'Less than 1 hour'
  if (hours < 24) return `${hours}h remaining`

  const days = Math.floor(hours / 24)
  return `${days}d remaining`
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

    <div v-if="isUnlocked && ui.banner" class="mx-auto mt-4 mb-4 w-full max-w-6xl px-4">
      <div class="flex items-center justify-between rounded-lg border p-3 text-sm" :class="bannerClasses">
        <span>{{ ui.banner.message }}</span>
        <UButton label="Dismiss" size="xs" color="neutral" variant="ghost" @click="dismissBanner" />
      </div>
    </div>

    <UMain>
      <NuxtPage />
    </UMain>

    <UModal v-model:open="settingsOpen" title="Settings" description="Authentication" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="space-y-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Schwab status</p>
              <p class="text-base font-semibold">
                {{ authStatusLabel }}
              </p>
            </div>

            <div class="rounded-lg border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Connected accounts</p>
              <p class="text-base font-semibold">
                {{ sync.connectedAccountCount }}
              </p>
            </div>

            <div class="rounded-lg border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Access token</p>
              <p class="text-base font-semibold">
                {{ accessExpiryLabel }}
              </p>
            </div>

            <div class="rounded-lg border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Refresh token</p>
              <p class="text-base font-semibold">
                {{ refreshExpiryLabel }}
              </p>
            </div>
          </div>

          <div v-if="sync.expirationWarning" class="rounded-md bg-amber-500/15 p-2 text-sm text-amber-700 dark:text-amber-200">
            Re-authorization is recommended within 24 hours to avoid interruptions.
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
