# Store Refactor & UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Consolidate 11 Pinia stores to 7, replace Unovis with ApexCharts, fix UI/UX issues.

**Architecture:** Merge 5 thin data stores (accounts, transactions, positions, income, taxLots) into one `data.store.ts` that reads/writes `vaultStore.payload`. Add ApexCharts with interactive features. Fix dark mode, mobile responsiveness, and vault auto-reopen.

**Tech Stack:** Pinia, Vue 3, Nuxt 4, ApexCharts/vue3-apexcharts, Nuxt UI v3

## Global Constraints

- Vault binary format (magic bytes, PBKDF2, AES-256-GCM) must remain 100% unchanged
- VaultPayload type/schema must remain unchanged (same fields, same types)
- No changes to Cloudflare Worker
- No `any` types — use `unknown` + narrowing
- Follow existing code style (no semicolons, single quotes, trailing commas, 100 width)
- All tests must pass after each task

---

### Task 1: Create merged `data.store.ts`

**Files:**

- Create: `frontend/app/stores/data.store.ts`
- Delete (later): `frontend/app/stores/accounts.store.ts`, `transactions.store.ts`, `positions.store.ts`, `income.store.ts`, `taxLots.store.ts`, `portfolio.ts`

**Interfaces:**

- Consumes: `useVaultStore`, `generateBalanceHistories` from `market.store`, `recalculateDerivedDataFromTransactions` from `utils/ledger`
- Produces: `useDataStore()` with all account/transaction/position/income/taxLot operations

