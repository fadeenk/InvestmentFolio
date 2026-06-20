<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { useSyncStore } from '~/stores/sync.store'
import { useUiStore } from '~/stores/ui'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'
import { useRoute } from '#imports'

const vault = useVaultStore()
const sync = useSyncStore()
const ui = useUiStore()
const route = useRoute()

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
    return ['border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]'].join(' ')
  }

  if (ui.banner.type === 'warning') {
    return ['border-[var(--color-signal-amber)]/30 bg-[var(--color-signal-amber)]/10 text-[var(--color-signal-amber)]'].join(' ')
  }

  return ['border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]'].join(' ')
})

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (vault.hasUnsavedChanges) {
    event.preventDefault()
    event.returnValue = ''
  }
}

if (import.meta.client) {
  window.addEventListener('beforeunload', onBeforeUnload)
}

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})

function openImportSettings() {
  navigateTo('/settings')
}

function dismissBanner() {
  ui.clearBanner()
}
</script>

<template>
  <UApp>
    <!-- Locked state: minimal page content only -->
    <template v-if="!isUnlocked">
      <NuxtPage />
    </template>

    <!-- Unlocked state: sidebar + top strip + content -->
    <template v-else>
      <div class="flex h-screen">
        <!-- Desktop sidebar (hidden on mobile) -->
        <AppSidebar class="hidden md:block" />

        <!-- Mobile bottom tab bar (hidden on desktop) -->
        <div
          class="safe-area-bottom fixed right-0 bottom-0 left-0 z-50 flex h-14 items-center justify-around border-t border-(--ui-border) bg-(--ui-bg) md:hidden"
        >
          <NuxtLink
            v-for="item in [
              { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
              { label: 'Positions', icon: 'i-lucide-bar-chart-3', to: '/positions' },
              { label: 'Transactions', icon: 'i-lucide-arrow-left-right', to: '/transactions' },
              { label: 'Income', icon: 'i-lucide-trending-up', to: '/income' },
              { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
            ]"
            :key="item.to"
            :to="item.to"
            class="flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors"
            :class="route.path === item.to || route.path.startsWith(item.to + '/') ? 'text-[var(--color-accent)]' : 'text-(--ui-text-muted)'"
          >
            <UIcon :name="item.icon" class="h-4 w-4" />
            {{ item.label }}
          </NuxtLink>
        </div>

        <!-- Main content area -->
        <div class="flex flex-1 flex-col pb-14 md:pb-0 md:pl-14">
          <AppTopStrip />

          <!-- Banner -->
          <div v-if="ui.banner" class="mx-4 mt-2">
            <div class="flex items-center justify-between rounded-sm border px-3 py-2 text-xs" :class="bannerClasses">
              <span>{{ ui.banner.message }}</span>
              <UButton label="Dismiss" size="xs" color="neutral" variant="ghost" @click="dismissBanner" />
            </div>
          </div>

          <!-- Scrollable page content -->
          <div class="min-h-0 flex-1 overflow-y-auto">
            <UMain>
              <NuxtPage />
            </UMain>
          </div>

          <AppFooter />
        </div>
      </div>
    </template>

    <!-- Auth settings modal -->
    <UModal v-model:open="settingsOpen" title="Settings" description="Import status" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="space-y-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-sm border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Import status</p>
              <p class="text-base font-semibold">{{ authStatusLabel }}</p>
            </div>
            <div class="rounded-sm border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Imported records</p>
              <p class="text-base font-semibold">{{ vault.payload?.lastSyncSummary?.transactionsAdded ?? 0 }}</p>
            </div>
            <div class="rounded-sm border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Last import</p>
              <p class="text-base font-semibold">
                {{ vault.payload?.lastSyncSummary?.completedAt ? new Date(vault.payload.lastSyncSummary.completedAt).toLocaleString() : 'Never' }}
              </p>
            </div>
            <div class="rounded-sm border border-(--ui-border) p-3">
              <p class="text-sm text-(--ui-text-muted)">Deduplicated</p>
              <p class="text-base font-semibold">{{ vault.payload?.lastSyncSummary?.deduplicatedCount ?? 0 }}</p>
            </div>
          </div>
          <p class="text-sm text-(--ui-text-muted)">Use settings to import transaction files and manage accounts.</p>
          <p v-if="sync.lastError" class="rounded-sm bg-[var(--color-signal-red)]/15 p-2 text-sm font-[var(--font-mono)] text-[var(--color-signal-red)]">
            {{ sync.lastError }}
          </p>
        </div>
      </template>
      <template #footer>
        <UButton label="Open settings" color="neutral" variant="outline" @click="openImportSettings" />
        <UButton label="Import transactions" color="primary" @click="openImportSettings" />
      </template>
    </UModal>
  </UApp>
</template>
