<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from '#imports'
import { useOAuthStore } from '~/stores/oauth.store'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()
const oauth = useOAuthStore()
const route = useRoute()
const router = useRouter()

const showCreateDialog = ref(false)
const showOpenDialog = ref(false)
const passphrase = ref('')
const passphraseConfirm = ref('')
const passphraseError = ref('')

const refreshExpiryLabel = computed(() => {
  if (!vault.payload?.lastSyncSummary?.completedAt) return 'No imports yet'
  return new Date(vault.payload!.lastSyncSummary!.completedAt).toLocaleString()
})

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
    await vault.setFileHandle(handle)
    await vault.createVault(passphrase.value)
    showCreateDialog.value = false
    resetForm()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    // lastError is set by the store
  }
}

async function handleQuickOpen() {
  passphraseError.value = ''
  if (!passphrase.value) {
    passphraseError.value = 'Enter your vault passphrase'
    return
  }
  try {
    const handle = await vault.tryQuickOpen()
    if (!handle) {
      passphraseError.value = 'Could not access the remembered vault file — please select it manually'
      vault.forgetHandle()
      return
    }
    await vault.openVault(handle, passphrase.value)
    resetForm()
  } catch {
    if (vault.lastError) passphraseError.value = vault.lastError
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
            :class="[
              'mb-4 rounded-sm border px-3 py-2 text-xs',
              'border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/10',
              'font-[var(--font-mono)] text-[var(--color-signal-red)]',
            ]"
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