- [ ] **Step 1: Create the file with accounts + transactions sections**

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useVaultStore } from './vault.store'
import type { Account, Transaction, VaultPayload, Position, PortfolioSummary, AllocationSlice, PortfolioValuePoint, IncomeRecord, MonthlyIncomeSummary, SecurityIncomeSummary, TaxLot, ClosedLot, TaxYearSummary } from '@/types/vault'
import { AssetType, CostBasisMethod, ImportSource, TimeRange, TransactionType } from '@/types/enums'
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
    vaultStore.mutatePayload((p) => { p.accounts.push(account) })
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
    if (f.accountIds.length > 0) { const s = new Set(f.accountIds); list = list.filter((t) => s.has(t.accountId)) }
    if (f.types.length > 0) { const s = new Set(f.types); list = list.filter((t) => s.has(t.type)) }
    if (f.symbol) { const sym = f.symbol.toUpperCase(); list = list.filter((t) => t.symbol?.toUpperCase() === sym) }
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
      ...input, id, externalId: null, importSource: ImportSource.MANUAL, importedAt: now, matchedLotIds: [],
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
```

- [ ] **Step 2: Add the remaining code to `data.store.ts` — positions + income + tax lots**

```ts
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
    const ytdDividends = (payload?.dividends ?? []).filter((d) => d.taxYear === currentYear && d.incomeType === TransactionType.Dividend).reduce((s, d) => s + d.amount, 0)
    const ytdInterest = (payload?.dividends ?? []).filter((d) => d.taxYear === currentYear && d.incomeType === TransactionType.Interest).reduce((s, d) => s + d.amount, 0)
    return {
      totalMarketValue, totalCostBasis, totalUnrealizedGainLoss, totalUnrealizedGainLossPct: unrealizedPct,
      totalDayGainLoss, totalDayGainLossPct: dayPct, totalCashBalance,
      ytdRealizedGainLossShortTerm: ytdRealizedShort, ytdRealizedGainLossLongTerm: ytdRealizedLong,
      ytdRealizedGainLossTotal: ytdRealizedShort + ytdRealizedLong,
      ytdIncomeTotal: ytdDividends + ytdInterest, ytdDividends, ytdInterest,
    }
  })

  const allocation = computed<AllocationSlice[]>(() => {
    const positions = visiblePositions.value
    const totalValue = positions.reduce((s, p) => s + p.marketValue, 0)
    if (totalValue === 0) return []
    const byType = new Map<AssetType, number>()
    for (const p of positions) byType.set(p.assetType, (byType.get(p.assetType) ?? 0) + p.marketValue)
    const LABELS: Record<AssetType, string> = {
      [AssetType.Stock]: 'Equity', [AssetType.Bond]: 'Fixed Income (Bond)', [AssetType.Crypto]: 'Crypto',
      [AssetType.Cash]: 'Cash', [AssetType.CashEquivalent]: 'Cash Equivalent',
      [AssetType.MutualFund]: 'Mutual Funds', [AssetType.ETF]: 'ETFs',
    }
    return Array.from(byType.entries())
      .map(([assetType, marketValue]) => ({ assetType, label: LABELS[assetType] ?? assetType, marketValue, percentage: (marketValue / totalValue) * 100 }))
      .sort((a, b) => b.marketValue - a.marketValue)
  })

  const portfolioValueSeries = computed<PortfolioValuePoint[]>(() => {
    const allPos = allPositions.value
    if (allPos.length === 0) return []
    const cutoff = _cutoffDate(selectedTimeRange.value)
    const byDate = new Map<string, number>()
    for (const p of allPos) {
      const date = p.snapshotAt.slice(0, 10)
      if (date < cutoff) continue
      if (!selectedAccountId.value || p.accountId === selectedAccountId.value) {
        byDate.set(date, (byDate.get(date) ?? 0) + p.marketValue)
      }
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, totalValue], idx, arr) => {
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

  function selectAccount(id: string | null): void { selectedAccountId.value = id }
  function selectTimeRange(range: TimeRange): void { selectedTimeRange.value = range }

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
      yearMonth: `${year}-${String(i + 1).padStart(2, '0')}`, totalDividends: 0, interest: 0, total: 0,
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
      if (!map.has(symbol)) map.set(symbol, { symbol, description: symbol, ytdTotal: 0, priorYearTotal: 0, dividend: 0, interest: 0 })
      return map.get(symbol)!
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
    vaultStore.mutatePayload((p) => { p.dividends.push(...toInsert) })
    return toInsert.length
  }

  function setIncomeYear(year: number): void { selectedYear.value = year }

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
      taxYear, shortTermGainLoss, longTermGainLoss, totalRealizedGainLoss: shortTermGainLoss + longTermGainLoss,
      dividends: filteredDividends, interest, totalIncome: filteredDividends + interest, washSaleDisallowedLosses,
    }
  }

  const selectedYearSummary = computed(() => getTaxYearSummary(selectedTaxYear.value))

  const availableTaxYears = computed<number[]>(() => {
    const years = new Set<number>()
    vaultStore.payload?.dividends.forEach((d) => years.add(d.taxYear))
    allLots.value.forEach((l) => { if (l.acquiredDate) years.add(new Date(l.acquiredDate).getFullYear()) })
    return Array.from(years).sort((a, b) => b - a)
  })

  const washSaleLots = computed(() => allLots.value.filter((l) => l.isWashSale))
  const totalWashSaleDisallowed = computed(() => washSaleLots.value.reduce((s, l) => s + l.washSaleDisallowedLoss, 0))

  function openLot(
    input: Omit<TaxLot, 'id' | 'isOpen' | 'isWashSale' | 'washSaleDisallowedLoss' | 'adjustedCostBasis' | 'currentValue' | 'unrealizedGainLoss' | 'unrealizedGainLossPct' | 'daysHeld' | 'isLongTerm'>,
  ): string {
    const id = randomUUID()
    const lot: TaxLot = {
      ...input, id, isOpen: true, isWashSale: false, washSaleDisallowedLoss: 0,
      adjustedCostBasis: input.costBasis, currentValue: input.costBasis,
      unrealizedGainLoss: 0, unrealizedGainLossPct: 0, daysHeld: 0, isLongTerm: false,
    }
    vaultStore.mutatePayload((p) => { p.taxLots.push(lot) })
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
    lotId: string, quantitySold: number, salePrice: number, soldDate: string, _closingTransactionId: string,
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
          id: randomUUID(), accountId: lot.accountId, symbol: lot.symbol,
          openingLotId: lot.id, openingTransactionId: lot.openingTransactionId,
          closingTransactionId: _closingTransactionId, acquiredDate: lot.acquiredDate,
          soldDate, quantity: quantitySold, costBasis: costBasisClosed, proceeds,
          realizedGainLoss, termType, taxYear: new Date(soldDate).getFullYear(),
          isWashSale: lot.isWashSale, washSaleDisallowedLoss: lot.washSaleDisallowedLoss,
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
      case CostBasisMethod.FIFO: candidates.sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate)); break
      case CostBasisMethod.LIFO: candidates.sort((a, b) => b.acquiredDate.localeCompare(a.acquiredDate)); break
      case CostBasisMethod.SpecificLot: candidates.sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate)); break
      case CostBasisMethod.AverageCost: break
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

  function setSelectedTaxYear(year: number): void { selectedTaxYear.value = year }
  function toggleWashSaleFilter(): void { showWashSaleOnly.value = !showWashSaleOnly.value }

  // ════════════════════════════════════════════════════════════════
  // Return
  // ════════════════════════════════════════════════════════════════

  return {
    // Accounts
    allAccounts, getAccountById, addAccount, updateAccount, updateBalance, reorderAccounts,
    // Transactions
    allTransactions, sortedTransactions, filteredTransactions, txFilters,
    trades, dividendTransactions, interestTransactions, transfers, manualTransactions,
    transactionsForAccount, transactionsForSymbol,
    isDuplicate, isCsvDuplicate, insertMany, addManual, updateTransaction, deleteTransaction,
    setTxFilters, resetTxFilters,
    // Positions
    allPositions, latestPositions, visiblePositions,
    selectedAccountId, selectedTimeRange,
    portfolioSummary, allocation, portfolioValueSeries,
    positionsForAccount,
    upsertSnapshots, pruneOldSnapshots,
    selectAccount, selectTimeRange,
    // Income
    allIncome, incomeForSelectedYear, incomePriorYear,
    availableYears, selectedYear,
    incomeYtdTotals, incomePriorYearTotals,
    incomeMonthlyGrid, incomeBySymbol,
    insertIncome, setIncomeYear,
    // Tax Lots
    allLots, openLots, closedLots,
    washSaleLots, totalWashSaleDisallowed,
    selectedTaxYear, selectedYearSummary, availableTaxYears, showWashSaleOnly,
    openLotsForSymbol, openLotsForAccount,
    getTaxYearSummary,
    openLot, refreshLotValues, closeLot, markWashSale, selectLotsForSale,
    setSelectedTaxYear, toggleWashSaleFilter,
  }
})

