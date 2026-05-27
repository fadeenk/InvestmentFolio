<script setup lang="ts">
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()

const title = 'Folio'
const description = 'Private portfolio tracker — all data encrypted at rest'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
})

const isUnlocked = computed(() => vault.status === VaultStatus.UNLOCKED)
</script>

<template>
  <UApp>
    <template v-if="isUnlocked">
      <UHeader>
        <template #left>
          <NuxtLink to="/">
            <AppLogo class="h-6 w-auto shrink-0" />
          </NuxtLink>
        </template>

        <template #right>
          <UColorModeButton />

          <div class="flex items-center gap-2">
            <span
              v-if="vault.isSaving"
              class="flex items-center gap-1 text-xs text-(--ui-text-muted)"
            >
              <UIcon name="i-lucide-loader-circle" class="h-3 w-3 animate-spin" />
              Saving...
            </span>
            <span v-else-if="vault.hasUnsavedChanges" class="text-xs text-amber-500">
              Unsaved
            </span>
            <span v-else class="text-xs text-(--ui-text-muted)"> Saved </span>
            <UButton
              v-if="vault.hasUnsavedChanges"
              label="Save"
              size="xs"
              color="primary"
              @click="vault.saveVault()"
            />
            <UButton
              label="Lock"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="vault.lockVault()"
            />
          </div>
        </template>
      </UHeader>
    </template>

    <UMain>
      <NuxtPage />
    </UMain>

    <template v-if="isUnlocked">
      <USeparator icon="i-lucide-lock" />
      <UFooter>
        <template #left>
          <p class="text-sm text-(--ui-text-muted)">
            Encrypted at rest &bull; {{ new Date().getFullYear() }}
          </p>
        </template>
      </UFooter>
    </template>
  </UApp>
</template>
