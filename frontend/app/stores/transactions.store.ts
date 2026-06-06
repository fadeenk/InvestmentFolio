// ─────────────────────────────────────────────────────────────────────────────
// stores/transactions.store.ts
//
// Manages all Transaction records: API sync ingestion, CSV import, manual
// entry, deduplication, and filtered views used by the Transactions view.
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useVaultStore } from './vault.store'
import type { Transaction } from '@/types/vault'
import { ImportSource, TransactionType } from '@/types/enums'
import { randomUUID } from '@/utils/crypto'
import { recalculateDerivedDataFromTransactions } from '@/utils/ledger'

// ---------------------------------------------------------------------------
// Filter shape
// ---------------------------------------------------------------------------

interface TransactionFilters {
  accountIds: string[] // empty = all accounts
  types: TransactionType[] // empty = all types
  symbol: string | null
  /** ISO 8601 date strings (inclusive range). */
  dateFrom: string | null
  dateTo: string | null
  importSource: ImportSource | null
}

const DEFAULT_FILTERS: TransactionFilters = {
  accountIds: [],
  types: [],
  symbol: null,
  dateFrom: null,
  dateTo: null,
  importSource: null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTransactionsStore = defineStore('transactions', () => {
  const vaultStore = useVaultStore()

  // ── Active filter state ────────────────────────────────────────────────────

  const filters = ref<TransactionFilters>({ ...DEFAULT_FILTERS })

  // ── Getters ────────────────────────────────────────────────────────────────

  const all = computed<Transaction[]>(() => vaultStore.payload?.transactions ?? [])

  const sorted = computed(() => [...all.value].sort((a, b) => b.date.localeCompare(a.date)))

  const filtered = computed(() => {
    let list = sorted.value
    const f = filters.value

    if (f.accountIds.length > 0) {
      const set = new Set(f.accountIds)
      list = list.filter((t) => set.has(t.accountId))
    }
    if (f.types.length > 0) {
      const set = new Set(f.types)
      list = list.filter((t) => set.has(t.type))
    }
    if (f.symbol) {
      const sym = f.symbol.toUpperCase()
      list = list.filter((t) => t.symbol?.toUpperCase() === sym)
    }
    if (f.dateFrom) {
      list = list.filter((t) => t.date >= f.dateFrom!)
    }
    if (f.dateTo) {
      list = list.filter((t) => t.date <= f.dateTo!)
    }
    if (f.importSource) {
      list = list.filter((t) => t.importSource === f.importSource)
    }

    return list
  })

  /** Quick-access tab subsets used by the Transactions view tabs. */
  const trades = computed(() => all.value.filter((t) => t.type === TransactionType.Buy || t.type === TransactionType.Sell))

  const dividends = computed(() => all.value.filter((t) => t.type === TransactionType.Dividend))

  const interest = computed(() => all.value.filter((t) => t.type === TransactionType.Interest))

  const transfers = computed(() =>
    all.value.filter((t) => [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL, TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT].includes(t.type)),
  )

  const manual = computed(() => all.value.filter((t) => t.importSource === ImportSource.MANUAL))

  /** Returns all transactions for a given account. */
  function forAccount(accountId: string): Transaction[] {
    return all.value.filter((t) => t.accountId === accountId)
  }

  /** Returns all transactions for a given symbol across all accounts. */
  function forSymbol(symbol: string): Transaction[] {
    return all.value.filter((t) => t.symbol?.toUpperCase() === symbol.toUpperCase())
  }

  // ── Deduplication ──────────────────────────────────────────────────────────

  /** Set of external IDs already present in the vault. O(1) lookup. */
  const _externalIdSet = computed(() => new Set(all.value.map((t) => t.externalId).filter(Boolean)))

  /**
   * Check whether a transaction with this external ID already exists.
   * Used during API sync to skip duplicates.
   */
  function isDuplicate(externalId: string): boolean {
    return _externalIdSet.value.has(externalId)
  }

  /**
   * For CSV import: check if a transaction with the same date + quantity + type
   * combination already exists (no external ID available).
   */
  function isCsvDuplicate(date: string, quantity: number | null, type: TransactionType): boolean {
    return all.value.some((t) => t.date === date && t.quantity === quantity && t.type === type && t.importSource !== ImportSource.MANUAL)
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Bulk-insert transactions from an API sync or CSV import.
   * Automatically deduplicates by externalId (API) or date+amount+type (CSV).
   * Returns the count of new records inserted.
   */
  function insertMany(incoming: Omit<Transaction, 'id' | 'importedAt'>[]): number {
    const now = new Date().toISOString()
    const toInsert: Transaction[] = []

    for (const t of incoming) {
      if (t.externalId && isDuplicate(t.externalId)) continue
      if (!t.externalId && isCsvDuplicate(t.date, t.quantity, t.type)) continue
      toInsert.push({ ...t, id: randomUUID(), importedAt: now })
    }

    if (toInsert.length === 0) return 0

    vaultStore.mutatePayload((p) => {
      p.transactions.push(...toInsert)
      recalculateDerivedDataFromTransactions(p)
    })

    return toInsert.length
  }

  /**
   * Add a single manually-entered transaction.
   * Returns the generated transaction ID.
   */
  function addManual(input: Omit<Transaction, 'id' | 'importedAt' | 'importSource' | 'externalId' | 'matchedLotIds'>): string {
    const id = randomUUID()
    const now = new Date().toISOString()

    const tx: Transaction = {
      ...input,
      id,
      externalId: null,
      importSource: ImportSource.MANUAL,
      importedAt: now,
      matchedLotIds: [],
    }

    vaultStore.mutatePayload((p) => {
      p.transactions.push(tx)
      recalculateDerivedDataFromTransactions(p)
    })

    return id
  }

  /**
   * Update a manually-entered or CSV-imported transaction.
   * API-synced transactions (externalId is set) cannot be edited.
   */
  function updateTransaction(
    id: string,
    updates: Partial<Pick<Transaction, 'date' | 'type' | 'symbol' | 'description' | 'quantity' | 'price' | 'quantity' | 'fees' | 'notes'>>,
  ): void {
    vaultStore.mutatePayload((p) => {
      const tx = p.transactions.find((t) => t.id === id)
      if (!tx) throw new Error(`Transaction ${id} not found`)
      if (tx.externalId) throw new Error('Cannot edit API-synced transactions')
      Object.assign(tx, updates)
      recalculateDerivedDataFromTransactions(p)
    })
  }

  /**
   * Delete a manually-entered or CSV-imported transaction.
   * API-synced transactions cannot be deleted.
   */
  function deleteTransaction(id: string): void {
    vaultStore.mutatePayload((p) => {
      const idx = p.transactions.findIndex((t) => t.id === id)
      if (idx === -1) throw new Error(`Transaction ${id} not found`)
      const tx = p.transactions[idx]
      if (tx && tx.externalId) {
        throw new Error('Cannot delete API-synced transactions')
      }
      p.transactions.splice(idx, 1)
      recalculateDerivedDataFromTransactions(p)
    })
  }

  // ── Filter controls ────────────────────────────────────────────────────────

  function setFilters(partial: Partial<TransactionFilters>): void {
    filters.value = { ...filters.value, ...partial }
  }

  function resetFilters(): void {
    filters.value = { ...DEFAULT_FILTERS }
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    all,
    sorted,
    filtered,
    filters,
    // Tab subsets
    trades,
    dividends,
    interest,
    transfers,
    manual,
    // Lookup
    forAccount,
    forSymbol,
    // Dedup
    isDuplicate,
    isCsvDuplicate,
    // Mutations
    insertMany,
    addManual,
    updateTransaction,
    deleteTransaction,
    // Filter controls
    setFilters,
    resetFilters,
  }
})