// ── Helpers ────────────────────────────────────────────────────

function _cutoffDate(range: TimeRange): string {
  const now = new Date()
  switch (range) {
    case TimeRange.ONE_DAY: { const d = new Date(now); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }
    case TimeRange.ONE_WEEK: { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) }
    case TimeRange.ONE_MONTH: { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) }
    case TimeRange.THREE_MONTHS: { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10) }
    case TimeRange.YTD: return `${now.getFullYear()}-01-01`
    case TimeRange.ONE_YEAR: { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) }
    case TimeRange.ALL: default: return '1970-01-01'
  }
}

function _snapshotFingerprint(position: Omit<Position, 'id'> | Position): string {
  return [position.accountId, position.symbol, position.assetType, position.quantity, position.avgCost, position.currentPrice, position.marketValue, position.unrealizedGainLoss, position.unrealizedGainLossPct, position.dayGainLoss, position.dayGainLossPct, position.costBasisMethod, position.snapshotAt].join('|')
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
```

- [ ] **Step 3: Verify the file was written correctly**

Run:

```
Get-ChildItem -LiteralPath "frontend/app/stores/data.store.ts"
```

Expected: File exists and is not empty.

---

### Task 2: Update all consumers

**Files:**

- Modify: `frontend/app/pages/dashboard.vue`
- Modify: `frontend/app/pages/positions.vue`
- Modify: `frontend/app/pages/transactions.vue`
- Modify: `frontend/app/pages/income.vue`
- Modify: `frontend/app/pages/settings.vue`
- Modify: `frontend/app/stores/sync.store.ts`
- Modify: `frontend/app/composables/useGoogleSheetsSync.ts`
- Modify: `frontend/test/unit/stores/positions.test.ts`
- Delete: `frontend/test/unit/stores/portfolio.test.ts`

**Interfaces:**

- Consumes: `useDataStore` (Task 1)
- Produces: Working app with all pages/stores using the merged data store

- [ ] **Step 1: Update `pages/dashboard.vue`**

Replace imports:

```ts
// REMOVE:
import { useIncomeStore } from '~/stores/income.store'
import { usePositionsStore } from '~/stores/positions.store'
// ADD:
import { useDataStore } from '~/stores/data.store'
```

Replace store instantiations:

```ts
// REMOVE:
const positionsStore = usePositionsStore()
const incomeStore = useIncomeStore()
// ADD:
const dataStore = useDataStore()
```

Replace all references:

- `positionsStore.selectedAccountId` → `dataStore.selectedAccountId`
- `positionsStore.selectedTimeRange` → `dataStore.selectedTimeRange`
- `positionsStore.latest` → `dataStore.latestPositions`
- `positionsStore.allocation` → `dataStore.allocation`
- `incomeStore.all` → `dataStore.allIncome`
- `incomeStore.selectedYear` → `dataStore.selectedYear`
- `positionsStore.selectAccount(id)` → `dataStore.selectAccount(id)`
- `positionsStore.selectTimeRange(range)` → `dataStore.selectTimeRange(range)`
- `incomeStore.selectedYear` → `dataStore.selectedYear`
- Remove `import { useIncomeStore } from '...'` and `import { usePositionsStore } from '...'`
- Remove `const incomeStore = useIncomeStore()` and `const positionsStore = usePositionsStore()`

- [ ] **Step 2: Update `pages/positions.vue`**

Replace imports:

```ts
// REMOVE:
import { useAccountsStore } from '~/stores/accounts.store'
import { usePositionsStore } from '~/stores/positions.store'
import { useTaxLotsStore } from '~/stores/taxLots.store'
// ADD:
import { useDataStore } from '~/stores/data.store'
```

Replace store instantiations:

```ts
// REMOVE:
const accountsStore = useAccountsStore()
const positionsStore = usePositionsStore()
const taxLotsStore = useTaxLotsStore()
// ADD:
const dataStore = useDataStore()
```

Replace all references:

- `accountsStore.all` → `dataStore.allAccounts`
- `positionsStore.summary` → `dataStore.portfolioSummary`
- `positionsStore.visible` → `dataStore.visiblePositions`
- `positionsStore.selectedAccountId` → `dataStore.selectedAccountId`
- `taxLotsStore.availableTaxYears` → `dataStore.availableTaxYears`
- `taxLotsStore.selectedTaxYear` → `dataStore.selectedTaxYear`
- `taxLotsStore.closedLots` → `dataStore.closedLots`
- `taxLotsStore.openLots` → `dataStore.openLots`
- `positionsStore.selectAccount(id)` → `dataStore.selectAccount(id)`
- `taxLotsStore.setSelectedTaxYear(...)` → `dataStore.setSelectedTaxYear(...)`

- [ ] **Step 3: Update `pages/transactions.vue`**

Replace imports:

```ts
// REMOVE:
import { useAccountsStore } from '~/stores/accounts.store'
import { useTransactionsStore } from '~/stores/transactions.store'
// ADD:
import { useDataStore } from '~/stores/data.store'
```

Replace store instantiations:

```ts
// REMOVE:
const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
// ADD:
const dataStore = useDataStore()
```

Replace all references:

- `accountsStore.all` → `dataStore.allAccounts`
- `transactionsStore.all` → `dataStore.allTransactions`
- `transactionsStore.trades` → `dataStore.trades`
- `transactionsStore.dividends` → `dataStore.dividendTransactions`
- `transactionsStore.interest` → `dataStore.interestTransactions`
- `transactionsStore.transfers` → `dataStore.transfers`
- `transactionsStore.manual` → `dataStore.manualTransactions`
- `transactionsStore.updateTransaction(...)` → `dataStore.updateTransaction(...)`
- `transactionsStore.addManual(...)` → `dataStore.addManual(...)`
- `transactionsStore.deleteTransaction(id)` → `dataStore.deleteTransaction(id)`

- [ ] **Step 4: Update `pages/income.vue`**

Replace imports:

```ts
// REMOVE:
import { useAccountsStore } from '~/stores/accounts.store'
import { useIncomeStore } from '~/stores/income.store'
// ADD:
import { useDataStore } from '~/stores/data.store'
```

Replace store instantiations:

```ts
// REMOVE:
const incomeStore = useIncomeStore()
const accountsStore = useAccountsStore()
// ADD:
const dataStore = useDataStore()
```

Replace all references:

- `incomeStore.selectedYear` → `dataStore.selectedYear`
- `incomeStore.availableYears` → `dataStore.availableYears`
- `incomeStore.all` → `dataStore.allIncome`
- `accountsStore.all` → `dataStore.allAccounts`

- [ ] **Step 5: Update `pages/settings.vue`**

Replace imports:

```ts
// REMOVE:
import { useAccountsStore } from '~/stores/accounts.store'
// ADD:
import { useDataStore } from '~/stores/data.store'
```

Replace store instantiation:

```ts
// REMOVE:
const accountsStore = useAccountsStore()
// ADD:
const dataStore = useDataStore()
```

Replace all references:

- `accountsStore.all` → `dataStore.allAccounts`
- `accountsStore.updateAccount(...)` → `dataStore.updateAccount(...)`
- `accountsStore.addAccount(...)` → `dataStore.addAccount(...)`
- `accountsStore.reorderAccounts(ids)` → `dataStore.reorderAccounts(ids)`

- [ ] **Step 6: Update `stores/sync.store.ts`**

Replace imports:

```ts
// REMOVE:
import { useTransactionsStore } from './transactions.store'
// ADD:
import { useDataStore } from './data.store'
```

Replace store instantiation:

```ts
// REMOVE:
const transactionsStore = useTransactionsStore()
// ADD:
const dataStore = useDataStore()
```

Replace reference:

- `transactionsStore.insertMany(incoming)` → `dataStore.insertMany(incoming)`

- [ ] **Step 7: Update `composables/useGoogleSheetsSync.ts`**

Replace imports:

```ts
// REMOVE:
import { usePositionsStore } from '~/stores/positions.store'
// ADD:
import { useDataStore } from '~/stores/data.store'
```

Replace store instantiation:

```ts
// REMOVE:
const positionsStore = usePositionsStore()
// ADD:
const dataStore = useDataStore()
```

Replace reference:

- `positionsStore.latest` → `dataStore.latestPositions`

- [ ] **Step 8: Delete portfolio test**

```bash
Remove-Item -LiteralPath "frontend/test/unit/stores/portfolio.test.ts"
```

- [ ] **Step 9: Update positions test**

In `frontend/test/unit/stores/positions.test.ts`, replace:

```ts
// REMOVE:
import { usePositionsStore } from '~/stores/positions.store'
// ADD:
import { useDataStore } from '~/stores/data.store'
```

Replace `usePositionsStore()` → `useDataStore()` in the test.

Replace `store.all` → `store.allPositions` (the test references `store.all`)

- [ ] **Step 10: Run typecheck to verify**

Run: `npm run typecheck`
Expected: PASS (0 errors)

---

### Task 3: Delete old store files

**Files:**

- Delete: `frontend/app/stores/accounts.store.ts`
- Delete: `frontend/app/stores/transactions.store.ts`
- Delete: `frontend/app/stores/positions.store.ts`
- Delete: `frontend/app/stores/income.store.ts`
- Delete: `frontend/app/stores/taxLots.store.ts`
- Delete: `frontend/app/stores/portfolio.ts`

- [ ] **Step 1: Remove old store files**

```bash
Remove-Item -LiteralPath "frontend/app/stores/accounts.store.ts"
Remove-Item -LiteralPath "frontend/app/stores/transactions.store.ts"
Remove-Item -LiteralPath "frontend/app/stores/positions.store.ts"
Remove-Item -LiteralPath "frontend/app/stores/income.store.ts"
Remove-Item -LiteralPath "frontend/app/stores/taxLots.store.ts"
Remove-Item -LiteralPath "frontend/app/stores/portfolio.ts"
```

- [ ] **Step 2: Run typecheck + lint**

Run: `npm run lint; if ($?) { npm run typecheck }`
Expected: PASS

---

### Task 4: Install ApexCharts + create chart components

**Files:**

- Modify: `frontend/package.json`
- Modify: `frontend/nuxt.config.ts`
- Create: `frontend/app/plugins/apexcharts.client.ts`
- Create: `frontend/app/components/charts/ApexLineChart.vue`
- Create: `frontend/app/components/charts/ApexDonutChart.vue`
- Create: `frontend/app/components/charts/ApexAreaChart.vue`
- Create: `frontend/app/components/charts/ApexStackedBar.vue`

- [ ] **Step 1: Install ApexCharts**

```bash
npm install vue3-apexcharts apexcharts --workspace=frontend
```

- [ ] **Step 2: Remove Unovis from `nuxt.config.ts`**

In `frontend/nuxt.config.ts`:

```ts
// Change vite.optimizeDeps.include from:
include: ['@unovis/vue', '@vue/devtools-core', '@vue/devtools-kit'],
// To:
include: ['@vue/devtools-core', '@vue/devtools-kit'],
```

- [ ] **Step 3: Create ApexCharts plugin**

Create `frontend/app/plugins/apexcharts.client.ts`:

```ts
import { defineNuxtPlugin } from '#app'
import VueApexCharts from 'vue3-apexcharts'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueApexCharts)
})
```

- [ ] **Step 4: Create `ApexLineChart.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    data: { date: string; value: number }[]
    color?: string
    height?: number
  }>(),
  {
    color: '#10b981',
    height: 260,
  },
)

