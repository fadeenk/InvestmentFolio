// ─────────────────────────────────────────────────────────────────────────────
// stores/income.store.ts
//
// Manages IncomeRecord persistence and provides the computed views used by the
// Income view: year-over-year comparison, monthly calendar grid, and per-symbol
// income summary table.
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useVaultStore } from './vault.store'
import type { IncomeRecord, MonthlyIncomeSummary, SecurityIncomeSummary } from '@/types/vault'
import { TransactionType } from '@/types/enums'
import { randomUUID } from '@/utils/crypto'

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useIncomeStore = defineStore('income', () => {
  const vaultStore = useVaultStore()

  /** The tax year shown in the Income view. Defaults to current year. */
  const selectedYear = ref<number>(new Date().getFullYear())

  // ── Getters ────────────────────────────────────────────────────────────────

  const all = computed<IncomeRecord[]>(() => vaultStore.payload?.dividends ?? [])

  const forSelectedYear = computed(() => all.value.filter((d) => d.taxYear === selectedYear.value))

  const priorYear = computed(() => all.value.filter((d) => d.taxYear === selectedYear.value - 1))

  /** All calendar years that have income records, sorted descending. */
  const availableYears = computed<number[]>(() => {
    const years = new Set(all.value.map((d) => d.taxYear))
    return Array.from(years).sort((a, b) => b - a)
  })

  // ── Year-over-year totals ──────────────────────────────────────────────────

  const ytdTotals = computed(() => _aggregateIncome(forSelectedYear.value))
  const priorYearTotals = computed(() => _aggregateIncome(priorYear.value))

  // ── Monthly calendar grid ──────────────────────────────────────────────────

  /**
   * Returns 12 monthly summary objects for the selected year, one per month.
   * Months with no income have zero values (never omitted, for grid alignment).
   */
  const monthlyGrid = computed<MonthlyIncomeSummary[]>(() => {
    const year = selectedYear.value
    const months: MonthlyIncomeSummary[] = Array.from({ length: 12 }, (_, i) => ({
      yearMonth: `${year}-${String(i + 1).padStart(2, '0')}`,
      totalDividends: 0,
      interest: 0,
      total: 0,
    }))

    for (const record of forSelectedYear.value) {
      const month = parseInt(record.date.slice(5, 7), 10) - 1 // 0-indexed
      if (month < 0 || month > 11) continue
      const m = months[month]
      if (!m) continue
      switch (record.incomeType) {
        case TransactionType.Dividend:
          m.totalDividends += record.amount
          break
        case TransactionType.Interest:
          m.interest += record.amount
          break
      }
      m.total = m.totalDividends + m.interest
    }

    return months
  })

  // ── Per-security income table ──────────────────────────────────────────────

  /**
   * Aggregate income by symbol for the selected year and the prior year.
   * Used in the "Income by security" table in the Income view.
   */
  const bySymbol = computed<SecurityIncomeSummary[]>(() => {
    const currentRecords = forSelectedYear.value.filter((d) => d.symbol)
    const priorRecords = priorYear.value.filter((d) => d.symbol)

    const map = new Map<string, SecurityIncomeSummary>()

    function getOrCreate(symbol: string): SecurityIncomeSummary {
      if (!map.has(symbol)) {
        map.set(symbol, {
          symbol,
          description: symbol, // description populated from position data if available
          ytdTotal: 0,
          priorYearTotal: 0,
          dividend: 0,
          interest: 0,
        })
      }
      return map.get(symbol)!
    }

    for (const r of currentRecords) {
      const entry = getOrCreate(r.symbol!)
      entry.ytdTotal += r.amount
      switch (r.incomeType) {
        case TransactionType.Dividend:
          entry.dividend += r.amount
          break
        case TransactionType.Interest:
          entry.interest += r.amount
          break
      }
    }

    for (const r of priorRecords) {
      const entry = getOrCreate(r.symbol!)
      entry.priorYearTotal += r.amount
    }

    return Array.from(map.values()).sort((a, b) => b.ytdTotal - a.ytdTotal)
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Bulk-insert income records from a sync or import.
   * Deduplicates by transactionId.
   */
  function insertMany(incoming: Omit<IncomeRecord, 'id'>[]): number {
    const existingTxIds = new Set(all.value.map((d) => d.transactionId))
    const toInsert = incoming.filter((r) => !existingTxIds.has(r.transactionId)).map((r) => ({ ...r, id: randomUUID() }))

    if (toInsert.length === 0) return 0

    vaultStore.mutatePayload((p) => {
      p.dividends.push(...toInsert)
    })

    return toInsert.length
  }

  // ── UI controls ────────────────────────────────────────────────────────────

  function setSelectedYear(year: number): void {
    selectedYear.value = year
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    all,
    forSelectedYear,
    priorYear,
    availableYears,
    selectedYear,
    ytdTotals,
    priorYearTotals,
    monthlyGrid,
    bySymbol,
    insertMany,
    setSelectedYear,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _aggregateIncome(records: IncomeRecord[]) {
  return records.reduce(
    (acc, r) => {
      acc.total += r.amount
      switch (r.incomeType) {
        case TransactionType.Dividend:
          acc.dividend += r.amount
          break
        case TransactionType.Interest:
          acc.interest += r.amount
          break
      }
      return acc
    },
    {
      total: 0,
      dividend: 0,
      interest: 0,
    },
  )
}
