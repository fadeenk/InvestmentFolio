<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from '#imports'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()
const router = useRouter()

watch(
  () => vault.status,
  (status) => {
    if (status === VaultStatus.UNLOCKED || status === VaultStatus.SAVING) {
      const path = vault.accounts.length > 0 ? '/dashboard' : '/settings'
      router.replace(path)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-(--ui-bg) px-4">
    <VaultLockScreen v-if="vault.status === VaultStatus.LOCKED" />
    <VaultUnlockingAnimation v-else-if="vault.status === VaultStatus.UNLOCKING" />
  </div>
</template>
