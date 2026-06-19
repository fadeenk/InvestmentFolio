# Terminal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Visually restructure the InvestmentFolio frontend with an institutional-terminal aesthetic — sidebar nav, terminal color palette, compact data-dense layouts, and terminal-prompt vault experience.

**Architecture:** Tailwind v4 + NuxtUI v4 theming overrides CSS variables for the charcoal-based palette. Layout shifts from header-nav to fixed sidebar + top strip. Existing pages retain their routes, stores, and data flows — only templates and styles change. Chart primitives accept terminal-themed options.

**Tech Stack:** Nuxt 4, NuxtUI v4 + `@nuxt/ui` imports, Tailwind v4, ApexCharts 5 + vue3-apexcharts, Vue 3.5, Pinia 3

## Global Constraints

- No new pages or routes
- No changes to data flow, stores, or vault encryption model
- No changes to the Cloudflare Worker
- All existing page data must render identically — only visual/structure changes
- Replace native `<select>`/`<input>` with NuxtUI `USelect`/`UInput` where noted
- Square corners (`rounded-sm`), dark input bg, light text, green focus ring
- Error messages: monospaced (`font-[var(--font-mono)]`), red text on lighter red bg
- No `no-unused-vars` or type errors — CI blockers
- `@theme static` block stays; no dynamic theme tokens
- All pages keep their `<script setup>` logic entirely intact — only `<template>` changes

---

### Task 1: Theme Foundation — CSS Variables + NuxtUI Config

**Files:**

- Modify: `frontend/app/assets/css/main.css`
- Modify: `frontend/app/app.config.ts`

**Interfaces:**

- Consumes: nothing
- Produces: terminal color CSS variables consumed by all subsequent tasks; NuxtUI primary/neutral config

- [ ] **Step 1: Update `app.config.ts` — change neutral from `slate` to `zinc`**

```ts
// frontend/app/app.config.ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc',
    },
  },
})
```

- [ ] **Step 2: Update `main.css` — replace green palette with terminal color system**

Replace the entire `main.css` content:

```css
@import 'tailwindcss';
@import '@nuxt/ui';

@theme static {
  --font-sans: 'Public Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

/* ── Light theme (default) ── */
:root {
  --color-bg: #f5f5f7;
  --color-bg-elevated: #ffffff;
  --color-text: #1a1a2e;
  --color-text-muted: #6b7280;
  --color-text-disabled: #9ca3af;
  --color-border: #e5e7eb;
  --color-border-visible: #d1d5db;
  --color-accent: #059669;
  --color-accent-hover: #047857;
  --color-accent-active: #065f46;
  --color-signal-red: #dc2626;
  --color-signal-amber: #d97706;
  --color-signal-blue: #2563eb;
  --color-chart-bg: #ffffff;
  --color-chart-grid: #e5e7eb;
}

/* ── Dark theme ── */
.dark {
  --color-bg: #0f1117;
  --color-bg-elevated: #1a1d27;
  --color-text: #e8eaed;
  --color-text-muted: #9aa0a6;
  --color-text-disabled: #5f6368;
  --color-border: #2d3140;
  --color-border-visible: #3a3f52;
  --color-accent: #00c853;
  --color-accent-hover: #00e676;
  --color-accent-active: #009624;
  --color-signal-red: #ff5252;
  --color-signal-amber: #ffd740;
  --color-signal-blue: #40c4ff;
  --color-chart-bg: #1a1d27;
  --color-chart-grid: #2d3140;
}

/* Override NuxtUI CSS variables */
:root {
  --ui-bg: var(--color-bg);
  --ui-bg-elevated: var(--color-bg-elevated);
  --ui-text: var(--color-text);
  --ui-text-muted: var(--color-text-muted);
  --ui-border: var(--color-border);
  --ui-primary: var(--color-accent);
}
.dark {
  --ui-bg: var(--color-bg);
  --ui-bg-elevated: var(--color-bg-elevated);
  --ui-text: var(--color-text);
  --ui-text-muted: var(--color-text-muted);
  --ui-border: var(--color-border);
  --ui-primary: var(--color-accent);
}

/* Custom thin scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-visible);
}

/* Page transition */
.page-enter-active,
.page-leave-active {
  transition:
    opacity 80ms ease,
    transform 80ms ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
```

- [ ] **Step 3: Update `signClass` in format.ts to use terminal signal colors**

```ts
// frontend/app/utils/format.ts
export function signClass(value: number): string {
  if (value > 0) return 'text-[var(--color-accent)]'
  if (value < 0) return 'text-[var(--color-signal-red)]'
  return 'text-(--ui-text-muted)'
}
```

- [ ] **Step 4: Verify theme change**

Run: `npm run --workspace=frontend lint`
Expected: no errors

---

### Task 2: AppSidebar Component

**Files:**

- Create: `frontend/app/components/AppSidebar.vue`

**Interfaces:**

- Consumes: `useVaultStore` for `isUnlocked`, `useRouter`/`useRoute` for active state
- Produces: sidebar navigation component used by app.vue

- [ ] **Step 1: Create AppSidebar.vue**

```vue
<script setup lang="ts">
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'
import { computed } from 'vue'
import { useRoute } from '#imports'

const vault = useVaultStore()
const route = useRoute()

const isUnlocked = computed(() => vault.status === VaultStatus.UNLOCKED)

const navItems = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: 'Positions', icon: 'i-lucide-bar-chart-3', to: '/positions' },
  { label: 'Transactions', icon: 'i-lucide-arrow-left-right', to: '/transactions' },
  { label: 'Income', icon: 'i-lucide-trending-up', to: '/income' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
]

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <aside
    class="group fixed top-0 left-0 z-50 flex h-full w-14 flex-col border-r border-(--ui-border) bg-(--ui-bg) transition-all duration-200 ease-in-out hover:w-50"
  >
    <!-- Logo area -->
    <div class="flex h-14 items-center justify-center border-b border-(--ui-border)">
      <NuxtLink to="/" class="flex items-center gap-2 overflow-hidden">
        <AppLogo class="h-5 w-5 shrink-0" />
        <span class="text-sm font-bold whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">iFolio</span>
      </NuxtLink>
    </div>

    <!-- Vault indicator dot -->
    <div class="flex items-center justify-center border-b border-(--ui-border) py-2">
      <div class="h-2 w-2 shrink-0 rounded-full" :class="isUnlocked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-signal-amber)]'" />
      <span class="ml-2 text-xs whitespace-nowrap text-(--ui-text-muted) opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {{ isUnlocked ? 'Unlocked' : 'Locked' }}
      </span>
    </div>

    <!-- Navigation -->
    <nav class="flex flex-col gap-1 p-2">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-150 hover:bg-(--ui-bg-elevated)"
        :class="isActive(item.to) ? 'text-[var(--color-accent)]' : 'text-(--ui-text-muted)'"
      >
        <!-- Active indicator bar -->
        <div v-if="isActive(item.to)" class="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r bg-[var(--color-accent)]" />
        <UIcon :name="item.icon" class="h-4 w-4 shrink-0" />
        <span class="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </aside>
</template>
```