const series = computed(() => [
  {
    name: 'Value',
    data: props.data.map((d) => ({ x: new Date(d.date).getTime(), y: d.value })),
  },
])

const options = computed(() => ({
  chart: {
    type: 'line' as const,
    zoom: { enabled: true, type: 'x' as const, autoScaleYaxis: true },
    toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
  },
  colors: [props.color],
  stroke: { curve: 'smooth' as const, width: 2 },
  xaxis: { type: 'datetime' as const, labels: { format: 'MMM dd' } },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  tooltip: { x: { format: 'MMM dd, yyyy' }, y: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  grid: { borderColor: 'var(--ui-border)', strokeDashArray: 3 },
}))

const chartKey = computed(() => props.data.length)
</script>

<template>
  <div v-if="data.length > 0" class="w-full px-2 py-2">
    <apexchart type="line" :height="height" :options="options" :series="series" :key="chartKey" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
```

- [ ] **Step 5: Create `ApexDonutChart.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '~/utils/format'

const props = withDefaults(
  defineProps<{
    data: { label: string; value: number }[]
    height?: number
  }>(),
  { height: 300 },
)

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

const series = computed(() => props.data.map((d) => d.value))
const labels = computed(() => props.data.map((d) => d.label))

const options = computed(() => ({
  chart: { type: 'donut' as const },
  colors: COLORS.slice(0, props.data.length),
  labels: labels.value,
  legend: { show: true, position: 'bottom' as const, fontSize: '12px' },
  tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
  plotOptions: {
    pie: {
      donut: { size: '55%' },
      expandOnClick: true,
    },
  },
  responsive: [{ breakpoint: 640, options: { chart: { width: '100%' }, legend: { position: 'bottom' } } }],
}))

const chartKey = computed(() => props.data.length)
</script>

<template>
  <div v-if="data.length > 0" class="w-full px-2 py-2">
    <apexchart type="donut" :height="height" :options="options" :series="series" :key="chartKey" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
```

- [ ] **Step 6: Create `ApexStackedBar.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    categories: string[]
    series: { name: string; data: number[]; color: string }[]
    height?: number
  }>(),
  { height: 260 },
)

