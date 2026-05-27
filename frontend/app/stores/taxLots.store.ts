// ─────────────────────────────────────────────────────────────────────────────
// stores/taxLots.store.ts
//
// Manages open and closed tax lots, FIFO/LIFO/Specific-ID lot matching,
// wash sale detection, and realized gain/loss records.
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useVaultStore } from './vault.store'
import type { TaxLot, ClosedLot, TaxYearSummary } from '@/types/vault'
import { TermType } from '@/types/vault'
import { CostBasisMethod, TransactionType } from '@/types/enums'
import { randomUUID } from '@/utils/crypto'

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTaxLotsStore = defineStore('taxLots', () => {
  const vaultStore = useVaultStore()

  /** Active tax year filter for the Realized Gains view. */
  const selectedTaxYear = ref<number>(new Date().getFullYear())

  /** Whether to show wash sale flagged lots prominently. */
  const showWashSaleOnly = ref(false)

  // ── Getters — open lots ────────────────────────────────────────────────────

  const allLots = computed<TaxLot[]>(() => vaultStore.payload?.taxLots ?? [])

  const openLots = computed(() => allLots.value.filter((l) => l.isOpen))

  const closedLots = computed<ClosedLot[]>(() => {
    // ClosedLot records are derived from TaxLot records where isOpen = false.
    // The vault stores them as TaxLot entries with isOpen = false plus
    // a companion ClosedLot record written during lot matching.
    // For now we read directly from the vault's derivable shape.
    // TODO: add a top-level closedLots[] array to VaultPayload in schema v2.
    return []
  })

  /** Open lots filtered to a specific symbol. */
  function openLotsForSymbol(symbol: string): TaxLot[] {
    return openLots.value.filter((l) => l.symbol.toUpperCase() === symbol.toUpperCase())
  }

  /** Open lots filtered to a specific account. */
  function openLotsForAccount(accountId: string): TaxLot[] {
    return openLots.value.filter((l) => l.accountId === accountId)
  }

  // ── Tax Year Summary ───────────────────────────────────────────────────────

  /**
   * Aggregate realized gains/losses and income for a given tax year.
   * Derived entirely from vault data — never sent to a server.
   */
  function getTaxYearSummary(taxYear: number): TaxYearSummary {
    const dividends = vaultStore.payload?.dividends ?? []
    const income = dividends.filter((d) => d.taxYear === taxYear)

    // Realized G/L is stored as closed lot records (to be implemented fully in
    // a subsequent composable; stubs provided here for type correctness).
    const shortTermGainLoss = 0
    const longTermGainLoss = 0
    const washSaleDisallowedLosses = allLots.value
      .filter((l) => !l.isOpen && l.isWashSale)
      .reduce((s, l) => s + l.washSaleDisallowedLoss, 0)

    const filteredDividends = income
      .filter((d) => d.incomeType === TransactionType.Dividend)
      .reduce((s, d) => s + d.amount, 0)
    const interest = income
      .filter((d) => d.incomeType === TransactionType.Interest)
      .reduce((s, d) => s + d.amount, 0)

    return {
      taxYear,
      shortTermGainLoss,
      longTermGainLoss,
      totalRealizedGainLoss: shortTermGainLoss + longTermGainLoss,
      dividends: filteredDividends,
      interest,
      totalIncome: filteredDividends + interest,
      washSaleDisallowedLosses,
    }
  }

  const selectedYearSummary = computed(() => getTaxYearSummary(selectedTaxYear.value))

  /** All tax years that have activity (from dividend records + lot data). */
  const availableTaxYears = computed<number[]>(() => {
    const years = new Set<number>()
    vaultStore.payload?.dividends.forEach((d) => years.add(d.taxYear))
    allLots.value.forEach((l) => {
      if (l.acquiredDate) years.add(new Date(l.acquiredDate).getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  })

  // ── Wash Sale Tracker ──────────────────────────────────────────────────────

  const washSaleLots = computed(() => allLots.value.filter((l) => l.isWashSale))

  /** Total disallowed losses across all wash sale lots. */
  const totalWashSaleDisallowed = computed(() =>
    washSaleLots.value.reduce((s, l) => s + l.washSaleDisallowedLoss, 0),
  )

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Add a new open tax lot (called when a BUY transaction is processed).
   */
  function openLot(
    input: Omit<
      TaxLot,
      | 'id'
      | 'isOpen'
      | 'isWashSale'
      | 'washSaleDisallowedLoss'
      | 'adjustedCostBasis'
      | 'currentValue'
      | 'unrealizedGainLoss'
      | 'unrealizedGainLossPct'
      | 'daysHeld'
      | 'isLongTerm'
    >,
  ): string {
    const id = randomUUID()
    const lot: TaxLot = {
      ...input,
      id,
      isOpen: true,
      isWashSale: false,
      washSaleDisallowedLoss: 0,
      adjustedCostBasis: input.costBasis,
      currentValue: input.costBasis, // updated on next price refresh
      unrealizedGainLoss: 0,
      unrealizedGainLossPct: 0,
      daysHeld: 0,
      isLongTerm: false,
    }

    vaultStore.mutatePayload((p) => {
      p.taxLots.push(lot)
    })

    return id
  }

  /**
   * Update the current market value and unrealized G/L for all open lots
   * with the given symbol, using the provided current price.
   */
  function refreshLotValues(symbol: string, currentPrice: number): void {
    const today = new Date()

    vaultStore.mutatePayload((p) => {
      for (const lot of p.taxLots) {
        if (lot.symbol.toUpperCase() !== symbol.toUpperCase() || !lot.isOpen) continue

        const currentValue = lot.remainingQuantity * currentPrice
        const unrealizedGainLoss = currentValue - lot.adjustedCostBasis
        const unrealizedGainLossPct =
          lot.adjustedCostBasis > 0 ? (unrealizedGainLoss / lot.adjustedCostBasis) * 100 : 0
        const daysHeld = Math.floor(
          (today.getTime() - new Date(lot.acquiredDate).getTime()) / (1000 * 60 * 60 * 24),
        )

        lot.currentValue = currentValue
        lot.unrealizedGainLoss = unrealizedGainLoss
        lot.unrealizedGainLossPct = unrealizedGainLossPct
        lot.daysHeld = daysHeld
        lot.isLongTerm = daysHeld >= 366
      }
    })
  }

  /**
   * Partially or fully close an open lot when a SELL transaction is processed.
   * Returns the realized gain/loss for this lot closure.
   */
  function closeLot(
    lotId: string,
    quantitySold: number,
    salePrice: number,
    soldDate: string,
    _closingTransactionId: string,
  ): { realizedGainLoss: number; termType: TermType } {
    let result = { realizedGainLoss: 0, termType: TermType.SHORT_TERM }

    vaultStore.mutatePayload((p) => {
      const lot = p.taxLots.find((l) => l.id === lotId)
      if (!lot || !lot.isOpen) throw new Error(`Open lot ${lotId} not found`)
      if (quantitySold > lot.remainingQuantity) {
        throw new Error(
          `Cannot sell ${quantitySold} from lot with ${lot.remainingQuantity} remaining`,
        )
      }

      const costPerShare = lot.adjustedCostBasis / lot.remainingQuantity
      const costBasisClosed = costPerShare * quantitySold
      const proceeds = salePrice * quantitySold
      const realizedGainLoss = proceeds - costBasisClosed
      const daysHeld = Math.floor(
        (new Date(soldDate).getTime() - new Date(lot.acquiredDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      const termType = daysHeld >= 366 ? TermType.LONG_TERM : TermType.SHORT_TERM

      result = { realizedGainLoss, termType }

      lot.remainingQuantity -= quantitySold
      lot.costBasis -= costBasisClosed
      lot.adjustedCostBasis -= costBasisClosed

      if (lot.remainingQuantity === 0) {
        lot.isOpen = false
      }
    })

    return result
  }

  /**
   * Flag a lot as a wash sale and record the disallowed loss + adjusted cost basis.
   */
  function markWashSale(lotId: string, disallowedLoss: number): void {
    vaultStore.mutatePayload((p) => {
      const lot = p.taxLots.find((l) => l.id === lotId)
      if (!lot) throw new Error(`Lot ${lotId} not found`)
      lot.isWashSale = true
      lot.washSaleDisallowedLoss = disallowedLoss
      lot.adjustedCostBasis = lot.costBasis + disallowedLoss
    })
  }

  /**
   * Select which lots to sell when using Specific Identification.
   * Returns the lot IDs in the order they should be matched against the sale.
   */
  function selectLotsForSale(
    accountId: string,
    symbol: string,
    method: CostBasisMethod,
    quantityNeeded: number,
  ): TaxLot[] {
    const candidates = openLots.value.filter(
      (l) => l.accountId === accountId && l.symbol === symbol,
    )

    switch (method) {
      case CostBasisMethod.FIFO:
        candidates.sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate))
        break
      case CostBasisMethod.LIFO:
        candidates.sort((a, b) => b.acquiredDate.localeCompare(a.acquiredDate))
        break
      case CostBasisMethod.SpecificLot:
        // Caller is responsible for passing pre-selected lot IDs.
        // Return all candidates sorted by date for the UI picker.
        candidates.sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate))
        break
      case CostBasisMethod.AverageCost:
        // For average cost, the single "lot" represents the blended basis.
        break
    }

    // Greedily pick lots until we have enough quantity
    const selected: TaxLot[] = []
    let remaining = quantityNeeded
    for (const lot of candidates) {
      if (remaining <= 0) break
      selected.push(lot)
      remaining -= lot.remainingQuantity
    }

    return selected
  }

  // ── UI controls ────────────────────────────────────────────────────────────

  function setSelectedTaxYear(year: number): void {
    selectedTaxYear.value = year
  }

  function toggleWashSaleFilter(): void {
    showWashSaleOnly.value = !showWashSaleOnly.value
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    allLots,
    openLots,
    closedLots,
    washSaleLots,
    totalWashSaleDisallowed,
    selectedTaxYear,
    selectedYearSummary,
    availableTaxYears,
    showWashSaleOnly,
    openLotsForSymbol,
    openLotsForAccount,
    getTaxYearSummary,
    openLot,
    refreshLotValues,
    closeLot,
    markWashSale,
    selectLotsForSale,
    setSelectedTaxYear,
    toggleWashSaleFilter,
  }
})
