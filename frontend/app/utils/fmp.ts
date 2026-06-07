import type { PricePoint } from '@/types/vault'

const BASE_URL = 'https://financialmodelingprep.com/stable/'

export interface DailyPriceRow {
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface FmpQuote {
  price: number
  previousClose: number
}

interface FmpQuoteEntry {
  symbol: string
  price: number
  previousClose: number
}

interface FmpHistoricalEntry {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export async function fetchBatchQuotes(symbols: string[], apiKey: string): Promise<Map<string, FmpQuote>> {
  if (symbols.length === 0) return new Map()

  if (symbols.length === 1) {
    return fetchIndividualQuotes(symbols, apiKey)
  }

  try {
    const url = `${BASE_URL}batch-quote?symbols=${symbols.join(',')}&apikey=${apiKey}`
    const response = await fetch(url)
    if (!response.ok) {
      if (response.status === 402) {
        return fetchIndividualQuotes(symbols, apiKey)
      }
      throw new Error(`Batch quote failed: ${response.status}`)
    }
    const data: FmpQuoteEntry[] = await response.json()
    const quotes = new Map<string, FmpQuote>()
    for (const item of data) {
      quotes.set(item.symbol, {
        price: item.price,
        previousClose: item.previousClose,
      })
    }
    return quotes
  } catch {
    return fetchIndividualQuotes(symbols, apiKey)
  }
}

async function fetchIndividualQuotes(symbols: string[], apiKey: string): Promise<Map<string, FmpQuote>> {
  const quotes = new Map<string, FmpQuote>()
  for (const symbol of symbols) {
    try {
      const url = `${BASE_URL}quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
      const response = await fetch(url)
      if (!response.ok) continue
      const data: FmpQuoteEntry[] = await response.json()
      if (data.length > 0) {
        const entry = data[0]!
        quotes.set(symbol, {
          price: entry.price,
          previousClose: entry.previousClose,
        })
      }
    } catch {
      /* skip failed symbols */
    }
  }
  return quotes
}

async function fetchHistoricalDaily(symbol: string, apiKey: string): Promise<Map<string, DailyPriceRow>> {
  const url = `${BASE_URL}historical-price-eod/full?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`FMP historical error for ${symbol}: ${response.statusText}`)
  }
  const data: FmpHistoricalEntry[] = await response.json()
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No historical data returned for ${symbol}`)
  }
  const result = new Map<string, DailyPriceRow>()
  for (const entry of data) {
    result.set(entry.date, {
      open: entry.open,
      high: entry.high,
      low: entry.low,
      close: entry.close,
      volume: entry.volume,
    })
  }
  return result
}

function isCacheFresh(latestDate: string | null): boolean {
  if (!latestDate) return false
  const now = new Date()
  const latest = new Date(latestDate)
  const diffMs = now.getTime() - latest.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= 1.5
}

function mergeCachedWithFresh(cached: PricePoint[], fresh: Map<string, DailyPriceRow>): PricePoint[] {
  const merged = new Map<string, PricePoint>()

  for (const point of cached) {
    merged.set(point.date, { ...point })
  }

  for (const [date, row] of fresh) {
    merged.set(date, {
      date,
      close: row.close,
      open: row.open,
      high: row.high,
      low: row.low,
      volume: row.volume,
    })
  }

  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date))
}

const BACKFILL_CUTOFF = '2026-06-01'

function needsHistoricalBackfill(cached: PricePoint[]): boolean {
  if (cached.length === 0) return true
  const earliest = cached.reduce((min, p) => (p.date < min ? p.date : min), cached[0]!.date)
  return earliest > BACKFILL_CUTOFF
}

export async function fetchMissingHistoricalData(
  symbols: string[],
  getCached: (symbol: string) => PricePoint[],
  apiKey: string,
  onProgress?: (current: number) => void,
): Promise<Map<string, PricePoint[]>> {
  const result = new Map<string, PricePoint[]>()

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]!
    const cached = getCached(symbol)
    const latestCached = cached.length > 0 ? cached[cached.length - 1] : null
    const latestDate = latestCached ? latestCached.date : null

    if (!isCacheFresh(latestDate) || needsHistoricalBackfill(cached)) {
      try {
        const freshData = await fetchHistoricalDaily(symbol, apiKey)
        const merged = mergeCachedWithFresh(cached, freshData)
        result.set(symbol, merged)
      } catch (err) {
        console.warn(`Failed to fetch historical data for ${symbol}, using cached`, err)
        result.set(symbol, [...cached])
      }
    } else {
      result.set(symbol, [...cached])
    }

    onProgress?.(i + 1)
  }

  return result
}