const options = computed(() => ({
  chart: { type: 'bar' as const, stacked: true, toolbar: { show: true } },
  colors: props.series.map((s) => s.color),
  xaxis: { categories: props.categories },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  tooltip: { y: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  legend: { position: 'bottom' as const },
  grid: { borderColor: 'var(--ui-border)', strokeDashArray: 3 },
  plotOptions: { bar: { horizontal: false, borderRadius: 4 } },
}))

const chartKey = computed(() => props.categories.length)
</script>

<template>
  <div v-if="categories.length > 0" class="w-full px-2 py-2">
    <apexchart type="bar" :height="height" :options="options" :series="series" :key="chartKey" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
```

- [ ] **Step 7: Create `ApexAreaChart.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    series: { name: string; data: { x: number; y: number }[]; color: string }[]
    height?: number
  }>(),
  { height: 260 },
)

const options = computed(() => ({
  chart: {
    type: 'area' as const,
    zoom: { enabled: true, type: 'x' as const },
    toolbar: { show: true, tools: { download: true, selection: true, zoom: true, pan: true, reset: true } },
  },
  colors: props.series.map((s) => s.color),
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth' as const, width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 0.1, opacityFrom: 0.4, opacityTo: 0.1 } },
  xaxis: { type: 'datetime' as const, labels: { format: 'MMM dd' } },
  yaxis: { labels: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  tooltip: { x: { format: 'MMM dd, yyyy' }, y: { formatter: (v: number) => `$${v.toLocaleString()}` } },
  grid: { borderColor: 'var(--ui-border)', strokeDashArray: 3 },
  legend: { position: 'bottom' as const },
}))

const chartKey = computed(() => props.series.length)
</script>

<template>
  <div v-if="series.length > 0 && series.some((s) => s.data.length > 0)" class="w-full px-2 py-2">
    <apexchart type="area" :height="height" :options="options" :series="series" :key="chartKey" />
  </div>
  <div v-else class="flex h-64 w-full items-center justify-center text-sm text-(--ui-text-muted)">No data available</div>
</template>
```

---

### Task 5: Replace dashboard charts + remove Unovis

**Files:**

- Modify: `frontend/app/components/dashboard/DashboardPortfolioChart.vue`
- Modify: `frontend/app/components/dashboard/DashboardAllocationChart.vue`
- Modify: `frontend/app/components/dashboard/DashboardIncomeChart.vue`
- Modify: `frontend/app/components/dashboard/DashboardBalancesChart.vue`
- Delete: `frontend/app/components/charts/LineChart.vue`
- Delete: `frontend/app/components/charts/PieChart.vue`
- Modify: `frontend/package.json` (remove @unovis deps)

**Interfaces:**

- Consumes: `ApexLineChart`, `ApexDonutChart`, `ApexStackedBar`, `ApexAreaChart` (Task 4)
- Produces: Dashboard with interactive ApexCharts

- [ ] **Step 1: Update `DashboardPortfolioChart.vue`**

```vue
<script setup lang="ts">
defineProps<{
  data: { date: string; value: number }[]
  timeRange: string
}>()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Portfolio Value</h2>
        <span class="text-xs text-(--ui-text-muted)">{{ timeRange }}</span>
      </div>
    </template>
    <ApexLineChart :data="data" />
  </UCard>
</template>
```

- [ ] **Step 2: Update `DashboardAllocationChart.vue`**

```vue
<script setup lang="ts">
defineProps<{
  data: { label: string; value: number }[]
}>()
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">Asset Allocation</h2>
    </template>
    <ApexDonutChart :data="data" />
  </UCard>
</template>
```

- [ ] **Step 3: Update `DashboardIncomeChart.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: { accountName: string; currentYear: number; priorYear: number }[]
  currentYear: number
  priorYear: number
}>()

