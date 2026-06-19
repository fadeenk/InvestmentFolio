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