- [ ] **Step 2: Verify component lints**

Run: `npm run --workspace=frontend lint`
Expected: no errors

---

### Task 3: AppTopStrip Component

**Files:**

- Create: `frontend/app/components/AppTopStrip.vue`

**Interfaces:**

- Consumes: `useVaultStore`, `useOAuthStore`, `useSyncStore`, `useUiStore`, `useColorMode`
- Produces: top strip component used by app.vue

- [ ] **Step 1: Create AppTopStrip.vue**

```vue
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
          size="2xs"
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
      <UButton :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'" size="2xs" color="neutral" variant="ghost" @click="toggleColorMode" />

      <!-- Lock button -->
      <UButton icon="i-lucide-lock" size="2xs" color="neutral" variant="ghost" @click="vault.lockVault()" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add `ui.activeModal` getter to the UI store if not already accessible**

Check `frontend/app/stores/ui.ts` — if there's no `activeModal` export, skip this step. The component accesses `ui.activeModal` which is used in settings modal.

- [ ] **Step 3: Verify component lints**

Run: `npm run --workspace=frontend lint`
Expected: no errors

---

### Task 4: Restructure app.vue Layout — Sidebar + Top Strip

**Files:**

- Modify: `frontend/app/app.vue`

**Interfaces:**

- Consumes: `AppSidebar`, `AppTopStrip` from tasks 2–3
- Produces: new app shell layout

- [ ] **Step 1: Rewrite `app.vue` template and script**

Replace the template to use sidebar + top strip layout. Keep all script logic (watch, computed, imports) identical — only change the template.

```vue
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useOAuthStore } from '~/stores/oauth.store'
import { useSyncStore } from '~/stores/sync.store'
import { useUiStore } from '~/stores/ui'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()
const oauth = useOAuthStore()
const sync = useSyncStore()
const ui = useUiStore()

const mobileMenuOpen = ref(false)

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

watch(
  () => vault.status,
  async () => {
    if (vault.status === VaultStatus.UNLOCKED) {
      await oauth.ensureSyncedAfterUnlockOrAuth()
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
    <!-- Locked state: minimal page content only -->
    <template v-if="!isUnlocked">
      <NuxtPage />
    </template>

    <!-- Unlocked state: sidebar + top strip + content -->
    <template v-else>
      <div class="flex min-h-screen">
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
              <UButton label="Dismiss" size="2xs" color="neutral" variant="ghost" @click="dismissBanner" />
            </div>
          </div>

          <!-- Page content with page transitions -->
          <UMain>
            <NuxtPage />
          </UMain>

          <!-- Minimal footer -->
          <footer class="border-t border-(--ui-border) px-4 py-2 text-xs text-(--ui-text-muted)">
            Encrypted at rest &bull; {{ new Date().getFullYear() }}
          </footer>
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
```

Note: The `route` variable is used in the mobile tab template (`route.path === ...`). Add it to the script:

```ts
import { useRoute } from '#imports'
const route = useRoute()
```

- [ ] **Step 2: Verify layout**

Run: `npm run --workspace=frontend typecheck`
Expected: no type errors

---

### Task 5: Landing Page — Terminal Vault Experience

**Files:**

- Modify: `frontend/app/pages/index.vue`

**Interfaces:**

- Consumes: `useVaultStore`
- Produces: redesigned landing page

- [ ] **Step 1: Rewrite the template of `index.vue`**

Keep the entire `<script setup>` block unchanged. Only modify the `<template>`.

The locked state becomes:

```vue
<template>
  <div class="flex min-h-screen items-center justify-center bg-(--ui-bg) px-4">
    <!-- LOCKED STATE -->
    <template v-if="vault.status === VaultStatus.LOCKED">
      <div class="w-full max-w-md">
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-6 shadow-lg">
          <!-- Terminal header -->
          <div class="mb-6 flex items-center gap-2 border-b border-(--ui-border) pb-3">
            <span class="text-xs font-[var(--font-mono)] text-(--ui-text-muted)">ifolio@vault:~$</span>
            <span class="h-4 w-2 animate-pulse bg-[var(--color-accent)]" />
          </div>

          <!-- Error -->
          <div
            v-if="vault.lastError"
            class="mb-4 rounded-sm border border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-signal-red)]"
          >
            > {{ vault.lastError }}
          </div>

          <!-- Quick open hint -->
          <div v-if="vault.isRemembered && vault.status === VaultStatus.LOCKED" class="mb-4 rounded-sm border border-(--ui-border) bg-(--ui-bg) p-3">
            <p class="text-xs font-[var(--font-mono)] text-(--ui-text-muted)">$ ls ~/.vault</p>
            <p class="mt-1 text-sm font-[var(--font-mono)] text-(--ui-text)">{{ vault.rememberedFileName }}</p>
            <div class="mt-2 flex gap-2">
              <UButton label="Quick Open" size="xs" color="primary" variant="solid" @click="handleQuickOpen" />
              <UButton label="Forget" size="xs" color="neutral" variant="ghost" @click="vault.forgetHandle()" />
            </div>
          </div>

          <!-- Passphrase input as terminal command -->
          <div class="mb-4">
            <div class="flex items-center gap-2 text-sm font-[var(--font-mono)]">
              <span class="text-[var(--color-accent)]">$</span>
              <span class="text-(--ui-text-muted)">open</span>
              <UInput
                v-model="passphrase"
                type="password"
                placeholder="passphrase"
                size="sm"
                variant="none"
                class="flex-1"
                :ui="{
                  base: 'w-full bg-transparent font-[var(--font-mono)] text-sm text-(--ui-text) placeholder:text-(--ui-text-disabled) focus:outline-none',
                }"
                @keydown.enter="handleQuickOpen"
              />
            </div>
          </div>

          <!-- Action buttons as terminal commands -->
          <div class="flex flex-col gap-2">
            <UButton label="$ open --file" color="primary" variant="outline" size="sm" block @click="showOpenDialog = true" />
            <UButton label="$ init" color="neutral" variant="ghost" size="sm" block @click="showCreateDialog = true" />
          </div>

          <!-- Bottom hint -->
          <p class="mt-4 text-center text-xs font-[var(--font-mono)] text-(--ui-text-disabled)">[Chrome, Edge, Firefox, Safari]</p>
        </div>
      </div>
    </template>

    <!-- UNLOCKING STATE -->
    <template v-else-if="vault.status === VaultStatus.UNLOCKING">
      <div class="text-center">
        <div class="mb-4 text-sm font-[var(--font-mono)] text-(--ui-text-muted)">
          <span>Decrypting key</span>
          <span class="animate-pulse">...</span>
        </div>
        <UIcon name="i-lucide-loader-circle" class="mx-auto h-5 w-5 animate-spin text-(--ui-text-muted)" />
      </div>
    </template>

    <!-- UNLOCKED STATE -->
    <template v-else-if="vault.status === VaultStatus.UNLOCKED || vault.status === VaultStatus.SAVING">
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
                {{ vault.payload?.metadata.lastSavedAt ? new Date(vault.payload.metadata.lastSavedAt).toLocaleString() : '—' }}
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

    <!-- CREATE DIALOG (unchanged modal) -->
    <UModal v-model:open="showCreateDialog" title="Create new vault" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium">Passphrase</label>
            <UInput v-model="passphrase" type="password" placeholder="Enter a strong passphrase (min 8 characters)" size="lg" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Confirm passphrase</label>
            <UInput v-model="passphraseConfirm" type="password" placeholder="Re-enter passphrase" size="lg" />
          </div>
          <p v-if="passphraseError" class="text-sm font-[var(--font-mono)] text-[var(--color-signal-red)]">{{ passphraseError }}</p>
        </div>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="closeCreateDialog" />
        <UButton label="Create vault" color="primary" @click="handleCreate" />
      </template>
    </UModal>

    <!-- OPEN DIALOG (unchanged modal) -->
    <UModal v-model:open="showOpenDialog" title="Open existing vault" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-(--ui-text-muted)">After clicking &quot;Open vault&quot;, select your <code>.iFolio</code> file.</p>
          <div>
            <label class="mb-1 block text-sm font-medium">Passphrase</label>
            <UInput v-model="passphrase" type="password" placeholder="Enter your vault passphrase" size="lg" @keydown.enter="handleOpen" />
          </div>
          <p v-if="passphraseError" class="text-sm font-[var(--font-mono)] text-[var(--color-signal-red)]">{{ passphraseError }}</p>
        </div>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="closeOpenDialog" />
        <UButton label="Open vault" color="primary" @click="handleOpen" />
      </template>
    </UModal>
  </div>
</template>
```

The key changes:

- Remove `mx-auto max-w-2xl px-4 py-12` wrapper → `flex min-h-screen items-center justify-center`
- Remove icon circles, h1, description paragraphs
- Add terminal prompt styling with monospaced fonts
- Add blinking cursor
- Error messages monospaced red
- Unlocked state: compact summary instead of cards
- Keep modal dialogs exactly the same

- [ ] **Step 2: Verify landing page**

Run: `npm run --workspace=frontend typecheck`
Expected: no errors

---

### Task 6: ApexCharts Theme — Terminal Chart Options

**Files:**

- Modify: `frontend/app/components/charts/ApexLineChart.vue`
- Modify: `frontend/app/components/charts/ApexAreaChart.vue`
- Modify: `frontend/app/components/charts/ApexDonutChart.vue`
- Modify: `frontend/app/components/charts/ApexStackedBar.vue`

**Interfaces:**

- Consumes: existing props (unchanged)
- Produces: terminal-themed chart options

- [ ] **Step 1: Update ApexLineChart.vue — add terminal theme**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    data: { date: string; value: number }[]
    color?: string
    height?: number
  }>(),
  {
    color: 'var(--color-accent, #00c853)',
    height: 260,
  },
)

const series = computed(() => [
  {
    name: 'Value',
    data: props.data.map((d) => ({ x: new Date(d.date).getTime(), y: d.value })),
  },
])

const options = computed(() => ({
  chart: {
    type: 'line' as const,
    zoom: { enabled: true, type: 'x' as const, autoScaleYaxis: true },
    toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
    background: 'transparent',
    foreColor: 'var(--color-text-muted, #9aa0a6)',
  },
  colors: [props.color],
  stroke: { curve: 'smooth' as const, width: 2 },
  xaxis: { type: 'datetime' as const, labels: { format: 'MMM dd', style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}`, style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  tooltip: {
    x: { format: 'MMM dd, yyyy' },
    y: { formatter: (v: number) => `$${v.toLocaleString()}` },
    theme: 'dark' as const,
  },
  grid: { borderColor: 'var(--color-chart-grid, #2d3140)', strokeDashArray: 3 },
}))

