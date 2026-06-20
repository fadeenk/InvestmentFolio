<script setup lang="ts">
import { useVaultLanding } from '~/composables/useVaultLanding'

const { flow, rememberedState, rememberedFileName, passphrase, passphraseConfirm, passphraseError, isBusy, startFlow, cancelFlow, executeFlow, forgetVault } =
  useVaultLanding()

async function handleUnlock() {
  startFlow('unlock')
  await executeFlow()
}

async function handleDifferentFile() {
  startFlow('open')
  await executeFlow()
}

async function handleReSelect() {
  startFlow('unlock')
  await executeFlow()
}

function handleForget() {
  forgetVault()
}
</script>

<template>
  <div class="w-full max-w-md">
    <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-6 shadow-lg">
      <!-- Terminal header -->
      <div class="mb-6 flex items-center gap-2 border-b border-(--ui-border) pb-3">
        <span class="text-xs font-[var(--font-mono)] text-(--ui-text-muted)">vault@iFolio:~$</span>
        <span class="h-4 w-2 animate-pulse bg-[var(--color-accent)]" />
      </div>

      <!-- CREATE FLOW -->
      <template v-if="flow === 'create'">
        <VaultCreateScreen
          :passphrase="passphrase"
          :passphrase-confirm="passphraseConfirm"
          :passphrase-error="passphraseError"
          :is-busy="isBusy"
          @update:passphrase="passphrase = $event"
          @update:passphrase-confirm="passphraseConfirm = $event"
          @create="executeFlow()"
          @cancel="cancelFlow()"
        />
      </template>

      <!-- OPEN FLOW -->
      <template v-else-if="flow === 'open'">
        <div class="mb-4">
          <div class="flex items-center gap-2 text-sm font-[var(--font-mono)] text-(--ui-text-muted)">
            <span class="text-[var(--color-accent)]">$</span>
            <span>open</span>
          </div>
        </div>

        <div class="mb-4">
          <div class="flex items-center gap-2 text-sm font-[var(--font-mono)]">
            <span class="w-22 text-(--ui-text-muted)">&gt; passphrase:</span>
            <UInput
              v-model="passphrase"
              type="password"
              placeholder="enter vault passphrase"
              size="sm"
              variant="none"
              class="flex-1"
              :ui="{
                base: 'w-full bg-transparent font-[var(--font-mono)] text-sm text-(--ui-text) placeholder:text-(--ui-text-disabled) focus:outline-none',
              }"
              :disabled="isBusy"
              @keydown.enter="executeFlow()"
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
          <UButton label="Select vault file" color="primary" size="sm" :loading="isBusy" @click="executeFlow()" />
          <UButton label="Cancel" color="neutral" variant="ghost" size="sm" :disabled="isBusy" @click="cancelFlow()" />
        </div>
      </template>

      <!-- IDLE STATE: Remembered + Valid -->
      <template v-else-if="rememberedState === 'valid'">
        <div class="mb-4 rounded-sm border border-(--ui-border) bg-(--ui-bg) p-3">
          <p class="text-xs font-[var(--font-mono)] text-(--ui-text-muted)">$ ls ~/</p>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-sm font-[var(--font-mono)] text-(--ui-text)">{{ rememberedFileName }}</span>
            <span class="h-2 w-2 rounded-full bg-[var(--color-accent)]" title="valid" />
            <span class="text-xs text-(--ui-text-muted)">(valid)</span>
          </div>
        </div>

        <div class="mb-4">
          <div class="flex items-center gap-2 text-sm font-[var(--font-mono)]">
            <span class="text-(--ui-text-muted)">&gt; passphrase:</span>
            <UInput
              v-model="passphrase"
              type="password"
              placeholder="passphrase"
              size="sm"
              variant="none"
              class="flex-1"
              :ui="{
                base: 'w-full bg-transparent font-[var(--font-mono)] text-sm text-(--ui-text) placeholder:text-(--ui-text-disabled) focus:outline-none',
              }"
              :disabled="isBusy"
              @keydown.enter="handleUnlock"
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
          <UButton label="Unlock" color="primary" size="sm" :loading="isBusy" @click="handleUnlock" />
          <UButton label="Forget" color="neutral" variant="ghost" size="sm" :disabled="isBusy" @click="handleForget" />
          <UButton label="Different file" color="neutral" variant="outline" size="sm" :disabled="isBusy" @click="handleDifferentFile" />
        </div>
      </template>

      <!-- IDLE STATE: Remembered + Expired -->
      <template v-else-if="rememberedState === 'expired'">
        <div class="mb-4 rounded-sm border border-(--ui-border) bg-(--ui-bg) p-3">
          <p class="text-xs font-[var(--font-mono)] text-(--ui-text-muted)">$ ls ~/</p>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-sm font-[var(--font-mono)] text-(--ui-text)">{{ rememberedFileName }}</span>
            <span class="h-2 w-2 rounded-full bg-[var(--color-signal-amber)]" title="expired" />
            <span class="text-xs text-(--ui-text-muted)">(expired)</span>
          </div>
        </div>

        <div class="mb-4">
          <div class="flex items-center gap-2 text-sm font-[var(--font-mono)]">
            <span class="text-(--ui-text-muted)">&gt; passphrase:</span>
            <UInput
              v-model="passphrase"
              type="password"
              placeholder="passphrase"
              size="sm"
              variant="none"
              class="flex-1"
              :ui="{
                base: 'w-full bg-transparent font-[var(--font-mono)] text-sm text-(--ui-text) placeholder:text-(--ui-text-disabled) focus:outline-none',
              }"
              :disabled="isBusy"
              @keydown.enter="handleReSelect"
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
          <UButton label="Re-select &amp; unlock" color="primary" size="sm" :loading="isBusy" @click="handleReSelect" />
          <UButton label="Forget" color="neutral" variant="ghost" size="sm" :disabled="isBusy" @click="handleForget" />
        </div>
      </template>

      <!-- IDLE STATE: Fresh (no remembered vault) -->
      <template v-else>
        <div class="flex flex-col gap-3">
          <UButton label="$ create" color="primary" variant="outline" size="sm" block @click="startFlow('create')" />
          <UButton label="$ open vault" color="neutral" variant="ghost" size="sm" block @click="startFlow('open')" />
        </div>
      </template>
    </div>
  </div>
</template>
