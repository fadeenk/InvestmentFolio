import type { PricePoint } from '@/types/vault'

const API_KEY = 'SCR7S0C0QI1ATNC0'
const BASE_URL = 'https://www.alphavantage.co/query'

export interface DailyPriceRow {
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface AlphaVantageDailyResponse {
  'Meta Data'?: Record<string, string>
  'Time Series (Daily)'?: Record<string, Record<string, string>>
  'Error Message'?: string
  Note?: string
}

async function fetchDailyTimeSeries(symbol: string): Promise<Map<string, DailyPriceRow>> {
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}&outputsize=compact`

  const response = await fetch(url)
  const data: AlphaVantageDailyResponse = await response.json()

  if (data['Error Message']) {
    throw new Error(`Alpha Vantage error for ${symbol}: ${data['Error Message']}`)
  }
  if (data.Note) {
    throw new Error(`Alpha Vantage rate limit for ${symbol}: ${data.Note}`)
  }

  const series: Record<string, Record<string, string>> | undefined = data['Time Series (Daily)']
  if (!series) {
    throw new Error(`No daily time series data returned for ${symbol}`)
  }

  const result = new Map<string, DailyPriceRow>()
  for (const date of Object.keys(series)) {
    const v = series[date]!
    result.set(date, {
      open: Number.parseFloat(v['1. open']!),
      high: Number.parseFloat(v['2. high']!),
      low: Number.parseFloat(v['3. low']!),
      close: Number.parseFloat(v['4. close']!),
      volume: Number.parseFloat(v['5. volume']!),
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

export async function fetchMissingDailyData(
  symbols: string[],
  getCached: (symbol: string) => PricePoint[],
  onProgress?: (current: number) => void,
): Promise<Map<string, PricePoint[]>> {
  const result = new Map<string, PricePoint[]>()

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]!
    const cached = getCached(symbol)
    const latestCached = cached.length > 0 ? cached[cached.length - 1] : null
    const latestDate = latestCached ? latestCached.date : null

    if (!isCacheFresh(latestDate)) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      try {
        const freshData = await fetchDailyTimeSeries(symbol)
        const merged = mergeCachedWithFresh(cached, freshData)
        result.set(symbol, merged)
      } catch (err) {
        console.warn(`Failed to fetch data for ${symbol}, using cached`, err)
        result.set(symbol, [...cached])
      }
    } else {
      result.set(symbol, [...cached])
    }

    onProgress?.(i + 1)
  }

  return result
}
