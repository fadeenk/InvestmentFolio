// ─────────────────────────────────────────────────────────────────────────────
// stores/accounts.store.ts
//
// CRUD operations for Account records.
// All mutations go through useVaultStore().mutatePayload() to ensure the vault
// is always the source of truth and dirty-tracking is applied automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useVaultStore } from './vault.store'
import type { Account } from '@/types/vault'
import { Bank, AccountType, SyncMethod } from '@/types/enums'
import { randomUUID } from '@/utils/crypto'

// ---------------------------------------------------------------------------
// Helper: derive SyncMethod from Bank
// ---------------------------------------------------------------------------

function syncMethodForBank(bank: Bank): SyncMethod {
  switch (bank) {
    case Bank.SCHWAB:
      return SyncMethod.SchwabAPI
    case Bank.OPTUM:
      return SyncMethod.CSVImport
    case Bank.OTHER:
    default:
      return SyncMethod.Manual
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAccountsStore = defineStore('accounts', () => {
  const vaultStore = useVaultStore()

  // ── Getters ────────────────────────────────────────────────────────────────

  const all = computed<Account[]>(() => vaultStore.payload?.accounts ?? [])

  const active = computed(() => all.value.filter((a) => a.isActive))

  const schwabAccounts = computed(() => active.value.filter((a) => a.bank === Bank.SCHWAB))

  const optumAccounts = computed(() => active.value.filter((a) => a.bank === Bank.OPTUM))

  const manualAccounts = computed(() => active.value.filter((a) => a.bank === Bank.OTHER))

  /** Look up a single account by its internal UUID. */
  function getById(id: string): Account | undefined {
    return all.value.find((a) => a.id === id)
  }

  /** True if the account is a cash-only account (no positions). */
  function isCashAccount(account: Account): boolean {
    return account.type === AccountType.CASH
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Add a new account to the vault.
   * Returns the generated account ID.
   */
  function addAccount(
    input: Omit<Account, 'id' | 'syncMethod' | 'currentBalance' | 'cashBalance' | 'lastUpdatedAt' | 'isActive'> & {
      initialBalance?: number
    },
  ): string {
    const id = randomUUID()
    const now = new Date().toISOString()

    const account: Account = {
      id,
      bank: input.bank,
      type: input.type,
      displayName: input.displayName,
      accountNumber: input.accountNumber,
      accountHash: input.accountHash ?? null,
      syncMethod: syncMethodForBank(input.bank),
      currentBalance: input.initialBalance ?? 0,
      cashBalance: input.type === AccountType.CASH ? (input.initialBalance ?? 0) : 0,
      lastUpdatedAt: now,
      isActive: true,
    }

    vaultStore.mutatePayload((p) => {
      p.accounts.push(account)
    })

    return id
  }

  /**
   * Update editable fields on an existing account.
   * Partial update — only provided fields are changed.
   */
  function updateAccount(id: string, updates: Partial<Pick<Account, 'displayName' | 'accountNumber' | 'isActive' | 'currentBalance' | 'cashBalance'>>): void {
    vaultStore.mutatePayload((p) => {
      const account = p.accounts.find((a) => a.id === id)
      if (!account) throw new Error(`Account ${id} not found`)
      Object.assign(account, updates, { lastUpdatedAt: new Date().toISOString() })
    })
  }

  /**
   * Store the Schwab account hash returned from /accounts/accountNumbers.
   * Used internally during Schwab sync.
   */
  function setSchwabAccountHash(id: string, hash: string): void {
    vaultStore.mutatePayload((p) => {
      const account = p.accounts.find((a) => a.id === id)
      if (!account) throw new Error(`Account ${id} not found`)
      account.accountHash = hash
      account.lastUpdatedAt = new Date().toISOString()
    })
  }

  /**
   * Update the balance for an account (used after API sync or manual balance
   * edit for CASH accounts).
   */
  function updateBalance(id: string, currentBalance: number, cashBalance?: number): void {
    vaultStore.mutatePayload((p) => {
      const account = p.accounts.find((a) => a.id === id)
      if (!account) throw new Error(`Account ${id} not found`)
      account.currentBalance = currentBalance
      if (cashBalance !== undefined) account.cashBalance = cashBalance
      account.lastUpdatedAt = new Date().toISOString()
    })
  }

  /** Soft-delete: mark account as inactive (preserves historical data). */
  function deactivateAccount(id: string): void {
    updateAccount(id, { isActive: false })
  }

  /** Re-activate a previously deactivated account. */
  function reactivateAccount(id: string): void {
    updateAccount(id, { isActive: true })
  }

  /**
   * Reorder accounts by providing a new array of IDs in the desired order.
   * All IDs must exist in the current account list.
   */
  function reorderAccounts(orderedIds: string[]): void {
    vaultStore.mutatePayload((p) => {
      const map = new Map(p.accounts.map((a) => [a.id, a]))
      p.accounts = orderedIds.map((id) => {
        const a = map.get(id)
        if (!a) throw new Error(`Account ${id} not found during reorder`)
        return a
      })
    })
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    all,
    active,
    schwabAccounts,
    optumAccounts,
    manualAccounts,
    getById,
    isCashAccount,
    addAccount,
    updateAccount,
    setSchwabAccountHash,
    updateBalance,
    deactivateAccount,
    reactivateAccount,
    reorderAccounts,
  }
})