const chartKey = computed(() => props.data.length)
</script>

<template>
  <div v-if="data.length > 0" class="w-full">
    <apexchart :key="chartKey" type="line" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
```

- [ ] **Step 2: Update ApexDonutChart.vue — add terminal theme**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '~/utils/format'

const props = withDefaults(
  defineProps<{
    data: { label: string; value: number }[]
    height?: number
  }>(),
  { height: 300 },
)

const TERMINAL_COLORS = ['#00c853', '#40c4ff', '#ffd740', '#ff5252', '#b388ff', '#64ffda', '#ffab40']

const series = computed(() => props.data.map((d) => d.value))
const labels = computed(() => props.data.map((d) => d.label))

const options = computed(() => ({
  chart: { type: 'donut' as const, background: 'transparent', foreColor: 'var(--color-text-muted, #9aa0a6)' },
  colors: TERMINAL_COLORS.slice(0, props.data.length),
  labels: labels.value,
  legend: { show: true, position: 'bottom' as const, fontSize: '12px', labels: { colors: 'var(--color-text-muted, #9aa0a6)' } },
  tooltip: { y: { formatter: (v: number) => formatCurrency(v) }, theme: 'dark' as const },
  plotOptions: {
    pie: {
      donut: { size: '55%' },
      expandOnClick: true,
    },
  },
  responsive: [{ breakpoint: 640, options: { chart: { width: '100%' }, legend: { position: 'bottom' } } }],
  dataLabels: { style: { colors: ['var(--color-text, #e8eaed)'] } },
}))

const chartKey = computed(() => props.data.length)
</script>

<template>
  <div v-if="data.length > 0" class="w-full">
    <apexchart :key="chartKey" type="donut" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
```

- [ ] **Step 3: Update ApexAreaChart.vue — add terminal theme**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    series: { name: string; data: { x: number; y: number }[]; color: string }[]
    height?: number
  }>(),
  { height: 260 },
)

