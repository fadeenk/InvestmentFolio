<script setup lang="ts">
import { useRoute } from '#imports'

const route = useRoute()

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
  <aside class="group fixed top-0 left-0 z-50 flex h-full w-14 flex-col border-r border-(--ui-border) bg-(--ui-bg) transition-all duration-200 hover:w-50">
    <!-- Logo area -->
    <div class="flex h-14 flex-col gap-1 border-b border-(--ui-border) p-2">
      <NuxtLink
        to="/"
        :class="[
          'relative flex items-center gap-3 rounded-sm',
          'px-3 py-2 text-sm',
          'text-[var(--color-accent)]',
          'transition-colors duration-150',
          'hover:bg-(--ui-bg-elevated)',
        ]"
      >
        <div v-if="isActive('/')" class="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r bg-[var(--color-accent)]" />
        <UIcon name="i-lucide-vault" class="h-4 w-4 shrink-0" />
        <span class="text-sm font-bold whitespace-nowrap text-[var(--ui-text)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">iFolio</span>
      </NuxtLink>
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
