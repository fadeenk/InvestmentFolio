// ─────────────────────────────────────────────────────────────────────────────
// stores/positions.store.ts
//
// Manages position snapshots persisted in the vault.
// Provides computed portfolio metrics used by the Dashboard summary cards and
// the Positions / Cost Basis view.
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useVaultStore } from './vault.store'
import type {
  Position,
  PortfolioSummary,
  AllocationSlice,
  PortfolioValuePoint,
} from '@/types/vault'
import { AssetType, TimeRange, TransactionType } from '@/types/enums'
import { randomUUID } from '@/utils/crypto'

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePositionsStore = defineStore('positions', () => {
  const vaultStore = useVaultStore()

  // ── Active UI state ────────────────────────────────────────────────────────

  /** The currently selected account filter (null = all accounts). */
  const selectedAccountId = ref<string | null>(null)

  /** The currently selected time range for charts. */
  const selectedTimeRange = ref<TimeRange>(TimeRange.YTD)

  // ── Getters — raw ──────────────────────────────────────────────────────────

  const all = computed<Position[]>(() => vaultStore.payload?.positions ?? [])

  /**
   * Latest snapshot per symbol+account combination.
   * This is the "current" view of holdings.
   */
  const latest = computed<Position[]>(() => {
    const seen = new Map<string, Position>()
    // Positions are appended on each sync; iterate newest-first by snapshotAt
    const sorted = [...all.value].sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt))
    for (const p of sorted) {
      const key = `${p.accountId}::${p.symbol}`
      if (!seen.has(key)) seen.set(key, p)
    }
    return Array.from(seen.values())
  })

  /** Latest positions filtered to the selected account (or all if null). */
  const visible = computed<Position[]>(() => {
    if (!selectedAccountId.value) return latest.value
    return latest.value.filter((p) => p.accountId === selectedAccountId.value)
  })

  /** Positions for a specific account. */
  function forAccount(accountId: string): Position[] {
    return latest.value.filter((p) => p.accountId === accountId)
  }

  // ── Portfolio Summary ──────────────────────────────────────────────────────

  const summary = computed<PortfolioSummary>(() => {
    const positions = visible.value
    const payload = vaultStore.payload

    const totalMarketValue = positions.reduce((s, p) => s + p.marketValue, 0)
    const totalCostBasis = positions.reduce((s, p) => s + p.avgCost * p.quantity, 0)
    const totalUnrealizedGainLoss = positions.reduce((s, p) => s + p.unrealizedGainLoss, 0)
    const totalDayGainLoss = positions.reduce((s, p) => s + p.dayGainLoss, 0)

    const unrealizedPct = totalCostBasis > 0 ? (totalUnrealizedGainLoss / totalCostBasis) * 100 : 0
    const dayPct =
      totalCostBasis > 0 ? (totalDayGainLoss / (totalMarketValue - totalDayGainLoss)) * 100 : 0

    // Cash balances — pulled from accounts
    const accounts = payload?.accounts ?? []
    const accountFilter = selectedAccountId.value
    const relevantAccounts = accountFilter
      ? accounts.filter((a) => a.id === accountFilter)
      : accounts.filter((a) => a.isActive)
    const totalCashBalance = relevantAccounts.reduce((s, a) => s + a.cashBalance, 0)

    // Realized G/L and income for current calendar year
    const currentYear = new Date().getFullYear()
    const _closedLots = payload?.taxLots.filter((l) => !l.isOpen) ?? []
    // Note: ClosedLot lives separately; for now derive from transactions
    // (full realized G/L computation lives in taxLots.store.ts)
    const ytdRealizedShort = 0 // computed in taxLots.store.ts
    const ytdRealizedLong = 0
    const ytdRealizedTotal = 0

    const ytdDividends = (payload?.dividends ?? [])
      .filter((d) => d.taxYear === currentYear && d.incomeType === TransactionType.Dividend)
      .reduce((s, d) => s + d.amount, 0)

    const ytdInterest = (payload?.dividends ?? [])
      .filter((d) => d.taxYear === currentYear && d.incomeType === TransactionType.Interest)
      .reduce((s, d) => s + d.amount, 0)

    return {
      totalMarketValue,
      totalCostBasis,
      totalUnrealizedGainLoss,
      totalUnrealizedGainLossPct: unrealizedPct,
      totalDayGainLoss,
      totalDayGainLossPct: dayPct,
      totalCashBalance,
      ytdRealizedGainLossShortTerm: ytdRealizedShort,
      ytdRealizedGainLossLongTerm: ytdRealizedLong,
      ytdRealizedGainLossTotal: ytdRealizedTotal,
      ytdIncomeTotal: ytdDividends + ytdInterest,
      ytdDividends,
      ytdInterest,
    }
  })

  // ── Asset Allocation ───────────────────────────────────────────────────────

  const allocation = computed<AllocationSlice[]>(() => {
    const positions = visible.value
    const totalValue = positions.reduce((s, p) => s + p.marketValue, 0)

    if (totalValue === 0) return []

    const byType = new Map<AssetType, number>()
    for (const p of positions) {
      byType.set(p.assetType, (byType.get(p.assetType) ?? 0) + p.marketValue)
    }

    const LABELS: Record<AssetType, string> = {
      [AssetType.Stock]: 'Equity',
      [AssetType.Bond]: 'Fixed Income (Bond)',
      [AssetType.Crypto]: 'Crypto',
      [AssetType.Cash]: 'Cash & Equivalents',
      [AssetType.MutualFund]: 'Mutual Funds',
      [AssetType.ETF]: 'ETFs',
    }

    return Array.from(byType.entries())
      .map(([assetType, marketValue]) => ({
        assetType,
        label: LABELS[assetType] ?? assetType,
        marketValue,
        percentage: (marketValue / totalValue) * 100,
      }))
      .sort((a, b) => b.marketValue - a.marketValue)
  })

  // ── Portfolio Value Chart ──────────────────────────────────────────────────

  /**
   * Build portfolio value time-series from daily position snapshots.
   * Returns one data point per calendar day for the selected time range.
   */
  const portfolioValueSeries = computed<PortfolioValuePoint[]>(() => {
    const allPositions = all.value
    if (allPositions.length === 0) return []

    const cutoff = _cutoffDate(selectedTimeRange.value)

    // Group snapshots by date
    const byDate = new Map<string, number>()
    for (const p of allPositions) {
      const date = p.snapshotAt.slice(0, 10) // YYYY-MM-DD
      if (date < cutoff) continue
      if (!selectedAccountId.value || p.accountId === selectedAccountId.value) {
        byDate.set(date, (byDate.get(date) ?? 0) + p.marketValue)
      }
    }

    const points = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totalValue], idx, arr) => {
        const prevValue = idx > 0 ? arr[idx - 1][1] : totalValue
        return {
          date,
          totalValue,
          dayGainLoss: totalValue - prevValue,
        }
      })

    return points
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Bulk-upsert position snapshots from an API sync.
   * New snapshots are appended (old ones are retained for chart history).
   */
  function upsertSnapshots(incoming: Omit<Position, 'id'>[]): void {
    const now = new Date().toISOString()
    const snapshots: Position[] = incoming.map((p) => ({
      ...p,
      id: randomUUID(),
      snapshotAt: p.snapshotAt || now,
    }))

    vaultStore.mutatePayload((p) => {
      p.positions.push(...snapshots)
    })
  }

  /**
   * Prune position snapshots older than the given ISO date string.
   * Use to keep vault size manageable (e.g. prune > 2 years old).
   */
  function pruneOldSnapshots(olderThan: string): number {
    let pruned = 0
    vaultStore.mutatePayload((p) => {
      const before = p.positions.length
      p.positions = p.positions.filter((pos) => pos.snapshotAt >= olderThan)
      pruned = before - p.positions.length
    })
    return pruned
  }

  // ── UI controls ────────────────────────────────────────────────────────────

  function selectAccount(id: string | null): void {
    selectedAccountId.value = id
  }

  function selectTimeRange(range: TimeRange): void {
    selectedTimeRange.value = range
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    all,
    latest,
    visible,
    selectedAccountId,
    selectedTimeRange,
    summary,
    allocation,
    portfolioValueSeries,
    forAccount,
    upsertSnapshots,
    pruneOldSnapshots,
    selectAccount,
    selectTimeRange,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _cutoffDate(range: TimeRange): string {
  const now = new Date()
  switch (range) {
    case TimeRange.ONE_DAY: {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      return d.toISOString().slice(0, 10)
    }
    case TimeRange.ONE_WEEK: {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString().slice(0, 10)
    }
    case TimeRange.ONE_MONTH: {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return d.toISOString().slice(0, 10)
    }
    case TimeRange.THREE_MONTHS: {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 3)
      return d.toISOString().slice(0, 10)
    }
    case TimeRange.YTD:
      return `${now.getFullYear()}-01-01`
    case TimeRange.ONE_YEAR: {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      return d.toISOString().slice(0, 10)
    }
    case TimeRange.ALL:
    default:
      return '1970-01-01'
  }
}