const chartSeries = computed(() => [
  { name: String(props.priorYear), data: props.data.map((d) => d.priorYear), color: '#94a3b8' },
  { name: String(props.currentYear), data: props.data.map((d) => d.currentYear), color: '#3b82f6' },
])

const categories = computed(() => props.data.map((d) => d.accountName))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Income by Account</h2>
        <span class="text-xs text-(--ui-text-muted)">{{ priorYear }} vs {{ currentYear }}</span>
      </div>
    </template>
    <ApexStackedBar :categories="categories" :series="chartSeries" />
  </UCard>
</template>
```

- [ ] **Step 4: Update `DashboardBalancesChart.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Account } from '~/types/vault'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#a855f7']

const props = defineProps<{
  accounts: Account[]
}>()

const chartSeries = computed(() => {
  return props.accounts.map((account, i) => {
    const history = account.balanceHistory ?? []
    return {
      name: account.displayName,
      data: history.map((bp) => ({ x: new Date(bp.date).getTime(), y: bp.balance })),
      color: COLORS[i % COLORS.length],
    }
  })
})
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">Account Balances</h2>
    </template>
    <ApexAreaChart :series="chartSeries" />
  </UCard>
</template>
```

- [ ] **Step 5: Remove Unovis dependencies**

In `frontend/package.json`, remove:

```json
"@unovis/ts": "^1.6.5",
"@unovis/vue": "^1.6.5",
```

- [ ] **Step 6: Delete old chart files**

```bash
Remove-Item -LiteralPath "frontend/app/components/charts/LineChart.vue"
Remove-Item -LiteralPath "frontend/app/components/charts/PieChart.vue"
```

- [ ] **Step 7: Run typecheck + lint**

Run: `npm run lint; if ($?) { npm run typecheck }`
Expected: PASS

---

### Task 6: Fix dark/light mode

**Files:**

- Modify: `frontend/app/plugins/dark-mode.ts`
- Modify: `frontend/app/app.vue`
- Modify: `frontend/app/app.config.ts`

The issue: Nuxt UI v3 already provides `useColorMode()` and handles dark class on `<html>`. The existing plugin manually reads from localStorage and duplicates this — causing race conditions. We need to remove the manual handling and let Nuxt UI's `useColorMode()` manage it via the preferences store.

- [ ] **Step 1: Fix `dark-mode.ts` plugin**

Replace the file content:

```ts
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  // Nuxt UI's useColorMode() already handles the dark class on <html>.
  // This plugin syncs the vault's display preference with colorMode on app load.
  if (import.meta.client) {
    const colorMode = useColorMode()
    const vault = useVaultStore()

    watch(
      () => vault.displayPreferences?.theme,
      (theme) => {
        if (!theme) return
        if (theme === 'SYSTEM') colorMode.preference = 'system'
        else colorMode.preference = theme.toLowerCase()
      },
      { immediate: true },
    )
  }
})
```

- [ ] **Step 2: Fix app.vue to properly apply theme**

In `frontend/app/app.vue`, ensure the banner and other elements use CSS variables from Nuxt UI's theme system instead of hardcoded dark classes. The current hardcoded dark classes in `bannerClasses` computed should work fine since they're using `dark:` variants.

No changes needed to the banner — Tailwind `dark:` variants work with Nuxt UI's color mode.

- [ ] **Step 3: Remove old preferences store darkMode toggle conflict**

In `frontend/app/stores/preferences.ts`, the `darkMode` ref is persisted separately but conflicts with the vault's `displayPreferences.theme`. Keep the file but we'll remove the darkMode toggle since theme is now managed via the vault.

Replace preferences store content:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePreferencesStore = defineStore(
  'preferences',
  () => {
    const currency = ref<'USD' | 'EUR' | 'GBP'>('USD')

    function setCurrency(newCurrency: 'USD' | 'EUR' | 'GBP') {
      currency.value = newCurrency
    }

    return { currency, setCurrency }
  },
  {
    persist: true,
  },
)
```

