<script setup lang="ts">
import { useVaultStore } from '~/stores/vault.store'
import { computed } from 'vue'
import { useRoute } from '#imports'

const vault = useVaultStore()
const route = useRoute()
const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

const pageName = computed(() => {
  const path = route.path.replace(/^\/|\/$/g, '')
  return path || 'dashboard'
})

function toggleColorMode() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}

function lockVault() {
  vault.lockVault()
  navigateTo('/')
}
</script>

<template>
  <div class="flex h-10 items-center justify-between border-b border-(--ui-border) bg-(--ui-bg-elevated) px-4">
    <div class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
      <NuxtLink to="/" class="transition-colors hover:text-(--ui-text)">~</NuxtLink>
      <span>/</span>
      <span class="text-(--ui-text)">{{ pageName }}</span>
    </div>
    <div class="flex items-center gap-3">
      <UButton :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'" size="xs" color="neutral" variant="ghost" @click="toggleColorMode" />
      <UButton icon="i-lucide-lock" size="xs" color="neutral" variant="ghost" @click="lockVault" />
    </div>
  </div>
</template>