const options = computed(() => ({
  chart: {
    type: 'area' as const,
    zoom: { enabled: true, type: 'x' as const },
    toolbar: { show: true, tools: { download: true, selection: true, zoom: true, pan: true, reset: true } },
    background: 'transparent',
    foreColor: 'var(--color-text-muted, #9aa0a6)',
  },
  colors: props.series.map((s) => s.color),
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth' as const, width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 0.1, opacityFrom: 0.4, opacityTo: 0.1 } },
  xaxis: { type: 'datetime' as const, labels: { format: 'MMM dd', style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}`, style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  tooltip: { x: { format: 'MMM dd, yyyy' }, y: { formatter: (v: number) => `$${v.toLocaleString()}` }, theme: 'dark' as const },
  grid: { borderColor: 'var(--color-chart-grid, #2d3140)', strokeDashArray: 3 },
  legend: { position: 'bottom' as const, labels: { colors: 'var(--color-text-muted, #9aa0a6)' } },
}))

const chartKey = computed(() => props.series.length)
</script>

<template>
  <div v-if="series.length > 0 && series.some((s) => s.data.length > 0)" class="w-full">
    <apexchart :key="chartKey" type="area" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
```

- [ ] **Step 4: Update ApexStackedBar.vue — add terminal theme**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    categories: string[]
    series: { name: string; data: number[]; color: string }[]
    height?: number
  }>(),
  { height: 260 },
)

const options = computed(() => ({
  chart: { type: 'bar' as const, stacked: true, toolbar: { show: true }, background: 'transparent', foreColor: 'var(--color-text-muted, #9aa0a6)' },
  colors: props.series.map((s) => s.color),
  xaxis: { categories: props.categories, labels: { style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}`, style: { colors: 'var(--color-text-muted, #9aa0a6)' } } },
  tooltip: { y: { formatter: (v: number) => `$${v.toLocaleString()}` }, theme: 'dark' as const },
  legend: { position: 'bottom' as const, labels: { colors: 'var(--color-text-muted, #9aa0a6)' } },
  grid: { borderColor: 'var(--color-chart-grid, #2d3140)', strokeDashArray: 3 },
  plotOptions: { bar: { horizontal: false, borderRadius: 4 } },
}))

const chartKey = computed(() => props.categories.length)
</script>

<template>
  <div v-if="categories.length > 0 && series.some((s) => s.data.length > 0)" class="w-full">
    <apexchart :key="chartKey" type="bar" :height="height" :options="options" :series="series" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
```

- [ ] **Step 5: Verify chart components lint**

Run: `npm run --workspace=frontend lint`
Expected: no errors

---

### Task 7: Dashboard Components — Restyle to Terminal Aesthetic

**Files:**

- Modify: `frontend/app/components/dashboard/DashboardOverview.vue` → horizontal metric strip
- Modify: `frontend/app/components/dashboard/DashboardFilters.vue` → compact row
- Modify: `frontend/app/components/dashboard/DashboardAccountsTable.vue` → full-width stripped table
- Modify: `frontend/app/components/dashboard/DashboardPortfolioChart.vue` → no UCard wrapper
- Modify: `frontend/app/components/dashboard/DashboardAllocationChart.vue` → no UCard wrapper
- Modify: `frontend/app/components/dashboard/DashboardBalancesChart.vue` → no UCard wrapper
- Modify: `frontend/app/components/dashboard/DashboardIncomeChart.vue` → no UCard wrapper

- [ ] **Step 1: Rewrite DashboardOverview.vue — horizontal metric strip**

Replace the UCard grid with a horizontal strip of compact metric blocks separated by thin vertical rules.

```vue
<script setup lang="ts">
import type { PortfolioSummary } from '~/types/vault'

defineProps<{
  summary: PortfolioSummary
}>()
</script>

<template>
  <div class="flex overflow-x-auto rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="flex shrink-0 items-stretch divide-x divide-(--ui-border) text-xs">
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Total Value</span>
        <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{
          formatCurrency(summary.totalMarketValue + summary.totalCashBalance)
        }}</span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Day G/L</span>
        <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(summary.totalDayGainLoss)">
          {{ formatCurrency(summary.totalDayGainLoss) }}
          <span class="text-2xs">({{ formatPercent(summary.totalDayGainLossPct) }})</span>
        </span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Unrealized G/L</span>
        <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(summary.totalUnrealizedGainLoss)">
          {{ formatCurrency(summary.totalUnrealizedGainLoss) }}
          <span class="text-2xs">({{ formatPercent(summary.totalUnrealizedGainLossPct) }})</span>
        </span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Cost Basis</span>
        <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(summary.totalCostBasis) }}</span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Realized YTD</span>
        <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(summary.ytdRealizedGainLossTotal)">
          {{ formatCurrency(summary.ytdRealizedGainLossTotal) }}
        </span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Income YTD</span>
        <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(summary.ytdIncomeTotal) }}</span>
      </div>
      <div class="flex min-w-28 flex-col justify-center px-4 py-3">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Cash</span>
        <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(summary.totalCashBalance) }}</span>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Rewrite DashboardFilters.vue — compact row**

```vue
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
        size="2xs"
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
        size="2xs"
        :color="selectedTimeRange === option ? 'primary' : 'neutral'"
        :variant="selectedTimeRange === option ? 'solid' : 'ghost'"
        @click="emit('selectRange', option)"
      />
    </div>

    <div class="ml-auto flex items-center gap-2">
      <UButton icon="i-lucide-refresh-cw" size="2xs" color="neutral" variant="ghost" :loading="isSyncing" :disabled="isSyncing" @click="emit('refresh')" />
      <span v-if="lastError" class="text-2xs text-[var(--color-signal-red)]">{{ lastError }}</span>
      <span v-if="syncStatus === 'SUCCESS' && !isSyncing" class="text-2xs text-[var(--color-accent)]">Updated</span>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Rewrite DashboardAccountsTable.vue — no-card full-width table**

```vue
<script setup lang="ts">
interface AccountRow {
  id: string
  name: string
  costBasis: number
  cashBalance: number
  marketValue: number
  gain: number
  gainPct: number
}

defineProps<{
  accounts: AccountRow[]
}>()
</script>

<template>
  <div class="overflow-hidden rounded-sm border border-(--ui-border)">
    <div class="overflow-x-auto">
      <table class="min-w-full text-xs">
        <thead>
          <tr class="border-b border-(--ui-border) bg-(--ui-bg-elevated)">
            <th class="text-2xs px-3 py-2 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Name</th>
            <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Cost</th>
            <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Cash</th>
            <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Market Value</th>
            <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Gain</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(account, i) in accounts"
            :key="account.id"
            class="border-b border-(--ui-border)/60 transition-colors hover:bg-(--ui-bg-elevated)/50"
            :class="i % 2 === 1 ? 'bg-(--ui-bg-elevated)/30' : ''"
          >
            <td class="px-3 py-2.5 font-medium text-(--ui-text)">{{ account.name }}</td>
            <td class="px-3 py-2.5 text-right font-[var(--font-mono)] text-(--ui-text)">{{ formatCurrency(account.costBasis) }}</td>
            <td class="px-3 py-2.5 text-right font-[var(--font-mono)] text-(--ui-text)">{{ formatCurrency(account.cashBalance) }}</td>
            <td class="px-3 py-2.5 text-right font-[var(--font-mono)] text-(--ui-text)">{{ formatCurrency(account.marketValue) }}</td>
            <td class="px-3 py-2.5 text-right font-[var(--font-mono)]" :class="signClass(account.gain)">
              {{ formatCurrency(account.gain) }} ({{ formatPercent(account.gainPct) }})
            </td>
          </tr>
          <tr v-if="accounts.length === 0">
            <td colspan="5" class="px-3 py-6 text-center text-(--ui-text-muted)">No accounts found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Rewrite DashboardPortfolioChart.vue — no UCard**

```vue
<script setup lang="ts">
defineProps<{
  data: { date: string; value: number }[]
  timeRange: string
}>()
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="flex items-center justify-between border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Portfolio Value</span>
      <span class="text-2xs text-(--ui-text-muted)">{{ timeRange }}</span>
    </div>
    <ApexLineChart :data="data" />
  </div>
</template>
```

- [ ] **Step 5: Rewrite DashboardAllocationChart.vue — no UCard**

```vue
<script setup lang="ts">
defineProps<{
  data: { label: string; value: number }[]
}>()
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Asset Allocation</span>
    </div>
    <ApexDonutChart :data="data" />
  </div>
</template>
```

- [ ] **Step 6: Rewrite DashboardBalancesChart.vue — no UCard**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Account } from '~/types/vault'

const TERMINAL_COLORS = ['#00c853', '#40c4ff', '#ffd740', '#ff5252', '#b388ff', '#64ffda', '#ffab40', '#ff6e40']

const props = defineProps<{
  accounts: Account[]
}>()

const chartSeries = computed<{ name: string; data: { x: number; y: number }[]; color: string }[]>(() => {
  return props.accounts.map((account, i) => {
    const history = account.balanceHistory ?? []
    return {
      name: account.displayName,
      data: history.map((bp) => ({ x: new Date(bp.date).getTime(), y: bp.balance })),
      color: TERMINAL_COLORS[i % TERMINAL_COLORS.length] ?? '#6B7280',
    }
  })
})
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Account Balances</span>
    </div>
    <ApexAreaChart :series="chartSeries" />
  </div>
</template>
```

- [ ] **Step 7: Rewrite DashboardIncomeChart.vue — no UCard**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: { accountName: string; currentYear: number; priorYear: number }[]
  currentYear: number
  priorYear: number
}>()

const chartSeries = computed(() => [
  { name: String(props.priorYear), data: props.data.map((d) => d.priorYear), color: 'var(--color-text-disabled, #5f6368)' },
  { name: String(props.currentYear), data: props.data.map((d) => d.currentYear), color: 'var(--color-signal-blue, #40c4ff)' },
])

const categories = computed(() => props.data.map((d) => d.accountName))
</script>

<template>
  <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
    <div class="flex items-center justify-between border-b border-(--ui-border) px-3 py-2">
      <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Income by Account</span>
      <span class="text-2xs text-(--ui-text-muted)">{{ priorYear }} vs {{ currentYear }}</span>
    </div>
    <ApexStackedBar :categories="categories" :series="chartSeries" />
  </div>
</template>
```

- [ ] **Step 8: Verify all dashboard components**

Run: `npm run --workspace=frontend lint`
Expected: no errors

---

### Task 8: Dashboard Page — Restructured Layout

**Files:**

- Modify: `frontend/app/pages/dashboard.vue`

- [ ] **Step 1: Rewrite `<template>` in dashboard.vue**

Keep all `<script setup>` unchanged. Replace the template to match the new compact layout:

```vue
<template>
  <div class="mx-auto w-full max-w-7xl space-y-4 px-4 py-4">
    <template v-if="!isUnlocked">
      <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-4 py-4">
        <p class="text-sm text-(--ui-text-muted)">Unlock your vault to view account and position data.</p>
        <UButton label="Go to vault" color="primary" size="xs" to="/" class="mt-2" />
      </div>
    </template>

    <template v-else>
      <!-- Compact breadcrumb-style header -->
      <div class="flex items-center justify-between">
        <h1 class="text-sm font-[var(--font-mono)] text-(--ui-text-muted)">
          <NuxtLink to="/" class="hover:text-(--ui-text)">~</NuxtLink>
          <span class="mx-1">/</span>
          <span class="text-(--ui-text)">dashboard</span>
        </h1>
        <UButton
          v-if="hasGoogleClientId && isUnlocked"
          :label="syncLabel"
          size="2xs"
          color="primary"
          variant="outline"
          :loading="state === 'authenticating' || state === 'loading'"
          :disabled="state === 'authenticating' || state === 'loading'"
          @click="syncToSheets"
        />
      </div>

      <!-- Overview bar -->
      <DashboardOverview :summary="allAccountsSummary" />

      <!-- Filters bar -->
      <DashboardFilters
        :account-options="accountOptions"
        :selected-account-id="accountFilter"
        :selected-time-range="selectedTimeRange"
        :time-range-options="timeRangeOptions"
        :is-syncing="marketStore.isSyncing"
        :sync-status="marketStore.syncStatus"
        :last-error="marketStore.lastError"
        @select-account="selectAccount"
        @select-range="selectRange"
        @refresh="marketStore.refreshMarketData()"
      />

      <!-- Accounts table -->
      <DashboardAccountsTable :accounts="accountsSummary" />

      <!-- Charts side by side -->
      <div class="grid gap-4 xl:grid-cols-2">
        <DashboardPortfolioChart :data="portfolioValueChartData" :time-range="selectedTimeRange" />
        <DashboardAllocationChart :data="allocationChartData" />
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <DashboardBalancesChart :accounts="filteredAccounts" />
        <DashboardIncomeChart :data="incomeByAccount" :current-year="dataStore.selectedYear" :prior-year="dataStore.selectedYear - 1" />
      </div>
    </template>
  </div>
</template>
```

Note: The sync status messages (`sheetsError`, `sheetsSuccess`) that were in the header area can be shown as small inline indicators near the sync button.

- [ ] **Step 2: Verify dashboard page**

Run: `npm run --workspace=frontend typecheck`
Expected: no errors

---

### Task 9: Data Pages — Positions, Transactions, Income

**Files:**

- Modify: `frontend/app/pages/positions.vue`
- Modify: `frontend/app/pages/transactions.vue`
- Modify: `frontend/app/pages/income.vue`

- [ ] **Step 1: Update positions.vue template**

Replace the `<template>` block (keep script setup intact). Changes:

- Remove `py-8` → `py-4` spacing
- Compact breadcrumb header instead of title block
- Summary uses compact panel instead of UCard grid (inline flex, no card wrappers)
- Filter area: remove UCard wrapper → inline panel
- Tables: remove UCard wrapper → bordered panel
- Tab buttons: compact pill style
- Replace native `<select id="tax-year">` with `USelect`

Key template changes for positions.vue:

```vue
<template>
  <div class="mx-auto w-full max-w-7xl space-y-4 px-4 py-4">
    <!-- Breadcrumb header -->
    <div class="flex items-center justify-between">
      <h1 class="text-sm font-[var(--font-mono)] text-(--ui-text-muted)">
        <NuxtLink to="/" class="hover:text-(--ui-text)">~</NuxtLink>
        <span class="mx-1">/</span>
        <span class="text-(--ui-text)">positions</span>
      </h1>
      <UButton label="Dashboard" to="/dashboard" color="neutral" variant="ghost" size="2xs" />
    </div>

    <!-- Summary strip -->
    <div class="flex overflow-x-auto rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated)">
      <div class="flex divide-x divide-(--ui-border) text-xs">
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Total Value</span>
          <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{
            formatCurrency(totals.totalMarketValue + totals.totalCashBalance)
          }}</span>
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Market Value</span>
          <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(totals.totalMarketValue) }}</span>
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Cash</span>
          <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(totals.totalCashBalance) }}</span>
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Cost Basis</span>
          <span class="text-sm font-[var(--font-mono)] font-bold text-(--ui-text)">{{ formatCurrency(totals.totalCostBasis) }}</span>
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Day Change</span>
          <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(totals.totalDayGainLoss)"
            >{{ formatCurrency(totals.totalDayGainLoss) }}&nbsp;<span class="text-2xs">({{ formatPercent(totals.totalDayGainLossPct) }})</span></span
          >
        </div>
        <div class="flex min-w-24 flex-col justify-center px-4 py-3">
          <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Total G/L</span>
          <span class="text-sm font-[var(--font-mono)] font-bold" :class="signClass(totals.totalUnrealizedGainLoss)"
            >{{ formatCurrency(totals.totalUnrealizedGainLoss) }}&nbsp;<span class="text-2xs"
              >({{ formatPercent(totals.totalUnrealizedGainLossPct) }})</span
            ></span
          >
        </div>
      </div>
    </div>

    <!-- Account filter + refresh inline -->
    <div class="flex flex-wrap items-center gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
      <div class="flex items-center gap-1.5">
        <span class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Account</span>
        <UButton
          v-for="option in accountOptions"
          :key="option.label"
          :label="option.label"
          size="2xs"
          :color="dataStore.selectedAccountId === option.id ? 'primary' : 'neutral'"
          :variant="dataStore.selectedAccountId === option.id ? 'solid' : 'ghost'"
          @click="dataStore.selectAccount(option.id)"
        />
      </div>
      <div class="ml-auto flex items-center gap-2">
        <UButton
          label="Refresh"
          icon="i-lucide-refresh-cw"
          size="2xs"
          color="neutral"
          variant="ghost"
          :loading="marketStore.isSyncing"
          :disabled="marketStore.isSyncing"
          @click="marketStore.refreshMarketData()"
        />
        <span v-if="marketStore.lastError" class="text-2xs text-[var(--color-signal-red)]">{{ marketStore.lastError }}</span>
        <span v-if="marketStore.syncStatus === 'SUCCESS' && !marketStore.isSyncing" class="text-2xs text-[var(--color-accent)]">Updated</span>
      </div>
    </div>

    <!-- Tab buttons -->
    <div class="flex gap-2">
      <UButton
        label="Open positions"
        size="2xs"
        :color="activeTab === 'OPEN' ? 'primary' : 'neutral'"
        :variant="activeTab === 'OPEN' ? 'solid' : 'ghost'"
        @click="activeTab = 'OPEN'"
      />
      <UButton
        label="Closed positions"
        size="2xs"
        :color="activeTab === 'CLOSED' ? 'primary' : 'neutral'"
        :variant="activeTab === 'CLOSED' ? 'solid' : 'ghost'"
        @click="activeTab = 'CLOSED'"
      />
    </div>

    <!-- Open positions table (no UCard) -->
    <div v-if="activeTab === 'OPEN'" class="overflow-hidden rounded-sm border border-(--ui-border)">
      <div class="flex items-center justify-between border-b border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-1.5">
        <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Open positions</span>
        <span class="text-2xs text-(--ui-text-muted)">{{ positions.length }} total</span>
      </div>
      <!-- Rest of the table is the same structure but no UCard wrapper -->
    </div>

    <!-- Closed positions table (no UCard) -->
    <div v-else class="overflow-hidden rounded-sm border border-(--ui-border)">
      <div class="flex items-center justify-between border-b border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-1.5">
        <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Closed positions</span>
        <div class="flex items-center gap-2">
          <span class="text-2xs text-(--ui-text-muted)">Tax year</span>
          <USelect
            :value="dataStore.selectedTaxYear"
            :items="availableTaxYears.map((y) => ({ label: String(y), value: y }))"
            size="2xs"
            color="neutral"
            variant="outline"
            @update:model-value="dataStore.setSelectedTaxYear(Number($event))"
          />
        </div>
      </div>
      <!-- Rest of the table same structure -->
    </div>
  </div>
