<script setup lang="ts">
import { ref, watch } from 'vue'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()

const showCreateDialog = ref(false)
const showOpenDialog = ref(false)
const passphrase = ref('')
const passphraseConfirm = ref('')
const passphraseError = ref('')

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
    await vault.createVault(passphrase.value)
    showCreateDialog.value = false
    resetForm()
  } catch {
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
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.foli'
    input.click()

    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => resolve(input.files?.[0] ?? null)
    })
    if (!file) return

    await vault.openVault(file, passphrase.value)
    showOpenDialog.value = false
    resetForm()
  } catch {
    // lastError is set by the store
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
  () => {
    if (vault.status === VaultStatus.LOCKED) {
      resetForm()
    }
  },
)
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
          <h1 class="text-3xl font-bold">Folio</h1>
          <p class="text-(--ui-text-muted)">
            Your private portfolio tracker. All data encrypted at rest.
          </p>
        </div>

        <div v-if="vault.lastError" class="rounded-lg bg-(--ui-error) p-3 text-sm text-white">
          {{ vault.lastError }}
        </div>

        <div class="mx-auto flex max-w-xs flex-col gap-3">
          <UButton
            label="Open existing vault"
            color="primary"
            size="xl"
            @click="showOpenDialog = true"
          />
          <UButton
            label="Create new vault"
            color="neutral"
            variant="outline"
            size="xl"
            @click="showCreateDialog = true"
          />
        </div>

        <p class="mt-8 text-xs text-(--ui-text-muted)">
          Supports Chrome, Edge, Firefox, and Safari
        </p>
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
    <template
      v-else-if="vault.status === VaultStatus.UNLOCKED || vault.status === VaultStatus.SAVING"
    >
      <div class="space-y-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-3 w-3 rounded-full bg-green-500" />
            <h2 class="text-xl font-bold">Vault unlocked</h2>
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="vault.status === VaultStatus.SAVING"
              class="flex items-center gap-1 text-sm text-(--ui-text-muted)"
            >
              <UIcon name="i-lucide-loader-circle" class="h-3 w-3 animate-spin" />
              Saving...
            </span>
            <span v-else-if="vault.hasUnsavedChanges" class="text-sm text-amber-500">
              Unsaved changes
            </span>
            <span v-else class="text-sm text-(--ui-text-muted)"> Saved </span>
            <UButton
              v-if="vault.hasUnsavedChanges"
              label="Save"
              size="sm"
              color="primary"
              @click="handleSave"
            />
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
              {{
                vault.payload?.metadata.lastSavedAt
                  ? new Date(vault.payload.metadata.lastSavedAt).toLocaleString()
                  : '—'
              }}
            </p>
          </UCard>
        </div>
      </div>
    </template>

    <!-- CREATE DIALOG -->
    <UModal
      v-model:open="showCreateDialog"
      title="Create new vault"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium">Passphrase</label>
            <UInput
              v-model="passphrase"
              type="password"
              placeholder="Enter a strong passphrase (min 8 characters)"
              size="lg"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Confirm passphrase</label>
            <UInput
              v-model="passphraseConfirm"
              type="password"
              placeholder="Re-enter passphrase"
              size="lg"
            />
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
    <UModal
      v-model:open="showOpenDialog"
      title="Open existing vault"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-(--ui-text-muted)">
            After clicking &quot;Open vault&quot;, select your <code>.foli</code> file.
          </p>
          <div>
            <label class="mb-1 block text-sm font-medium">Passphrase</label>
            <UInput
              v-model="passphrase"
              type="password"
              placeholder="Enter your vault passphrase"
              size="lg"
              @keydown.enter="handleOpen"
            />
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
