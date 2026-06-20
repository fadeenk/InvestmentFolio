<script setup lang="ts">
defineProps<{
  passphrase: string
  passphraseConfirm: string
  passphraseError: string
  isBusy: boolean
}>()

const emit = defineEmits<{
  'update:passphrase': [value: string]
  'update:passphraseConfirm': [value: string]
  create: []
  cancel: []
}>()
</script>

<template>
  <div>
    <div class="mb-4">
      <div class="flex items-center gap-2 text-sm font-[var(--font-mono)] text-(--ui-text-muted)">
        <span class="text-[var(--color-accent)]">$</span>
        <span>create</span>
      </div>
    </div>

    <div class="mb-3">
      <div class="flex items-center gap-2 text-sm font-[var(--font-mono)]">
        <span class="w-20 text-(--ui-text-muted)">&gt; passphrase:</span>
        <UInput
          :model-value="passphrase"
          type="password"
          placeholder="min 8 characters"
          size="sm"
          variant="none"
          class="flex-1"
          :ui="{
            base: 'w-full bg-transparent font-[var(--font-mono)] text-sm text-(--ui-text) placeholder:text-(--ui-text-disabled) focus:outline-none',
          }"
          :disabled="isBusy"
          @update:model-value="emit('update:passphrase', $event)"
          @keydown.enter="emit('create')"
        />
      </div>
    </div>

    <div class="mb-4">
      <div class="flex items-center gap-2 text-sm font-[var(--font-mono)]">
        <span class="w-20 text-(--ui-text-muted)">&gt; confirm:</span>
        <UInput
          :model-value="passphraseConfirm"
          type="password"
          placeholder="re-enter passphrase"
          size="sm"
          variant="none"
          class="flex-1"
          :ui="{
            base: 'w-full bg-transparent font-[var(--font-mono)] text-sm text-(--ui-text) placeholder:text-(--ui-text-disabled) focus:outline-none',
          }"
          :disabled="isBusy"
          @update:model-value="emit('update:passphraseConfirm', $event)"
          @keydown.enter="emit('create')"
        />
      </div>
    </div>

    <p
      v-if="passphraseError"
      :class="[
        'mb-4 rounded-sm border',
        'border-[var(--color-signal-red)]/30',
        'bg-[var(--color-signal-red)]/10',
        'px-3 py-2 text-xs',
        'font-[var(--font-mono)]',
        'text-[var(--color-signal-red)]',
      ]"
    >
      &gt; {{ passphraseError }}
    </p>

    <div class="flex gap-2">
      <UButton label="Create vault" color="primary" size="sm" :loading="isBusy" @click="emit('create')" />
      <UButton label="Cancel" color="neutral" variant="ghost" size="sm" :disabled="isBusy" @click="emit('cancel')" />
    </div>
  </div>
</template>