</template>
```

- [ ] **Step 2: Update transactions.vue template**

Replace the `<template>` block (keep script setup). Changes:

- Breadcrumb header: same pattern as positions (`~/transactions`)
- Filter panel: remove `UCard` wrapper, use inline `rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2` with grid
- Replace all `<select>` in filters with `USelect` with `size="2xs" variant="outline" color="neutral" :items="..."`
- Replace all `<input>` in filters with `UInput size="2xs" variant="outline"`
- Tab filters: compact pill buttons (`size="2xs"`, `ghost`/`solid`)
- Table panel: remove `UCard`, use `rounded-sm border border-(--ui-border) overflow-hidden` with header row `bg-(--ui-bg-elevated)`
- Modal form: keep modals but replace `<select>`/`<input>` with `USelect`/`UInput` using the same prop conversions
- Counts line: keep as `flex gap-2 text-2xs text-(--ui-text-muted)` below filters
- `rounded-md` → `rounded-sm` everywhere
- `text-(--ui-error)` → `text-[var(--color-signal-red)]` in error messages

- [ ] **Step 3: Update income.vue template**

Replace the `<template>` block (keep script setup). Changes:

- Breadcrumb header: `~/income`
- Filter panel: remove `UCard`, use inline `rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3 grid gap-3 sm:grid-cols-2`
- Replace `<select v-model.number="selectedYear">` with `USelect :items="availableYears.map(y => ({ label: String(y), value: y }))" size="xs" variant="outline"`
- Replace `<select v-model="selectedAccountId">` with `USelect` using account options
- Summary cards: remove `UCard` wrappers, use `rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3` with inline text
- Table panels: remove `UCard`, use bordered panel with header row
- Monthly grid: remove `UCard`, use `rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3` per month cell
- `rounded-md` → `rounded-sm` everywhere

- [ ] **Step 4: Verify data pages**

Run: `npm run --workspace=frontend typecheck`
Expected: no errors

---

### Task 10: Settings Page — Two-Column Layout

**Files:**

- Modify: `frontend/app/pages/settings.vue`

- [ ] **Step 1: Rewrite settings.vue template**

Replace native `<select>`/`<input>` with `USelect`/`UInput`. Convert to two-column (label | control) layout. Replace UCard wrappers with section headers.

Key template changes:

```vue
<template>
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-4">
    <!-- Breadcrumb header -->
    <div class="flex items-center justify-between">
      <h1 class="text-sm font-[var(--font-mono)] text-(--ui-text-muted)">
        <NuxtLink to="/" class="hover:text-(--ui-text)">~</NuxtLink>
        <span class="mx-1">/</span>
        <span class="text-(--ui-text)">settings</span>
      </h1>
      <UButton label="Dashboard" to="/dashboard" color="neutral" variant="ghost" size="2xs" />
    </div>

    <!-- Schwab connection section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Schwab connection</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Status</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ tokenLabel }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Connected accounts</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ oauthStore.connectedAccountCount }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Access token</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ formatRemaining(oauthStore.accessTokenSecondsRemaining) }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Refresh token</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ formatRemaining(oauthStore.refreshTokenSecondsRemaining) }}</p>
        </div>
      </div>
      <div
        v-if="oauthStore.expirationWarning"
        class="mt-3 rounded-sm border border-[var(--color-signal-amber)]/30 bg-[var(--color-signal-amber)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-signal-amber)]"
      >
        Re-authorization is recommended within 24 hours to avoid sync interruptions.
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton label="Refresh status" size="xs" color="neutral" variant="outline" @click="oauthStore.pollTokenStatus" />
        <UButton
          :label="oauthStore.requiresReauth ? 'Connect Schwab' : 'Re-authorize Schwab'"
          size="xs"
          color="primary"
          @click="oauthStore.initiateOAuthFlow"
        />
      </div>
    </section>

    <!-- Transaction import section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Transaction import</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Status</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ importStatusLabel }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Last import</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">
            {{ vaultStore.payload?.lastSyncSummary?.completedAt ? new Date(vaultStore.payload.lastSyncSummary.completedAt).toLocaleString() : 'Never' }}
          </p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Imported rows</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ vaultStore.payload?.lastSyncSummary?.transactionsAdded ?? 0 }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Deduplicated</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ vaultStore.payload?.lastSyncSummary?.deduplicatedCount ?? 0 }}</p>
        </div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <USelect
          v-model="importAccountId"
          :items="dataStore.allAccounts.map((a) => ({ label: a.displayName, value: a.id }))"
          placeholder="Select account"
          size="xs"
          variant="outline"
          color="neutral"
        />
        <UInput type="file" accept=".csv,text/csv" size="xs" variant="outline" @change="onImportFileChange" />
      </div>
      <div
        v-if="importErrors.length > 0"
        class="mt-3 rounded-sm border border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-signal-red)]"
      >
        {{ importErrors.join(' ') }}
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton label="Import CSV" size="xs" color="primary" :loading="syncStore.isSyncing" @click="importTransactions" />
      </div>
    </section>

    <!-- Market data section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Market data</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Status</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ marketStore.syncStatus }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">Symbols cached</p>
          <p class="text-sm font-[var(--font-mono)] font-semibold text-(--ui-text)">{{ Object.keys(vaultStore.payload?.priceHistory ?? {}).length }}</p>
        </div>
        <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
          <p class="text-2xs tracking-wide text-(--ui-text-muted) uppercase">
            {{ marketStore.progress ? `Fetching ${marketStore.progress.current} / ${marketStore.progress.total}` : 'Progress' }}
          </p>
        </div>
      </div>
      <div
        v-if="marketStore.lastError"
        class="mt-3 rounded-sm border border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-signal-red)]"
      >
        {{ marketStore.lastError }}
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          label="Refresh Prices"
          size="xs"
          color="primary"
          :loading="marketStore.isSyncing"
          :disabled="marketStore.isSyncing"
          @click="marketStore.refreshMarketData()"
        />
      </div>
    </section>

    <!-- Account management section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Account management</h2>
      <div class="space-y-2">
        <div v-for="account in orderedAccounts" :key="account.id" class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-sm font-medium text-(--ui-text)">{{ account.displayName }}</p>
              <p class="text-2xs text-(--ui-text-muted)">
                {{ account.bank }} &middot; {{ account.type }} &middot; {{ maskAccountNumber(account.accountNumber) }}
              </p>
            </div>
            <div class="flex gap-1">
              <UButton label="Edit" size="2xs" color="neutral" variant="ghost" @click="startEdit(account)" />
              <UButton
                icon="i-lucide-chevron-up"
                size="2xs"
                color="neutral"
                variant="ghost"
                :disabled="orderedAccounts.indexOf(account) === 0"
                @click="moveAccount(account.id, -1)"
              />
              <UButton
                icon="i-lucide-chevron-down"
                size="2xs"
                color="neutral"
                variant="ghost"
                :disabled="orderedAccounts.indexOf(account) === orderedAccounts.length - 1"
                @click="moveAccount(account.id, 1)"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- Two-column add/edit form -->
      <div class="mt-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
        <p class="mb-3 text-xs font-medium text-(--ui-text)">{{ editAccountId ? 'Edit account' : 'Add account' }}</p>
        <div class="grid gap-3 md:grid-cols-2">
          <UInput v-model="editForm.displayName" placeholder="Display name" size="xs" variant="outline" color="neutral" />
          <UInput v-model="editForm.accountNumber" placeholder="Account number" size="xs" variant="outline" color="neutral" />
          <USelect v-model="editForm.bank" :items="bankOptions.map((b) => ({ label: b, value: b }))" size="xs" variant="outline" color="neutral" />
          <USelect
            v-model="editForm.type"
            :items="Object.values(AccountType).map((t) => ({ label: t, value: t }))"
            size="xs"
            variant="outline"
            color="neutral"
          />
          <USelect
            v-model="editForm.costBasisMethod"
            :items="costBasisOptions.map((c) => ({ label: c, value: c }))"
            size="xs"
            variant="outline"
            color="neutral"
          />
          <UInput
            v-if="!editAccountId"
            v-model.number="editForm.initialBalance"
            placeholder="Initial balance"
            type="number"
            step="0.01"
            size="xs"
            variant="outline"
            color="neutral"
          />
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <UButton :label="editAccountId ? 'Save changes' : 'Add account'" size="xs" color="primary" @click="editAccountId ? saveEdit() : addAccount()" />
          <UButton v-if="editAccountId" label="Cancel" size="xs" color="neutral" variant="outline" @click="resetForm" />
        </div>
      </div>
    </section>

    <!-- Google Sheets sync section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Google Sheets sync</h2>
      <p class="mb-3 text-xs text-(--ui-text-muted)">Paste your Google OAuth Client ID to enable syncing portfolio balances to the Google Sheet.</p>
      <div class="flex items-center gap-3">
        <UInput v-model="googleSheetsClientId" placeholder="Paste your Google OAuth Client ID" size="xs" variant="outline" color="neutral" class="flex-1" />
        <UButton label="Save" size="xs" color="primary" :disabled="!googleSheetsClientId" @click="saveGoogleSheetsClientId" />
      </div>
      <p v-if="googleSheetsClientIdSaved" class="text-2xs mt-2 text-[var(--color-accent)]">Saved to vault</p>
    </section>

    <!-- Vault management section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Vault management</h2>
      <div class="mb-4 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
        <p class="mb-3 text-xs font-medium text-(--ui-text)">Change passphrase</p>
        <div class="grid gap-3 md:grid-cols-3">
          <UInput v-model="passphraseForm.current" placeholder="Current passphrase" type="password" size="xs" variant="outline" color="neutral" />
          <UInput v-model="passphraseForm.next" placeholder="New passphrase" type="password" size="xs" variant="outline" color="neutral" />
          <UInput v-model="passphraseForm.confirm" placeholder="Confirm new passphrase" type="password" size="xs" variant="outline" color="neutral" />
        </div>
        <div
          v-if="passphraseError"
          class="mt-3 rounded-sm border border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-signal-red)]"
        >
          {{ passphraseError }}
        </div>
        <div
          v-if="passphraseSuccess"
          class="mt-3 rounded-sm border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-accent)]"
        >
          {{ passphraseSuccess }}
        </div>
        <div class="mt-3">
          <UButton
            :label="passphraseSaving ? 'Updating...' : 'Change passphrase'"
            size="xs"
            color="primary"
            :disabled="passphraseSaving"
            @click="changePassphrase"
          />
        </div>
      </div>
      <div v-if="vaultStore.isRemembered" class="mb-4 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
        <p class="text-xs font-medium text-(--ui-text)">Remembered vault</p>
        <p class="text-2xs text-(--ui-text-muted)">
          Last used: <strong class="text-(--ui-text)">{{ vaultStore.rememberedFileName }}</strong>
        </p>
        <UButton label="Forget this vault" size="2xs" color="neutral" variant="outline" class="mt-2" @click="vaultStore.forgetHandle()" />
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton label="Export vault JSON" size="xs" color="neutral" variant="outline" @click="exportVaultJson" />
        <UButton label="Delete vault data" size="xs" color="error" variant="outline" @click="clearVaultData" />
      </div>
    </section>

    <!-- Display preferences section -->
    <section>
      <h2 class="text-2xs mb-3 font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Display preferences</h2>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div class="flex items-center justify-between gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
          <span class="text-xs text-(--ui-text-muted)">Theme</span>
          <USelect
            :value="displayPreferences.theme"
            :items="themeOptions.map((t) => ({ label: t, value: t }))"
            size="2xs"
            variant="outline"
            color="neutral"
            @update:model-value="updateDisplayPreference('theme', $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
          <span class="text-xs text-(--ui-text-muted)">Currency format</span>
          <USelect
            :value="displayPreferences.currencyFormat"
            :items="currencyOptions.map((c) => ({ label: c, value: c }))"
            size="2xs"
            variant="outline"
            color="neutral"
            @update:model-value="updateDisplayPreference('currencyFormat', $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
          <span class="text-xs text-(--ui-text-muted)">Date format</span>
          <USelect
            :value="displayPreferences.dateFormat"
            :items="dateFormatOptions.map((d) => ({ label: d, value: d }))"
            size="2xs"
            variant="outline"
            color="neutral"
            @update:model-value="updateDisplayPreference('dateFormat', $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
          <span class="text-xs text-(--ui-text-muted)">Default account filter</span>
          <USelect
            :value="displayPreferences.defaultAccountFilter ?? 'ALL'"
            :items="accountOptions.map((a) => ({ label: a.label, value: a.id }))"
            size="2xs"
            variant="outline"
            color="neutral"
            @update:model-value="updateDisplayPreference('defaultAccountFilter', $event === 'ALL' ? null : $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
          <span class="text-xs text-(--ui-text-muted)">Default cost basis</span>
          <USelect
            :value="displayPreferences.defaultCostBasisMethod"
            :items="costBasisOptions.map((c) => ({ label: c, value: c }))"
            size="2xs"
            variant="outline"
            color="neutral"
            @update:model-value="updateDisplayPreference('defaultCostBasisMethod', $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-3 rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
          <span class="text-xs text-(--ui-text-muted)">Default time range</span>
          <USelect
            :value="displayPreferences.defaultTimeRange"
            :items="timeRangeOptions.map((t) => ({ label: t, value: t }))"
            size="2xs"
            variant="outline"
            color="neutral"
            @update:model-value="updateDisplayPreference('defaultTimeRange', $event)"
          />
        </div>
      </div>
    </section>
  </div>