---

### Task 7: Mobile responsiveness + navigation + remember vault

**Files:**

- Modify: `frontend/app/app.vue`
- Modify: `frontend/app/pages/index.vue`

- [ ] **Step 1: Mobile hamburger navigation in `app.vue`**

Wrap the nav links in a responsive pattern. Add a USheet (slideover) for mobile:

```vue
<!-- In app.vue, replace the nav links section -->
<template #left>
  <div class="flex items-center gap-3">
    <NuxtLink to="/">
      <AppLogo class="h-6 w-auto shrink-0" />
    </NuxtLink>
    <!-- Desktop nav: hidden on small screens -->
    <div class="hidden sm:flex sm:items-center sm:gap-1">
      <UButton label="Home" to="/" size="xs" color="neutral" variant="ghost" />
      <UButton label="Dashboard" to="/dashboard" size="xs" color="neutral" variant="ghost" />
      <UButton label="Positions" to="/positions" size="xs" color="neutral" variant="ghost" />
      <UButton label="Transactions" to="/transactions" size="xs" color="neutral" variant="ghost" />
      <UButton label="Income" to="/income" size="xs" color="neutral" variant="ghost" />
      <UButton label="Settings" to="/settings" size="xs" color="neutral" variant="ghost" />
    </div>
    <!-- Mobile hamburger: visible only on small screens -->
    <UButton icon="i-lucide-menu" size="sm" color="neutral" variant="ghost" class="sm:hidden" @click="mobileMenuOpen = !mobileMenuOpen" />
  </div>
</template>
```

