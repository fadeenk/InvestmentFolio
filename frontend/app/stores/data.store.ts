import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useVaultStore } from './vault.store'
import type {
  Account,
  Transaction,
  VaultPayload,
  Position,
  PortfolioSummary,
  AllocationSlice,
  PortfolioValuePoint,
  IncomeRecord,
  MonthlyIncomeSummary,
  SecurityIncomeSummary,
  TaxLot,
  ClosedLot,
  TaxYearSummary,
} from '@/types/vault'
import { AccountType, AssetType, CostBasisMethod, ImportSource, TimeRange, TransactionType } from '@/types/enums'
import { TermType } from '@/types/vault'
import { randomUUID } from '@/utils/crypto'
import { recalculateDerivedDataFromTransactions } from '@/utils/ledger'
import { generateBalanceHistories } from '@/stores/market.store'

function buildSymbolToAssetType(payload: VaultPayload): Map<string, AssetType> {
  const map = new Map<string, AssetType>()
  for (const pos of payload.positions) {
    if (!map.has(pos.symbol)) {
      map.set(pos.symbol, pos.assetType)
    }
  }
  return map
}

interface TransactionFilters {
  accountIds: string[]
  types: TransactionType[]
  symbol: string | null
  dateFrom: string | null
  dateTo: string | null
  importSource: ImportSource | null
}

const DEFAULT_TX_FILTERS: TransactionFilters = {
  accountIds: [],
  types: [],
  symbol: null,
  dateFrom: null,
  dateTo: null,
  importSource: null,
}