</template>
```

The key visual changes:

- Replace all `<select>` with `<USelect :items="..." size="xs" variant="outline" color="neutral" />`
- Replace all `<input>` with `<UInput size="xs" variant="outline" color="neutral" />`
- `rounded-md` → `rounded-sm`
- Error messages: `font-[var(--font-mono)]` with red styling
- Section headers: `text-2xs font-[var(--font-mono)] uppercase tracking-wide`
- Two-column forms: label column + control column using grid

- [ ] **Step 2: Verify settings page**

Run: `npm run --workspace=frontend typecheck`
Expected: no errors

---

### Task 11: Nuxt Page Transition Config

**Files:**

- Modify: `frontend/app/nuxt.config.ts` (or `frontend/nuxt.config.ts`)

- [ ] **Step 1: Add page transition to nuxt.config.ts**

```ts
export default defineNuxtConfig({
  // ... existing config
  app: {
    pageTransition: {
      name: 'page',
      mode: 'out-in',
    },
  },
})
```

The transition CSS is already in main.css from Task 1 (`.page-enter-active`, `.page-leave-active`, etc.).

- [ ] **Step 2: Verify config**

Run: `npm run --workspace=frontend typecheck`
Expected: no errors

---

### Task 12: Full Verification

- [ ] **Step 1: Run lint** — `npm run --workspace=frontend lint`

- [ ] **Step 2: Run typecheck** — `npm run --workspace=frontend typecheck`

- [ ] **Step 3: Run format** — `npm run --workspace=frontend format`

- [ ] **Step 4: Run tests** — `npm run --workspace=frontend test`

All must pass with zero warnings/errors.
