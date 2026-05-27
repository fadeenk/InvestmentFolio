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

watch(
  () => vault.status,
  () => {
    if (vault.status === VaultStatus.LOCKED) {
      resetForm()
    }
  }
)
</script>

<template>
  <div class="max-w-2xl mx-auto py-12 px-4">
    <!-- LOCKED STATE -->
    <template v-if="vault.status === VaultStatus.LOCKED">
      <div class="text-center space-y-8">
        <div class="space-y-2">
          <div class="flex justify-center mb-6">
            <div class="w-16 h-16 rounded-full bg-(--ui-primary) flex items-center justify-center">
              <span class="text-white text-2xl font-bold">F</span>
            </div>
          </div>
          <h1 class="text-3xl font-bold">
            Folio
          </h1>
          <p class="text-(--ui-text-muted)">
            Your private portfolio tracker. All data encrypted at rest.
          </p>
        </div>

        <div
          v-if="vault.lastError"
          class="bg-(--ui-error) text-white rounded-lg p-3 text-sm"
        >
          {{ vault.lastError }}
        </div>

        <div class="flex flex-col gap-3 max-w-xs mx-auto">
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

        <p class="text-xs text-(--ui-text-muted) mt-8">
          Supports Chrome, Edge, Firefox, and Safari
        </p>
      </div>
    </template>

    <!-- UNLOCKING STATE -->
    <template v-else-if="vault.status === VaultStatus.UNLOCKING">
      <div class="text-center space-y-6 py-16">
        <UIcon
          name="i-lucide-loader-circle"
          class="w-10 h-10 mx-auto animate-spin"
        />
        <p class="text-lg font-medium">
          Unlocking vault...
        </p>
        <p class="text-sm text-(--ui-text-muted)">
          Deriving encryption key
        </p>
      </div>
    </template>

    <!-- SAVING STATE + UNLOCKED STATE -->
    <template v-else-if="vault.status === VaultStatus.UNLOCKED || vault.status === VaultStatus.SAVING">
      <div class="space-y-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full bg-green-500" />
            <h2 class="text-xl font-bold">
              Vault unlocked
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="vault.status === VaultStatus.SAVING"
              class="text-sm text-(--ui-text-muted) flex items-center gap-1"
            >
              <UIcon
                name="i-lucide-loader-circle"
                class="w-3 h-3 animate-spin"
              />
              Saving...
            </span>
            <span
              v-else-if="vault.hasUnsavedChanges"
              class="text-sm text-amber-500"
            >
              Unsaved changes
            </span>
            <span
              v-else
              class="text-sm text-(--ui-text-muted)"
            >
              Saved
            </span>
            <UButton
              v-if="vault.hasUnsavedChanges"
              label="Save"
              size="sm"
              color="primary"
              @click="handleSave"
            />
            <UButton
              label="Lock"
              size="sm"
              color="neutral"
              variant="outline"
              @click="handleLock"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UCard>
            <template #header>
              <p class="text-sm text-(--ui-text-muted)">
                Accounts
              </p>
            </template>
            <p class="text-2xl font-bold">
              {{ vault.accounts.length }}
            </p>
          </UCard>
          <UCard>
            <template #header>
              <p class="text-sm text-(--ui-text-muted)">
                Last saved
              </p>
            </template>
            <p class="text-2xl font-bold">
              {{ vault.payload?.metadata.lastSavedAt
                ? new Date(vault.payload.metadata.lastSavedAt).toLocaleString()
                : '—' }}
            </p>
          </UCard>
        </div>
      </div>
    </template>

    <!-- CREATE DIALOG -->
    <UModal v-model="showCreateDialog">
      <UCard>
        <template #header>
          <h3 class="text-lg font-bold">
            Create new vault
          </h3>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Passphrase</label>
            <UInput
              v-model="passphrase"
              type="password"
              placeholder="Enter a strong passphrase (min 8 characters)"
              size="lg"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Confirm passphrase</label>
            <UInput
              v-model="passphraseConfirm"
              type="password"
              placeholder="Re-enter passphrase"
              size="lg"
            />
          </div>
          <p
            v-if="passphraseError"
            class="text-sm text-(--ui-error)"
          >
            {{ passphraseError }}
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="showCreateDialog = false; resetForm()"
            />
            <UButton
              label="Create vault"
              color="primary"
              @click="handleCreate"
            />
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- OPEN DIALOG -->
    <UModal v-model="showOpenDialog">
      <UCard>
        <template #header>
          <h3 class="text-lg font-bold">
            Open existing vault
          </h3>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-(--ui-text-muted)">
            After clicking &quot;Open vault&quot;, select your <code>.foli</code> file.
          </p>
          <div>
            <label class="block text-sm font-medium mb-1">Passphrase</label>
            <UInput
              v-model="passphrase"
              type="password"
              placeholder="Enter your vault passphrase"
              size="lg"
              @keydown.enter="handleOpen"
            />
          </div>
          <p
            v-if="passphraseError"
            class="text-sm text-(--ui-error)"
          >
            {{ passphraseError }}
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="showOpenDialog = false; resetForm()"
            />
            <UButton
              label="Open vault"
              color="primary"
              @click="handleOpen"
            />
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
