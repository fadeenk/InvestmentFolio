<script setup lang="ts">
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-(--ui-bg) px-4">
    <VaultLockScreen v-if="vault.status === VaultStatus.LOCKED" />
    <VaultUnlockingAnimation v-else-if="vault.status === VaultStatus.UNLOCKING" />
    <VaultUnlockedSummary v-else-if="vault.status === VaultStatus.UNLOCKED || vault.status === VaultStatus.SAVING" />
  </div>
</template>
