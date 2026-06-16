import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useVaultStore } from './vault.store'
import { getWorkerBaseUrl } from '@/utils/worker'
import { AssetType, TransactionType } from '@/types/enums'
import { SyncStatus } from '@/types/vault'
import { transactionCashDelta } from '@/utils/ledger'
import type { BalancePoint, Position, PricePoint, VaultPayload } from '@/types/vault'

const BACKFILL_CUTOFF = '2026-06-01'

export const useMarketStore = defineStore('market', () => {
  const vaultStore = useVaultStore()

  const syncStatus = ref<SyncStatus>(SyncStatus.IDLE)
  const progress = ref<{ current: number; total: number } | null>(null)
  const lastError = ref<string | null>(null)

  const isSyncing = computed(() => syncStatus.value === SyncStatus.IN_PROGRESS)

  async function refreshMarketData(): Promise<void> {
    if (!vaultStore.payload) return

    syncStatus.value = SyncStatus.IN_PROGRESS
    lastError.value = null

    try {
      const payload = vaultStore.payload

      const latestPositions = latestByAccountSymbol(payload.positions)
      const openPositions = latestPositions.filter((p) => p.quantity > 0)

      const symbolToAssetType = new Map<string, AssetType>()
      for (const p of openPositions) {
        if (!symbolToAssetType.has(p.symbol)) {
          symbolToAssetType.set(p.symbol, p.assetType)
        }
      }

      const cashEqSymbols = new Set(openPositions.filter((p) => p.assetType === AssetType.CashEquivalent).map((p) => p.symbol))

      const symbolsToFetch = openPositions.filter((p) => p.assetType !== AssetType.CashEquivalent).map((p) => p.symbol)

      const uniqueSymbolsToFetch = [...new Set(symbolsToFetch)]

      const base = getWorkerBaseUrl()
      if (!base) {
        throw new Error('Worker URL not configured')
      }

      const quotesRes = await fetch(`${base}/api/market/quotes?symbols=${uniqueSymbolsToFetch.join(',')}`)
      if (!quotesRes.ok) throw new Error(`Quotes fetch failed: ${quotesRes.status}`)
      const quotes: Record<string, { price: number; previousClose: number }> = await quotesRes.json()

      progress.value = { current: 0, total: uniqueSymbolsToFetch.length }

      const mergedData = new Map<string, PricePoint[]>()
      for (let i = 0; i < uniqueSymbolsToFetch.length; i++) {
        const symbol = uniqueSymbolsToFetch[i]!
        const cached = payload.priceHistory[symbol] ?? []

        const latestCached = cached.length > 0 ? cached[cached.length - 1]! : null
        const latestDate = latestCached ? latestCached.date : null

        if (!isCacheFresh(latestDate) || needsHistoricalBackfill(cached)) {
          try {
            const res = await fetch(`${base}/api/market/history?symbol=${encodeURIComponent(symbol)}`)
            if (!res.ok) throw new Error(`History fetch failed: ${res.status}`)
            const data: { symbol: string; candles: PricePoint[] } = await res.json()

            const freshMap = new Map<string, PricePoint>()
            for (const point of data.candles) {
              freshMap.set(point.date, point)
            }

            mergedData.set(symbol, mergeCachedWithFresh(cached, freshMap))
          } catch (err) {
            console.warn(`Failed to fetch historical data for ${symbol}, using cached`, err)
            mergedData.set(symbol, [...cached])
          }
        } else {
          mergedData.set(symbol, [...cached])
        }

        progress.value = { current: i + 1, total: uniqueSymbolsToFetch.length }
      }

      vaultStore.mutatePayload((p) => {
        for (const [symbol, points] of mergedData) {
          p.priceHistory[symbol] = points
        }
      })

      vaultStore.mutatePayload((p) => {
        generateBalanceHistories(p, symbolToAssetType)
      })

      vaultStore.mutatePayload((p) => {
        updatePositionPrices(p, cashEqSymbols, quotes)
      })

      if (vaultStore.fileHandle) {
        await vaultStore.saveVault().catch(() => {
          // _writeBuffer already set lastError and cleared stale handle
        })
      }

      syncStatus.value = SyncStatus.SUCCESS
      progress.value = null
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : 'Market data sync failed'
      syncStatus.value = SyncStatus.ERROR
      progress.value = null
    }
  }

  return {
    syncStatus,
    progress,
    lastError,
    isSyncing,
    refreshMarketData,
  }
})

function latestByAccountSymbol(positions: Position[]): Position[] {
  const seen = new Map<string, Position>()
  for (const p of positions) {
    const key = `${p.accountId}::${p.symbol}`
    seen.set(key, p)
  }
  return Array.from(seen.values())
}

function getCloseForSymbol(symbol: string, date: string, priceHistory: VaultPayload['priceHistory'], symbolToAssetType: Map<string, AssetType>): number {
  if (symbolToAssetType.get(symbol) === AssetType.CashEquivalent) return 1
  const prices = priceHistory[symbol] ?? []
  const point = prices.find((p) => p.date === date)
  if (typeof point?.close === 'number') return point.close
  for (let i = prices.length - 1; i >= 0; i--) {
    const close = prices[i]!.close
    if (prices[i]!.date < date && typeof close === 'number') {
      return close
    }
  }
  return 0
}