export const useDataStore = defineStore('data', () => {
  const vaultStore = useVaultStore()

  // ════════════════════════════════════════════════════════════════
  // Accounts
  // ════════════════════════════════════════════════════════════════

  const allAccounts = computed<Account[]>(() => vaultStore.payload?.accounts ?? [])

  function getAccountById(id: string): Account | undefined {
    return allAccounts.value.find((a) => a.id === id)
  }

  function addAccount(
    input: Omit<Account, 'id' | 'currentBalance' | 'cashBalance' | 'lastUpdatedAt' | 'isActive'> & {
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
      currentBalance: input.initialBalance ?? 0,
      cashBalance: input.type === AccountType.CASH ? (input.initialBalance ?? 0) : 0,
      lastUpdatedAt: now,
    }
    vaultStore.mutatePayload((p) => {
      p.accounts.push(account)
    })
    return id
  }

  function updateAccount(
    id: string,
    updates: Partial<Pick<Account, 'displayName' | 'accountNumber' | 'currentBalance' | 'cashBalance' | 'bank' | 'type'>>,
  ): void {
    vaultStore.mutatePayload((p) => {
      const a = p.accounts.find((x) => x.id === id)
      if (!a) throw new Error(`Account ${id} not found`)
      Object.assign(a, updates, { lastUpdatedAt: new Date().toISOString() })
    })
  }

  function updateBalance(id: string, currentBalance: number, cashBalance?: number): void {
    vaultStore.mutatePayload((p) => {
      const a = p.accounts.find((x) => x.id === id)
      if (!a) throw new Error(`Account ${id} not found`)
      a.currentBalance = currentBalance
      if (cashBalance !== undefined) a.cashBalance = cashBalance
      a.lastUpdatedAt = new Date().toISOString()
    })
  }

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

  // ════════════════════════════════════════════════════════════════
  // Transactions
  // ════════════════════════════════════════════════════════════════

  const txFilters = ref<TransactionFilters>({ ...DEFAULT_TX_FILTERS })

  const allTransactions = computed<Transaction[]>(() => vaultStore.payload?.transactions ?? [])

  const sortedTransactions = computed(() => [...allTransactions.value].sort((a, b) => b.date.localeCompare(a.date)))

  const filteredTransactions = computed(() => {
    let list = sortedTransactions.value
    const f = txFilters.value
    if (f.accountIds.length > 0) {
      const s = new Set(f.accountIds)
      list = list.filter((t) => s.has(t.accountId))
    }
    if (f.types.length > 0) {
      const s = new Set(f.types)
      list = list.filter((t) => s.has(t.type))
    }
    if (f.symbol) {
      const sym = f.symbol.toUpperCase()
      list = list.filter((t) => t.symbol?.toUpperCase() === sym)
    }
    if (f.dateFrom) list = list.filter((t) => t.date >= f.dateFrom!)
    if (f.dateTo) list = list.filter((t) => t.date <= f.dateTo!)
    if (f.importSource) list = list.filter((t) => t.importSource === f.importSource)
    return list
  })

  const trades = computed(() => allTransactions.value.filter((t) => t.type === TransactionType.Buy || t.type === TransactionType.Sell))
  const dividendTransactions = computed(() => allTransactions.value.filter((t) => t.type === TransactionType.Dividend))
  const interestTransactions = computed(() => allTransactions.value.filter((t) => t.type === TransactionType.Interest))
  const transfers = computed(() =>
    allTransactions.value.filter((t) =>
      [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL, TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT].includes(t.type),
    ),
  )
  const manualTransactions = computed(() => allTransactions.value.filter((t) => t.importSource === ImportSource.MANUAL))

  function transactionsForAccount(accountId: string): Transaction[] {
    return allTransactions.value.filter((t) => t.accountId === accountId)
  }

  function transactionsForSymbol(symbol: string): Transaction[] {
    return allTransactions.value.filter((t) => t.symbol?.toUpperCase() === symbol.toUpperCase())
  }

  const _externalIdSet = computed(() => new Set(allTransactions.value.map((t) => t.externalId).filter(Boolean)))

  function isDuplicate(externalId: string): boolean {
    return _externalIdSet.value.has(externalId)
  }

  function isCsvDuplicate(date: string, quantity: number | null, type: TransactionType): boolean {
    return allTransactions.value.some((t) => t.date === date && t.quantity === quantity && t.type === type && t.importSource !== ImportSource.MANUAL)
  }

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
      generateBalanceHistories(p, buildSymbolToAssetType(p))
    })
    return toInsert.length
  }

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
      generateBalanceHistories(p, buildSymbolToAssetType(p))
    })
    return id
  }

  function updateTransaction(
    id: string,
    updates: Partial<Pick<Transaction, 'date' | 'type' | 'assetType' | 'symbol' | 'description' | 'quantity' | 'price' | 'fees' | 'notes'>>,
  ): void {
    vaultStore.mutatePayload((p) => {
      const tx = p.transactions.find((t) => t.id === id)
      if (!tx) throw new Error(`Transaction ${id} not found`)
      if (tx.externalId) throw new Error('Cannot edit API-synced transactions')
      Object.assign(tx, updates)
      recalculateDerivedDataFromTransactions(p)
      generateBalanceHistories(p, buildSymbolToAssetType(p))
    })
  }

  function deleteTransaction(id: string): void {
    vaultStore.mutatePayload((p) => {
      const idx = p.transactions.findIndex((t) => t.id === id)
      if (idx === -1) throw new Error(`Transaction ${id} not found`)
      if (p.transactions[idx]?.externalId) throw new Error('Cannot delete API-synced transactions')
      p.transactions.splice(idx, 1)
      recalculateDerivedDataFromTransactions(p)
      generateBalanceHistories(p, buildSymbolToAssetType(p))
    })
  }

  function setTxFilters(partial: Partial<TransactionFilters>): void {
    txFilters.value = { ...txFilters.value, ...partial }
  }

  function resetTxFilters(): void {
    txFilters.value = { ...DEFAULT_TX_FILTERS }
  }

  // ════════════════════════════════════════════════════════════════
  // Positions (computed views + snapshots)
  // ════════════════════════════════════════════════════════════════

  const selectedAccountId = ref<string | null>(null)
  const selectedTimeRange = ref<TimeRange>(TimeRange.YTD)

  const allPositions = computed<Position[]>(() => vaultStore.payload?.positions ?? [])

  const latestPositions = computed<Position[]>(() => {
    const seen = new Map<string, Position>()
    const sorted = [...allPositions.value].sort((a, b) => (b.snapshotAt ?? '').localeCompare(a.snapshotAt ?? ''))
    for (const p of sorted) {
      const key = `${p.accountId}::${p.symbol}`
      if (!seen.has(key)) seen.set(key, p)
    }
    return Array.from(seen.values())
  })

  const visiblePositions = computed<Position[]>(() => {
    if (!selectedAccountId.value) return latestPositions.value
    return latestPositions.value.filter((p) => p.accountId === selectedAccountId.value)
  })

  function positionsForAccount(accountId: string): Position[] {
    return latestPositions.value.filter((p) => p.accountId === accountId)
  }

  const portfolioSummary = computed<PortfolioSummary>(() => {
    const positions = visiblePositions.value
    const payload = vaultStore.payload
    const totalMarketValue = positions.reduce((s, p) => s + p.marketValue, 0)
    const totalCostBasis = positions.reduce((s, p) => s + p.avgCost * p.quantity, 0)
    const totalUnrealizedGainLoss = positions.reduce((s, p) => s + p.unrealizedGainLoss, 0)
    const totalDayGainLoss = positions.reduce((s, p) => s + p.dayGainLoss, 0)
    const unrealizedPct = totalCostBasis > 0 ? (totalUnrealizedGainLoss / totalCostBasis) * 100 : 0
    const dayPct = totalCostBasis > 0 ? (totalDayGainLoss / (totalMarketValue - totalDayGainLoss)) * 100 : 0
    const accounts = payload?.accounts ?? []
    const accountFilter = selectedAccountId.value
    const relevantAccounts = accountFilter ? accounts.filter((a) => a.id === accountFilter) : accounts
    const totalCashBalance = relevantAccounts.reduce((s, a) => s + a.cashBalance, 0)
    const currentYear = new Date().getFullYear()
    const closedLots = payload?.closedLots ?? []
    const ytdRealizedClosed = closedLots.filter((l) => l.taxYear === currentYear)
    const ytdRealizedShort = ytdRealizedClosed.filter((l) => l.termType === TermType.SHORT_TERM).reduce((s, l) => s + l.realizedGainLoss, 0)
    const ytdRealizedLong = ytdRealizedClosed.filter((l) => l.termType === TermType.LONG_TERM).reduce((s, l) => s + l.realizedGainLoss, 0)
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
      ytdRealizedGainLossTotal: ytdRealizedShort + ytdRealizedLong,
      ytdIncomeTotal: ytdDividends + ytdInterest,
      ytdDividends,
      ytdInterest,
    }
  })

  const allocation = computed<AllocationSlice[]>(() => {
    const positions = visiblePositions.value
    const totalValue = positions.reduce((s, p) => s + p.marketValue, 0)
    if (totalValue === 0) return []
    const byType = new Map<AssetType, number>()
    for (const p of positions) byType.set(p.assetType, (byType.get(p.assetType) ?? 0) + p.marketValue)
    const LABELS: Record<AssetType, string> = {
      [AssetType.Stock]: 'Equity',
      [AssetType.Bond]: 'Fixed Income (Bond)',
      [AssetType.Crypto]: 'Crypto',
      [AssetType.Cash]: 'Cash',
      [AssetType.CashEquivalent]: 'Cash Equivalent',
      [AssetType.MutualFund]: 'Mutual Funds',
      [AssetType.ETF]: 'ETFs',
    }
    return Array.from(byType.entries())
      .map(([assetType, marketValue]) => ({ assetType, label: LABELS[assetType] ?? assetType, marketValue, percentage: (marketValue / totalValue) * 100 }))
      .sort((a, b) => b.marketValue - a.marketValue)
  })

  const portfolioValueSeries = computed<PortfolioValuePoint[]>(() => {
    const allPos = allPositions.value
    if (allPos.length === 0) return []
    const cutoff = cutoffDate(selectedTimeRange.value)
    const byDate = new Map<string, number>()
    for (const p of allPos) {
      const date = p.snapshotAt.slice(0, 10)
      if (date < cutoff) continue
      if (!selectedAccountId.value || p.accountId === selectedAccountId.value) {
        byDate.set(date, (byDate.get(date) ?? 0) + p.marketValue)
      }
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totalValue], idx, arr) => {
        const prevEntry = idx > 0 ? arr[idx - 1] : undefined
        const prevValue = prevEntry?.[1] ?? totalValue
        return { date, totalValue, dayGainLoss: totalValue - prevValue }
      })
  })

  function upsertSnapshots(incoming: Omit<Position, 'id'>[]): void {
    const now = new Date().toISOString()
    const incomingSnapshots = incoming.map((p) => ({ ...p, snapshotAt: p.snapshotAt || now }))
    vaultStore.mutatePayload((p) => {
      const seen = new Set<string>()
      for (const existing of p.positions) seen.add(_snapshotFingerprint(existing))
      const unique: Position[] = []
      for (const snapshot of incomingSnapshots) {
        const fp = _snapshotFingerprint(snapshot)
        if (seen.has(fp)) continue
        seen.add(fp)
        unique.push({ ...snapshot, id: randomUUID() })
      }
      p.positions.push(...unique)
    })
  }

  function pruneOldSnapshots(olderThan: string): number {
    let pruned = 0
    vaultStore.mutatePayload((p) => {
      const before = p.positions.length
      p.positions = p.positions.filter((pos) => pos.snapshotAt >= olderThan)
      pruned = before - p.positions.length
    })
    return pruned
  }

  function selectAccount(id: string | null): void {
    selectedAccountId.value = id
  }
  function selectTimeRange(range: TimeRange): void {
    selectedTimeRange.value = range
  }

  // ════════════════════════════════════════════════════════════════
  // Income
  // ════════════════════════════════════════════════════════════════

  const selectedYear = ref<number>(new Date().getFullYear())

  const allIncome = computed<IncomeRecord[]>(() => vaultStore.payload?.dividends ?? [])

  const incomeForSelectedYear = computed(() => allIncome.value.filter((d) => d.taxYear === selectedYear.value))
  const incomePriorYear = computed(() => allIncome.value.filter((d) => d.taxYear === selectedYear.value - 1))

  const availableYears = computed<number[]>(() => {
    const years = new Set(allIncome.value.map((d) => d.taxYear))
    return Array.from(years).sort((a, b) => b - a)
  })

  const incomeYtdTotals = computed(() => _aggregateIncome(incomeForSelectedYear.value))
  const incomePriorYearTotals = computed(() => _aggregateIncome(incomePriorYear.value))

  const incomeMonthlyGrid = computed<MonthlyIncomeSummary[]>(() => {
    const year = selectedYear.value
    const months: MonthlyIncomeSummary[] = Array.from({ length: 12 }, (_, i) => ({
      yearMonth: `${year}-${String(i + 1).padStart(2, '0')}`,
      totalDividends: 0,
      interest: 0,
      total: 0,
    }))
    for (const record of incomeForSelectedYear.value) {
      const month = parseInt(record.date.slice(5, 7), 10) - 1
      if (month < 0 || month > 11) continue
      const m = months[month]
      if (!m) continue
      if (record.incomeType === TransactionType.Dividend) m.totalDividends += record.amount
      if (record.incomeType === TransactionType.Interest) m.interest += record.amount
      m.total = m.totalDividends + m.interest
    }
    return months
  })

  const incomeBySymbol = computed<SecurityIncomeSummary[]>(() => {
    const currentRecords = incomeForSelectedYear.value.filter((d) => d.symbol)
    const priorRecords = incomePriorYear.value.filter((d) => d.symbol)
    const map = new Map<string, SecurityIncomeSummary>()
    function getOrCreate(symbol: string): SecurityIncomeSummary {
      let entry = map.get(symbol)
      if (!entry) {
        entry = { symbol, description: symbol, ytdTotal: 0, priorYearTotal: 0, dividend: 0, interest: 0 }
        map.set(symbol, entry)
      }
      return entry
    }
    for (const r of currentRecords) {
      const entry = getOrCreate(r.symbol!)
      entry.ytdTotal += r.amount
      if (r.incomeType === TransactionType.Dividend) entry.dividend += r.amount
      if (r.incomeType === TransactionType.Interest) entry.interest += r.amount
    }
    for (const r of priorRecords) {
      const entry = getOrCreate(r.symbol!)
      entry.priorYearTotal += r.amount
    }
    return Array.from(map.values()).sort((a, b) => b.ytdTotal - a.ytdTotal)
  })

  function insertIncome(incoming: Omit<IncomeRecord, 'id'>[]): number {
    const existingTxIds = new Set(allIncome.value.map((d) => d.transactionId))
    const toInsert = incoming.filter((r) => !existingTxIds.has(r.transactionId)).map((r) => ({ ...r, id: randomUUID() }))
    if (toInsert.length === 0) return 0
    vaultStore.mutatePayload((p) => {
      p.dividends.push(...toInsert)
    })
    return toInsert.length
  }

  function setIncomeYear(year: number): void {
    selectedYear.value = year
  }

  // ════════════════════════════════════════════════════════════════
  // Tax Lots
  // ════════════════════════════════════════════════════════════════

  const selectedTaxYear = ref<number>(new Date().getFullYear())
  const showWashSaleOnly = ref(false)

  const allLots = computed<TaxLot[]>(() => vaultStore.payload?.taxLots ?? [])
  const openLots = computed(() => allLots.value.filter((l) => l.isOpen))
  const closedLots = computed<ClosedLot[]>(() => vaultStore.payload?.closedLots ?? [])

  function openLotsForSymbol(symbol: string): TaxLot[] {
    return openLots.value.filter((l) => l.symbol.toUpperCase() === symbol.toUpperCase())
  }

  function openLotsForAccount(accountId: string): TaxLot[] {
    return openLots.value.filter((l) => l.accountId === accountId)
  }

  function getTaxYearSummary(taxYear: number): TaxYearSummary {
    const dividends = vaultStore.payload?.dividends ?? []
    const income = dividends.filter((d) => d.taxYear === taxYear)
    const shortTermGainLoss = 0
    const longTermGainLoss = 0
    const washSaleDisallowedLosses = allLots.value.filter((l) => !l.isOpen && l.isWashSale).reduce((s, l) => s + l.washSaleDisallowedLoss, 0)
    const filteredDividends = income.filter((d) => d.incomeType === TransactionType.Dividend).reduce((s, d) => s + d.amount, 0)
    const interest = income.filter((d) => d.incomeType === TransactionType.Interest).reduce((s, d) => s + d.amount, 0)
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

  const availableTaxYears = computed<number[]>(() => {
    const years = new Set<number>()
    vaultStore.payload?.dividends.forEach((d) => years.add(d.taxYear))
    allLots.value.forEach((l) => {
      if (l.acquiredDate) years.add(new Date(l.acquiredDate).getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  })

  const washSaleLots = computed(() => allLots.value.filter((l) => l.isWashSale))
  const totalWashSaleDisallowed = computed(() => washSaleLots.value.reduce((s, l) => s + l.washSaleDisallowedLoss, 0))

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
      currentValue: input.costBasis,
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

  function refreshLotValues(symbol: string, currentPrice: number): void {
    const today = new Date()
    vaultStore.mutatePayload((p) => {
      for (const lot of p.taxLots) {
        if (lot.symbol.toUpperCase() !== symbol.toUpperCase() || !lot.isOpen) continue
        const currentValue = lot.remainingQuantity * currentPrice
        const unrealizedGainLoss = currentValue - lot.adjustedCostBasis
        const unrealizedGainLossPct = lot.adjustedCostBasis > 0 ? (unrealizedGainLoss / lot.adjustedCostBasis) * 100 : 0
        const daysHeld = Math.floor((today.getTime() - new Date(lot.acquiredDate).getTime()) / (1000 * 60 * 60 * 24))
        lot.currentValue = currentValue
        lot.unrealizedGainLoss = unrealizedGainLoss
        lot.unrealizedGainLossPct = unrealizedGainLossPct
        lot.daysHeld = daysHeld
        lot.isLongTerm = daysHeld >= 366
      }
    })
  }

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
      if (quantitySold > lot.remainingQuantity) throw new Error(`Cannot sell ${quantitySold} from lot with ${lot.remainingQuantity} remaining`)
      const costPerShare = lot.adjustedCostBasis / lot.remainingQuantity
      const costBasisClosed = costPerShare * quantitySold
      const proceeds = salePrice * quantitySold
      const realizedGainLoss = proceeds - costBasisClosed
      const daysHeld = Math.floor((new Date(soldDate).getTime() - new Date(lot.acquiredDate).getTime()) / (1000 * 60 * 60 * 24))
      const termType = daysHeld >= 366 ? TermType.LONG_TERM : TermType.SHORT_TERM
      result = { realizedGainLoss, termType }
      lot.remainingQuantity -= quantitySold
      lot.costBasis -= costBasisClosed
      lot.adjustedCostBasis -= costBasisClosed
      if (lot.remainingQuantity === 0) {
        lot.isOpen = false
        p.closedLots.push({
          id: randomUUID(),
          accountId: lot.accountId,
          symbol: lot.symbol,
          openingLotId: lot.id,
          openingTransactionId: lot.openingTransactionId,
          closingTransactionId: _closingTransactionId,
          acquiredDate: lot.acquiredDate,
          soldDate,
          quantity: quantitySold,
          costBasis: costBasisClosed,
          proceeds,
          realizedGainLoss,
          termType,
          taxYear: new Date(soldDate).getFullYear(),
          isWashSale: lot.isWashSale,
          washSaleDisallowedLoss: lot.washSaleDisallowedLoss,
        })
      }
    })
    return result
  }

  function markWashSale(lotId: string, disallowedLoss: number): void {
    vaultStore.mutatePayload((p) => {
      const lot = p.taxLots.find((l) => l.id === lotId)
      if (!lot) throw new Error(`Lot ${lotId} not found`)
      lot.isWashSale = true
      lot.washSaleDisallowedLoss = disallowedLoss
      lot.adjustedCostBasis = lot.costBasis + disallowedLoss
    })
  }

  function selectLotsForSale(accountId: string, symbol: string, method: CostBasisMethod, quantityNeeded: number): TaxLot[] {
    const candidates = openLots.value.filter((l) => l.accountId === accountId && l.symbol === symbol)
    switch (method) {
      case CostBasisMethod.FIFO:
        candidates.sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate))
        break
      case CostBasisMethod.LIFO:
        candidates.sort((a, b) => b.acquiredDate.localeCompare(a.acquiredDate))
        break
      case CostBasisMethod.SpecificLot:
        candidates.sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate))
        break
      case CostBasisMethod.AverageCost:
        break
    }
    const selected: TaxLot[] = []
    let remaining = quantityNeeded
    for (const lot of candidates) {
      if (remaining <= 0) break
      selected.push(lot)
      remaining -= lot.remainingQuantity
    }
    return selected
  }

  function setSelectedTaxYear(year: number): void {
    selectedTaxYear.value = year
  }
  function toggleWashSaleFilter(): void {
    showWashSaleOnly.value = !showWashSaleOnly.value
  }

  // ════════════════════════════════════════════════════════════════
  // Return
  // ════════════════════════════════════════════════════════════════

  return {
    // Accounts
    allAccounts,
    getAccountById,
    addAccount,
    updateAccount,
    updateBalance,
    reorderAccounts,
    // Transactions
    allTransactions,
    sortedTransactions,
    filteredTransactions,
    txFilters,
    trades,
    dividendTransactions,
    interestTransactions,
    transfers,
    manualTransactions,
    transactionsForAccount,
    transactionsForSymbol,
    isDuplicate,
    isCsvDuplicate,
    insertMany,
    addManual,
    updateTransaction,
    deleteTransaction,
    setTxFilters,
    resetTxFilters,
    // Positions
    allPositions,
    latestPositions,
    visiblePositions,
    selectedAccountId,
    selectedTimeRange,
    portfolioSummary,
    allocation,
    portfolioValueSeries,
    positionsForAccount,
    upsertSnapshots,
    pruneOldSnapshots,
    selectAccount,
    selectTimeRange,
    // Income
    allIncome,
    incomeForSelectedYear,
    incomePriorYear,
    availableYears,
    selectedYear,
    incomeYtdTotals,
    incomePriorYearTotals,
    incomeMonthlyGrid,
    incomeBySymbol,
    insertIncome,
    setIncomeYear,
    // Tax Lots
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

// ── Helpers ────────────────────────────────────────────────────

export function cutoffDate(range: TimeRange): string {
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

function _snapshotFingerprint(position: Omit<Position, 'id'> | Position): string {
  return [
    position.accountId,
    position.symbol,
    position.assetType,
    position.quantity,
    position.avgCost,
    position.currentPrice,
    position.marketValue,
    position.unrealizedGainLoss,
    position.unrealizedGainLossPct,
    position.dayGainLoss,
    position.dayGainLossPct,
    position.costBasisMethod,
    position.snapshotAt,
  ].join('|')
}

function _aggregateIncome(records: IncomeRecord[]) {
  return records.reduce(
    (acc, r) => {
      acc.total += r.amount
      if (r.incomeType === TransactionType.Dividend) acc.dividend += r.amount
      if (r.incomeType === TransactionType.Interest) acc.interest += r.amount
      return acc
    },
    { total: 0, dividend: 0, interest: 0 },
  )
}