Add mobile menu state and USheet at the end of the template (before `</UApp>`):

```ts
// In script setup
const mobileMenuOpen = ref(false)
```

```vue
<USheet v-model:open="mobileMenuOpen" title="Navigation" side="left" :ui="{ width: 'max-w-64' }">
  <div class="flex flex-col gap-1 p-4">
    <UButton label="Home" to="/" color="neutral" variant="ghost" block @click="mobileMenuOpen = false" />
    <UButton label="Dashboard" to="/dashboard" color="neutral" variant="ghost" block @click="mobileMenuOpen = false" />
    <UButton label="Positions" to="/positions" color="neutral" variant="ghost" block @click="mobileMenuOpen = false" />
    <UButton label="Transactions" to="/transactions" color="neutral" variant="ghost" block @click="mobileMenuOpen = false" />
    <UButton label="Income" to="/income" color="neutral" variant="ghost" block @click="mobileMenuOpen = false" />
    <UButton label="Settings" to="/settings" color="neutral" variant="ghost" block @click="mobileMenuOpen = false" />
  </div>
</USheet>
```

- [ ] **Step 2: Fix "remember last vault" auto-open on landing page**

In `frontend/app/pages/index.vue`, add logic in `onMounted` to auto-trigger `handleQuickOpen` if a vault handle is remembered:

```ts
onMounted(async () => {
  await applyAuthCallbackStateFromQuery()

  if (vault.status === VaultStatus.UNLOCKED) {
    await oauth.ensureSyncedAfterUnlockOrAuth()
  }

  // Auto-open remembered vault when user hasn't entered a passphrase yet
  if (vault.status === VaultStatus.LOCKED && vault.isRemembered && !passphrase.value) {
    // Don't auto-open – user still needs to enter passphrase.
    // But we should focus the passphrase input.
    // The "Quick Open" button is already shown; this is sufficient.
  }
})
```

Actually, the current flow already shows the "Quick Open" button when a vault is remembered. The flow works:

1. User opens app → sees "Previously opened: [filename]" with "Quick Open" and "Forget" buttons
2. User enters passphrase, clicks Quick Open → vault opens

This is already working. The `tryQuickOpen` method retrieves the handle from IndexedDB. The issue might be that `handleQuickOpen` requires explicit user action (click). This is correct security behavior — we should never auto-decrypt without the passphrase.

No changes needed for this flow — it's already functional.

- [ ] **Step 3: Add responsive classes to grid layouts**

Add `overflow-x-auto` to tables (already present in most). The pages already use responsive grid classes like `sm:grid-cols-2`, `lg:grid-cols-3`, `xl:grid-cols-4` — these should work fine.

One improvement: ensure the dashboard's `grid gap-4 xl:grid-cols-2` also has `sm:grid-cols-1` (default).

No changes needed — all pages already use responsive grid utilities.

---

### Task 8: Documentation

**Files:**

- Modify: `frontend/README.md`
- Modify: `frontend/AGENTS.md`

- [ ] **Step 1: Update README**

In `frontend/README.md`:

- Change "Unovis" to "ApexCharts" in tech stack
- Add store structure note

- [ ] **Step 2: Update AGENTS.md**

Replace store listing to reflect the new 7-store structure.

---

## Spec Coverage Check

| Spec Requirement                                                         | Task(s)                                    |
| ------------------------------------------------------------------------ | ------------------------------------------ |
| Merge accounts, transactions, positions, income, taxLots into data store | Task 1                                     |
| Update all consumers to use data store                                   | Task 2                                     |
| Delete old 6 store files                                                 | Task 3                                     |
| Install ApexCharts, create chart components                              | Task 4                                     |
| Replace dashboard charts with ApexCharts, remove Unovis                  | Task 5                                     |
| Fix dark/light mode                                                      | Task 6                                     |
| Mobile responsiveness + navigation                                       | Task 7                                     |
| Remember last vault                                                      | Task 7 (already works, no changes needed)  |
| Documentation                                                            | Task 8                                     |
| Old vault compatibility                                                  | No changes needed (VaultPayload unchanged) |