export function generateBalanceHistories(payload: VaultPayload, symbolToAssetType: Map<string, AssetType>): void {
  const allTxs = [...payload.transactions].sort((a, b) => a.date.localeCompare(b.date))

  const txByAccount = new Map<string, typeof allTxs>()
  for (const tx of allTxs) {
    const list = txByAccount.get(tx.accountId) ?? []
    list.push(tx)
    txByAccount.set(tx.accountId, list)
  }

  const startDate = new Date('2026-06-01')
  const endDate = new Date()

  for (const account of payload.accounts) {
    const accountTxs = txByAccount.get(account.id) ?? []
    const history: BalancePoint[] = []

    let runningCash = 0
    const heldQty = new Map<string, number>()
    let txIndex = 0

    const cursor = new Date(startDate.getTime())
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const dayOfWeek = cursor.getDay()

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        while (txIndex < accountTxs.length) {
          const tx = accountTxs[txIndex]!
          if (tx.date > dateStr) break
          runningCash += transactionCashDelta(tx)

          const symbol = tx.symbol?.toUpperCase() ?? ''
          const qty = tx.quantity ?? 0
          if (symbol && qty) {
            if (tx.type === TransactionType.Buy) {
              heldQty.set(symbol, (heldQty.get(symbol) ?? 0) + qty)
            } else if (tx.type === TransactionType.Sell) {
              heldQty.set(symbol, (heldQty.get(symbol) ?? 0) - qty)
            }
          }

          txIndex++
        }

        let marketValue = 0
        for (const [symbol, qty] of heldQty) {
          if (qty <= 0) continue
          const close = getCloseForSymbol(symbol, dateStr, payload.priceHistory, symbolToAssetType)
          marketValue += qty * close
        }

        history.push({
          date: dateStr,
          balance: roundCurrency(runningCash + marketValue),
        })
      }

      cursor.setDate(cursor.getDate() + 1)
    }

    account.balanceHistory = history
  }
}

function updatePositionPrices(payload: VaultPayload, cashEqSymbols: Set<string>, quotes?: Record<string, { price: number; previousClose: number }>): void {
  const latestIdx = new Map<string, number>()
  for (let i = payload.positions.length - 1; i >= 0; i--) {
    const p = payload.positions[i]!
    const key = `${p.accountId}::${p.symbol}`
    if (!latestIdx.has(key)) latestIdx.set(key, i)
  }

  const now = new Date().toISOString()

  for (const [, idx] of latestIdx) {
    const position = payload.positions[idx]!

    let currentPrice: number
    let previousClose: number

    if (cashEqSymbols.has(position.symbol)) {
      currentPrice = 1
      previousClose = 1
    } else {
      const quote = quotes?.[position.symbol]

      if (quote) {
        currentPrice = quote.price
        previousClose = quote.previousClose
      } else {
        const prices = payload.priceHistory[position.symbol] ?? []

        if (prices.length === 0) {
          currentPrice = position.currentPrice || position.avgCost || 0
          previousClose = currentPrice
        } else {
          const latest = prices[prices.length - 1]!
          const prev = prices.length > 1 ? prices[prices.length - 2] : undefined

          const price = typeof latest.close === 'number' ? latest.close : 0
          if (price > 0) {
            currentPrice = price
            previousClose = prev && typeof prev.close === 'number' ? prev.close : currentPrice
          } else {
            currentPrice = position.currentPrice || position.avgCost || 0
            previousClose = currentPrice
          }
        }
      }
    }

    const marketValue = position.quantity * currentPrice
    const costBasis = position.avgCost * position.quantity
    const unrealizedGainLoss = marketValue - costBasis
    const unrealizedGainLossPct = costBasis > 0 ? (unrealizedGainLoss / costBasis) * 100 : 0
    const dayGainLoss = (currentPrice - previousClose) * position.quantity
    const dayGainLossPct = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0

    position.currentPrice = roundCurrency(currentPrice)
    position.marketValue = roundCurrency(marketValue)
    position.unrealizedGainLoss = roundCurrency(unrealizedGainLoss)
    position.unrealizedGainLossPct = roundCurrency(unrealizedGainLossPct)
    position.dayGainLoss = roundCurrency(dayGainLoss)
    position.dayGainLossPct = roundCurrency(dayGainLossPct)
    position.snapshotAt = now
  }
}

function mergeCachedWithFresh(cached: PricePoint[], fresh: Map<string, PricePoint>): PricePoint[] {
  const merged = new Map<string, PricePoint>()
  for (const point of cached) {
    merged.set(point.date, { ...point })
  }
  for (const [, point] of fresh) {
    merged.set(point.date, { ...point })
  }
  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function isCacheFresh(latestDate: string | null): boolean {
  if (!latestDate) return false
  const now = new Date()
  const latest = new Date(latestDate)
  const diffMs = now.getTime() - latest.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= 1.5
}

function needsHistoricalBackfill(cached: PricePoint[]): boolean {
  if (cached.length === 0) return true
  const earliest = cached.reduce((min, p) => (p.date < min ? p.date : min), cached[0]!.date)
  return earliest > BACKFILL_CUTOFF
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}
