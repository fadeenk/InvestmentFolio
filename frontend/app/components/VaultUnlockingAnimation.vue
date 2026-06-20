<script setup lang="ts">
import { computed } from 'vue'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'

const vault = useVaultStore()

const label = computed(() => {
  if (vault.status === VaultStatus.SAVING) return 'Saving'
  if (vault.lastError) return 'Error'
  return 'Decrypting key'
})
</script>

<template>
  <div class="w-full max-w-md text-center">
    <!-- Terminal header -->
    <div class="mb-6 flex items-center justify-center gap-2">
      <span class="text-xs font-[var(--font-mono)] text-(--ui-text-muted)">vault@iFolio:~$</span>
      <span :class="['text-xs font-[var(--font-mono)]', vault.lastError ? 'text-[var(--color-signal-red)]' : 'text-[var(--color-accent)]']">
        {{ label }}
      </span>
    </div>

    <!-- Error state -->
    <div
      v-if="vault.lastError"
      :class="[
        'rounded-sm border',
        'border-[var(--color-signal-red)]/30',
        'bg-[var(--color-signal-red)]/10',
        'px-3 py-2 text-xs',
        'font-[var(--font-mono)]',
        'text-[var(--color-signal-red)]',
      ]"
    >
      &gt; {{ vault.lastError }}
    </div>

    <!-- Spinner for unlocking/saving -->
    <div v-else class="flex flex-col items-center gap-3">
      <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin text-(--ui-text-muted)" />
      <span class="text-xs font-[var(--font-mono)] text-(--ui-text-muted)">
        <span>{{ label }}</span>
        <span class="animate-pulse">...</span>
      </span>
    </div>
  </div>
</template>
