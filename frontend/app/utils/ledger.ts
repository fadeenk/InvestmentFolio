import { AssetType, TransactionType } from '@/types/enums'
import type { CostBasisMethod } from '@/types/enums'
import { TermType } from '@/types/vault'
import type { ClosedLot, IncomeRecord, Position, TaxLot, Transaction, VaultPayload } from '@/types/vault'

interface WorkingLot {
  lot: TaxLot
  acquiredAtMs: number
}

type IncomeDraft = Omit<IncomeRecord, 'id'>

interface HoldingMeta {
  accountId: string
  symbol: string
  assetType: Position['assetType']
}

function toTimestamp(value: string): number {
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function transactionOrder(a: Transaction, b: Transaction): number {
  const byDate = toTimestamp(a.date) - toTimestamp(b.date)
  if (byDate !== 0) return byDate

  const byImportedAt = toTimestamp(a.importedAt) - toTimestamp(b.importedAt)
  if (byImportedAt !== 0) return byImportedAt

  return a.id.localeCompare(b.id)
}

export function transactionCashDelta(tx: Transaction): number {
  if (tx.type === TransactionType.Split) {
    return 0
  }

  const quantity = tx.quantity ?? 0
  const gross = quantity === 0 ? tx.price : quantity * tx.price
  const fees = tx.fees || 0

  switch (tx.type) {
    case TransactionType.Sell:
      return gross - fees
    case TransactionType.Dividend:
    case TransactionType.Interest:
    case TransactionType.DEPOSIT:
    case TransactionType.TRANSFER_IN:
      return gross
    case TransactionType.Buy:
    case TransactionType.WITHDRAWAL:
    case TransactionType.TRANSFER_OUT:
      return -(gross + fees)
    default:
      return 0
  }
}

function buildIncomeRecord(tx: Transaction, amount: number): IncomeDraft {
  return {
    accountId: tx.accountId,
    transactionId: tx.id,
    date: tx.date,
    symbol: tx.symbol || null,
    incomeType: tx.type === TransactionType.Dividend ? TransactionType.Dividend : TransactionType.Interest,
    amount,
    taxYear: new Date(tx.date).getFullYear(),
  }
}

function getCostBasisMethod(payload: VaultPayload, accountId: string): CostBasisMethod {
  return payload.metadata.costBasisMethodByAccount[accountId] ?? payload.metadata.displayPreferences.defaultCostBasisMethod
}

export function recalculateDerivedDataFromTransactions(payload: VaultPayload): void {
  const now = new Date().toISOString()
  const transactions = [...payload.transactions].sort(transactionOrder)

  const cashByAccount = new Map<string, number>()
  const touchedAccounts = new Set<string>()
  const lotsByHolding = new Map<string, WorkingLot[]>()
  const holdingMetaByKey = new Map<string, HoldingMeta>()
  const incomeDrafts: IncomeDraft[] = []
  const closedDrafts: Omit<ClosedLot, 'id'>[] = []

  for (const tx of transactions) {
    touchedAccounts.add(tx.accountId)

    const cashDelta = transactionCashDelta(tx)
    cashByAccount.set(tx.accountId, roundCurrency((cashByAccount.get(tx.accountId) ?? 0) + cashDelta))

    const symbol = tx.symbol?.toUpperCase() ?? ''
    const holdingKey = `${tx.accountId}::${symbol}`

    if (symbol) {
      holdingMetaByKey.set(holdingKey, {
        accountId: tx.accountId,
        symbol,
        assetType: tx.assetType,
      })
    }

    if (tx.type === TransactionType.Dividend || tx.type === TransactionType.Interest) {
      const incomeAmount = Math.abs(cashDelta)
      if (incomeAmount > 0) {
        incomeDrafts.push(buildIncomeRecord(tx, incomeAmount))
      }
      continue
    }

    if (tx.type === TransactionType.Buy) {
      const quantity = Math.max(0, tx.quantity ?? 0)
      if (quantity <= 0 || !symbol) {
        continue
      }

      const totalCost = quantity * tx.price + (tx.fees || 0)
      const acquiredAtMs = toTimestamp(tx.date)
      const lot: TaxLot = {
        id: `lot-${tx.id}`,
        accountId: tx.accountId,
        symbol,
        openingTransactionId: tx.id,
        acquiredDate: tx.date,
        acquiredPrice: tx.price,
        originalQuantity: quantity,
        remainingQuantity: quantity,
        costBasis: totalCost,
        currentValue: totalCost,
        unrealizedGainLoss: 0,
        unrealizedGainLossPct: 0,
        daysHeld: 0,
        isLongTerm: false,
        isOpen: true,
        isWashSale: false,
        washSaleDisallowedLoss: 0,
        adjustedCostBasis: totalCost,
      }

      const queue = lotsByHolding.get(holdingKey) ?? []
      queue.push({ lot, acquiredAtMs })
      lotsByHolding.set(holdingKey, queue)
      continue
    }

    if (tx.type === TransactionType.Sell && symbol) {
      const quantityToSell = Math.max(0, tx.quantity ?? 0)
      if (quantityToSell <= 0) {
        continue
      }

      const queue = lotsByHolding.get(holdingKey) ?? []
      let remainingToClose = quantityToSell

      queue.sort((a, b) => a.acquiredAtMs - b.acquiredAtMs)

      for (const entry of queue) {
        if (remainingToClose <= 0) break
        if (!entry.lot.isOpen || entry.lot.remainingQuantity <= 0) continue

        const take = Math.min(entry.lot.remainingQuantity, remainingToClose)
        const unitCost = entry.lot.remainingQuantity > 0 ? entry.lot.adjustedCostBasis / entry.lot.remainingQuantity : 0
        const closedCost = unitCost * take
        const proceeds = tx.price * take
        const realizedGainLoss = proceeds - closedCost

        const daysHeld = Math.floor((new Date(tx.date).getTime() - new Date(entry.lot.acquiredDate).getTime()) / (1000 * 60 * 60 * 24))
        const termType = daysHeld >= 366 ? TermType.LONG_TERM : TermType.SHORT_TERM

        entry.lot.remainingQuantity = roundCurrency(entry.lot.remainingQuantity - take)
        entry.lot.costBasis = roundCurrency(Math.max(0, entry.lot.costBasis - closedCost))
        entry.lot.adjustedCostBasis = roundCurrency(Math.max(0, entry.lot.adjustedCostBasis - closedCost))

        if (entry.lot.remainingQuantity <= 0) {
          entry.lot.remainingQuantity = 0
          entry.lot.costBasis = 0
          entry.lot.adjustedCostBasis = 0
          entry.lot.isOpen = false

          closedDrafts.push({
            accountId: entry.lot.accountId,
            symbol: entry.lot.symbol,
            openingLotId: entry.lot.id,
            openingTransactionId: entry.lot.openingTransactionId,
            closingTransactionId: tx.id,
            acquiredDate: entry.lot.acquiredDate,
            soldDate: tx.date,
            quantity: take,
            costBasis: roundCurrency(closedCost),
            proceeds: roundCurrency(proceeds),
            realizedGainLoss: roundCurrency(realizedGainLoss),
            termType,
            taxYear: new Date(tx.date).getFullYear(),
            isWashSale: entry.lot.isWashSale,
            washSaleDisallowedLoss: entry.lot.washSaleDisallowedLoss,
          })
        }

        remainingToClose = roundCurrency(remainingToClose - take)
      }

      lotsByHolding.set(holdingKey, queue)
    }
  }

  const nextLots: TaxLot[] = []
  const nextPositions: Position[] = []

  for (const [holdingKey, queue] of lotsByHolding) {
    const meta = holdingMetaByKey.get(holdingKey)
    if (!meta) continue

    let openQuantity = 0
    let openCost = 0

    for (const entry of queue) {
      const acquiredAt = toTimestamp(entry.lot.acquiredDate)
      const daysHeld = Math.max(0, Math.floor((Date.now() - acquiredAt) / (1000 * 60 * 60 * 24)))
      entry.lot.daysHeld = daysHeld
      entry.lot.isLongTerm = daysHeld >= 366

      const currentValue = entry.lot.remainingQuantity * entry.lot.acquiredPrice
      const unrealizedGainLoss = currentValue - entry.lot.adjustedCostBasis
      entry.lot.currentValue = roundCurrency(currentValue)
      entry.lot.unrealizedGainLoss = roundCurrency(unrealizedGainLoss)
      entry.lot.unrealizedGainLossPct = entry.lot.adjustedCostBasis > 0 ? (unrealizedGainLoss / entry.lot.adjustedCostBasis) * 100 : 0

      nextLots.push(entry.lot)

      if (entry.lot.isOpen && entry.lot.remainingQuantity > 0) {
        openQuantity += entry.lot.remainingQuantity
        openCost += entry.lot.adjustedCostBasis
      }
    }

    if (openQuantity <= 0) {
      continue
    }

    const avgCost = openCost / openQuantity

    const currentPrice =
      meta.assetType === AssetType.CashEquivalent
        ? 1
        : (() => {
            const cachedPrices = payload.priceHistory[meta.symbol] ?? []
            const latestCached = cachedPrices.length > 0 ? cachedPrices[cachedPrices.length - 1] : null
            const cachedClose = latestCached && typeof latestCached.close === 'number' ? latestCached.close : null
            return cachedClose ?? avgCost
          })()
    const marketValue = openQuantity * currentPrice
    const unrealizedGainLoss = marketValue - openCost
    const unrealizedGainLossPct = openCost > 0 ? (unrealizedGainLoss / openCost) * 100 : 0

    nextPositions.push({
      id: `pos-${meta.accountId}-${meta.symbol}`,
      accountId: meta.accountId,
      symbol: meta.symbol,
      assetType: meta.assetType,
      quantity: roundCurrency(openQuantity),
      avgCost: roundCurrency(avgCost),
      currentPrice: roundCurrency(currentPrice),
      marketValue: roundCurrency(marketValue),
      unrealizedGainLoss: roundCurrency(unrealizedGainLoss),
      unrealizedGainLossPct: roundCurrency(unrealizedGainLossPct),
      dayGainLoss: 0,
      dayGainLossPct: 0,
      costBasisMethod: getCostBasisMethod(payload, meta.accountId),
      snapshotAt: now,
    })
  }

  const incomeByTransactionId = new Map<string, IncomeRecord>()
  for (const draft of incomeDrafts) {
    incomeByTransactionId.set(draft.transactionId, {
      ...draft,
      id: `income-${draft.transactionId}`,
    })
  }

  const nextClosedLots: ClosedLot[] = closedDrafts.map((draft, idx) => ({
    ...draft,
    id: `closed-${idx}-${draft.closingTransactionId}`,
  }))

  payload.positions = nextPositions
  payload.taxLots = nextLots
  payload.closedLots = nextClosedLots
  payload.dividends = Array.from(incomeByTransactionId.values())

  const marketByAccount = new Map<string, number>()
  for (const position of nextPositions) {
    marketByAccount.set(position.accountId, roundCurrency((marketByAccount.get(position.accountId) ?? 0) + position.marketValue))
  }

  for (const account of payload.accounts) {
    if (!touchedAccounts.has(account.id)) {
      continue
    }

    const cash = roundCurrency(cashByAccount.get(account.id) ?? 0)
    const marketValue = roundCurrency(marketByAccount.get(account.id) ?? 0)

    account.cashBalance = cash
    account.currentBalance = roundCurrency(cash + marketValue)
    account.lastUpdatedAt = now
  }

  payload.lastSyncedAt = now
}

/**
 * Backfill closedLots from scratch by re-processing all sell transactions.
 * Only writes to payload.closedLots — does NOT touch positions, taxLots,
 * dividends, or account balances (unlike recalculateDerivedDataFromTransactions).
 * Safe to run as a one-time migration for existing vaults.
 */
export function backfillClosedLots(payload: VaultPayload): void {
  if (payload.closedLots.length > 0) return

  const transactions = [...payload.transactions].filter((tx) => tx.type === TransactionType.Buy || tx.type === TransactionType.Sell).sort(transactionOrder)

  const lotsByHolding = new Map<string, WorkingLot[]>()
  const closedDrafts: Omit<ClosedLot, 'id'>[] = []

  for (const tx of transactions) {
    const symbol = tx.symbol?.toUpperCase() ?? ''
    const holdingKey = `${tx.accountId}::${symbol}`
    if (!symbol) continue

    if (tx.type === TransactionType.Buy) {
      const quantity = Math.max(0, tx.quantity ?? 0)
      if (quantity <= 0) continue

      const totalCost = quantity * tx.price + (tx.fees || 0)
      const lot: TaxLot = {
        id: `lot-${tx.id}`,
        accountId: tx.accountId,
        symbol,
        openingTransactionId: tx.id,
        acquiredDate: tx.date,
        acquiredPrice: tx.price,
        originalQuantity: quantity,
        remainingQuantity: quantity,
        costBasis: totalCost,
        currentValue: totalCost,
        unrealizedGainLoss: 0,
        unrealizedGainLossPct: 0,
        daysHeld: 0,
        isLongTerm: false,
        isOpen: true,
        isWashSale: false,
        washSaleDisallowedLoss: 0,
        adjustedCostBasis: totalCost,
      }

      const queue = lotsByHolding.get(holdingKey) ?? []
      queue.push({ lot, acquiredAtMs: toTimestamp(tx.date) })
      lotsByHolding.set(holdingKey, queue)
      continue
    }

    if (tx.type === TransactionType.Sell) {
      const quantityToSell = Math.max(0, tx.quantity ?? 0)
      if (quantityToSell <= 0) continue

      const queue = lotsByHolding.get(holdingKey) ?? []
      let remainingToClose = quantityToSell

      queue.sort((a, b) => a.acquiredAtMs - b.acquiredAtMs)

      for (const entry of queue) {
        if (remainingToClose <= 0) break
        if (!entry.lot.isOpen || entry.lot.remainingQuantity <= 0) continue

        const take = Math.min(entry.lot.remainingQuantity, remainingToClose)
        const unitCost = entry.lot.remainingQuantity > 0 ? entry.lot.adjustedCostBasis / entry.lot.remainingQuantity : 0
        const closedCost = unitCost * take
        const proceeds = tx.price * take
        const realizedGainLoss = proceeds - closedCost
        const daysHeld = Math.floor((new Date(tx.date).getTime() - new Date(entry.lot.acquiredDate).getTime()) / (1000 * 60 * 60 * 24))
        const termType = daysHeld >= 366 ? TermType.LONG_TERM : TermType.SHORT_TERM

        entry.lot.remainingQuantity = roundCurrency(entry.lot.remainingQuantity - take)
        entry.lot.costBasis = roundCurrency(Math.max(0, entry.lot.costBasis - closedCost))
        entry.lot.adjustedCostBasis = roundCurrency(Math.max(0, entry.lot.adjustedCostBasis - closedCost))

        if (entry.lot.remainingQuantity <= 0) {
          entry.lot.isOpen = false

          closedDrafts.push({
            accountId: entry.lot.accountId,
            symbol: entry.lot.symbol,
            openingLotId: entry.lot.id,
            openingTransactionId: entry.lot.openingTransactionId,
            closingTransactionId: tx.id,
            acquiredDate: entry.lot.acquiredDate,
            soldDate: tx.date,
            quantity: take,
            costBasis: roundCurrency(closedCost),
            proceeds: roundCurrency(proceeds),
            realizedGainLoss: roundCurrency(realizedGainLoss),
            termType,
            taxYear: new Date(tx.date).getFullYear(),
            isWashSale: entry.lot.isWashSale,
            washSaleDisallowedLoss: entry.lot.washSaleDisallowedLoss,
          })
        }

        remainingToClose = roundCurrency(remainingToClose - take)
      }

      lotsByHolding.set(holdingKey, queue)
    }
  }

  payload.closedLots = closedDrafts.map((draft, idx) => ({
    ...draft,
    id: `closed-${idx}-${draft.closingTransactionId}`,
  }))
}
