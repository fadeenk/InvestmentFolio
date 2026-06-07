<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from '#imports'
import { useOAuthStore } from '~/stores/oauth.store'
import { useSyncStore } from '~/stores/sync.store'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()
const oauth = useOAuthStore()
const sync = useSyncStore()
const route = useRoute()
const router = useRouter()

const showCreateDialog = ref(false)
const showOpenDialog = ref(false)
const passphrase = ref('')
const passphraseConfirm = ref('')
const passphraseError = ref('')

const authStatusLabel = computed(() => {
  if (sync.isSyncing) return 'Importing'
  if (vault.payload?.lastSyncSummary) return 'Ready'
  return 'Idle'
})

const authStatusTone = computed<'success' | 'warning' | 'error'>(() => {
  if (sync.lastError) return 'error'
  if (sync.isSyncing) return 'warning'
  return 'success'
})

const authStatusClasses = computed(() => {
  if (authStatusTone.value === 'success') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
  if (authStatusTone.value === 'warning') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
})

const refreshExpiryLabel = computed(() => {
  if (!vault.payload?.lastSyncSummary?.completedAt) return 'No imports yet'
  return new Date(vault.payload!.lastSyncSummary!.completedAt).toLocaleString()
})

const actionLabel = computed(() => 'Open import settings')

function resetForm() {
  passphrase.value = ''
  passphraseConfirm.value = ''
  passphraseError.value = ''
}

async function handleCreate() {
  passphraseError.value = ''
  if (passphrase.value.length < 8) {
    passphraseError.value = 'Passphrase must be at least 8 characters'
    return
  }
  if (passphrase.value !== passphraseConfirm.value) {
    passphraseError.value = 'Passphrases do not match'
    return
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'folio.iFolio',
      types: [
        {
          description: 'iFolio Vault',
          accept: { 'application/octet-stream': ['.iFolio'] },
        },
      ],
    })
    vault.setFileHandle(handle)
    await vault.createVault(passphrase.value)
    showCreateDialog.value = false
    resetForm()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    // lastError is set by the store
  }
}

async function handleOpen() {
  passphraseError.value = ''
  if (!passphrase.value) {
    passphraseError.value = 'Enter your vault passphrase'
    return
  }
  try {
    const supportsPicker = 'showOpenFilePicker' in window
    if (supportsPicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'iFolio Vault',
            accept: { 'application/octet-stream': ['.iFolio'] },
          },
        ],
      })
      if (!handle) return
      await vault.openVault(handle, passphrase.value)
    } else {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.iFolio'
      input.click()

      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null)
      })
      if (!file) return

      await vault.openVault(file, passphrase.value)
    }
    showOpenDialog.value = false
    resetForm()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    if (vault.lastError) passphraseError.value = vault.lastError
  }
}

async function handleLock() {
  if (vault.hasUnsavedChanges) {
    const discard = window.confirm('You have unsaved changes. Discard them?')
    if (!discard) return
  }
  vault.lockVault()
}

async function handleSave() {
  await vault.saveVault()
}

async function refreshAuthStatus() {
  await router.push('/settings')
}

function openAuthSettings() {
  router.push('/settings')
}

function openImportSettings() {
  router.push('/settings')
}

async function handleSyncIntent() {
  await router.push('/settings')
}

function queryToSearchParams(): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0])
      continue
    }
    if (value) params.set(key, value)
  }
  return params
}

async function applyAuthCallbackStateFromQuery() {
  const auth = route.query.auth
  if (!auth) return

  const authConnected = auth === 'connected'

  oauth.consumeAuthCallbackFromQuery(queryToSearchParams())
  oauth.clearCallbackMessage()

  const nextQuery: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (key === 'auth' || key === 'reason') continue
    if (Array.isArray(value)) {
      const filteredValues = value.filter((item): item is string => item !== null)
      if (filteredValues.length > 0) {
        nextQuery[key] = filteredValues
      }
      continue
    }
    if (value !== null) {
      nextQuery[key] = value
    }
  }

  await router.replace({ query: nextQuery })

  if (authConnected && vault.status === VaultStatus.UNLOCKED) {
    await oauth.ensureSyncedAfterUnlockOrAuth()
  }
}

function closeCreateDialog() {
  showCreateDialog.value = false
  resetForm()
}

function closeOpenDialog() {
  showOpenDialog.value = false
  resetForm()
}

watch(
  () => vault.status,
  async () => {
    if (vault.status === VaultStatus.LOCKED) {
      resetForm()
    }
  },
)

onMounted(async () => {
  await applyAuthCallbackStateFromQuery()

  if (vault.status === VaultStatus.UNLOCKED) {
    await oauth.ensureSyncedAfterUnlockOrAuth()
  }
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12">
    <!-- LOCKED STATE -->
    <template v-if="vault.status === VaultStatus.LOCKED">
      <div class="space-y-8 text-center">
        <div class="space-y-2">
          <div class="mb-6 flex justify-center">
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-(--ui-primary)">
              <span class="text-2xl font-bold text-white">F</span>
            </div>
          </div>
          <h1 class="text-3xl font-bold">iFolio</h1>
          <p class="text-(--ui-text-muted)">Your private portfolio tracker. All data encrypted at rest.</p>
        </div>

        <div v-if="vault.lastError" class="rounded-lg bg-(--ui-error) p-3 text-sm text-white">
          {{ vault.lastError }}
        </div>

        <div class="mx-auto flex max-w-xs flex-col gap-3">
          <UButton label="Open existing vault" color="primary" size="xl" @click="showOpenDialog = true" />
          <UButton label="Create new vault" color="neutral" variant="outline" size="xl" @click="showCreateDialog = true" />
        </div>

        <p class="mt-8 text-xs text-(--ui-text-muted)">Supports Chrome, Edge, Firefox, and Safari</p>
      </div>
    </template>

    <!-- UNLOCKING STATE -->
    <template v-else-if="vault.status === VaultStatus.UNLOCKING">
      <div class="space-y-6 py-16 text-center">
        <UIcon name="i-lucide-loader-circle" class="mx-auto h-10 w-10 animate-spin" />
        <p class="text-lg font-medium">Unlocking vault...</p>
        <p class="text-sm text-(--ui-text-muted)">Deriving encryption key</p>
      </div>
    </template>

    <!-- SAVING STATE + UNLOCKED STATE -->
    <template v-else-if="vault.status === VaultStatus.UNLOCKED || vault.status === VaultStatus.SAVING">
      <div class="space-y-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-3 w-3 rounded-full bg-green-500" />
            <h2 class="text-xl font-bold">Vault unlocked</h2>
          </div>
          <div class="flex items-center gap-2">
            <UButton label="Dashboard" size="sm" color="primary" variant="soft" to="/dashboard" />
            <span v-if="vault.status === VaultStatus.SAVING" class="flex items-center gap-1 text-sm text-(--ui-text-muted)">
              <UIcon name="i-lucide-loader-circle" class="h-3 w-3 animate-spin" />
              Saving...
            </span>
            <span v-else-if="vault.hasUnsavedChanges" class="text-sm text-amber-500"> Unsaved changes </span>
            <span v-else class="text-sm text-(--ui-text-muted)"> Saved </span>
            <UButton v-if="vault.hasUnsavedChanges" label="Save" size="sm" color="primary" @click="handleSave" />
            <UButton label="Lock" size="sm" color="neutral" variant="outline" @click="handleLock" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UCard>
            <template #header>
              <p class="text-sm text-(--ui-text-muted)">Accounts</p>
            </template>
            <p class="text-2xl font-bold">
              {{ vault.accounts.length }}
            </p>
          </UCard>
          <UCard>
            <template #header>
              <p class="text-sm text-(--ui-text-muted)">Last saved</p>
            </template>
            <p class="text-2xl font-bold">
              {{ vault.payload?.metadata.lastSavedAt ? new Date(vault.payload.metadata.lastSavedAt).toLocaleString() : '—' }}
            </p>
          </UCard>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm text-(--ui-text-muted)">Transaction imports</p>
                <p class="text-xs text-(--ui-text-muted)">Manage manual transaction imports in settings</p>
              </div>
              <span class="rounded-full px-2 py-1 text-xs font-medium" :class="authStatusClasses">
                {{ authStatusLabel }}
              </span>
            </div>
          </template>

          <div class="space-y-3">
            <p class="text-sm text-(--ui-text-muted)">
              Last import:
              <strong class="font-semibold text-(--ui-text-highlighted)">{{ refreshExpiryLabel }}</strong>
            </p>

            <div v-if="oauth.expirationWarning" class="rounded-md bg-amber-500/15 p-2 text-sm text-amber-700 dark:text-amber-200">
              Import currently in progress.
            </div>

            <div v-if="sync.lastError" class="rounded-md bg-red-500/15 p-2 text-sm text-red-700 dark:text-red-200">
              {{ sync.lastError }}
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton label="Import settings" color="primary" @click="openImportSettings" />
              <UButton label="Open settings" color="neutral" variant="outline" @click="refreshAuthStatus" />
              <UButton label="Settings" color="neutral" variant="ghost" @click="openAuthSettings" />
              <UButton :label="actionLabel" color="neutral" variant="soft" :loading="sync.isSyncing" @click="handleSyncIntent" />
            </div>
          </div>
        </UCard>
      </div>
    </template>

    <!-- CREATE DIALOG -->
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
          <p v-if="passphraseError" class="text-sm text-(--ui-error)">
            {{ passphraseError }}
          </p>
        </div>
      </template>

      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="closeCreateDialog" />
        <UButton label="Create vault" color="primary" @click="handleCreate" />
      </template>
    </UModal>

    <!-- OPEN DIALOG -->
    <UModal v-model:open="showOpenDialog" title="Open existing vault" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-(--ui-text-muted)">After clicking &quot;Open vault&quot;, select your <code>.foli</code> file.</p>
          <div>
            <label class="mb-1 block text-sm font-medium">Passphrase</label>
            <UInput v-model="passphrase" type="password" placeholder="Enter your vault passphrase" size="lg" @keydown.enter="handleOpen" />
          </div>
          <p v-if="passphraseError" class="text-sm text-(--ui-error)">
            {{ passphraseError }}
          </p>
        </div>
      </template>

      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="closeOpenDialog" />
        <UButton label="Open vault" color="primary" @click="handleOpen" />
      </template>
    </UModal>
  </div>
</template>
