import { MarketApiError } from '../types/market'

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

function parseRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return {}
  return value as Record<string, unknown>
}

interface YahooChartQuote {
  close?: number[]
  open?: number[]
  high?: number[]
  low?: number[]
  volume?: number[]
}

interface YahooChartResult {
  meta?: Record<string, unknown>
  timestamp?: number[]
  indicators?: {
    quote?: YahooChartQuote[]
  }
}

function parseYahooChart(value: unknown): { meta: Record<string, unknown> | undefined; result: YahooChartResult[] | undefined } {
  const obj = parseRecord(value)
  const chart = parseRecord(obj.chart)
  return { meta: chart.meta as Record<string, unknown> | undefined, result: chart.result as YahooChartResult[] | undefined }
}

export async function fetchQuotes(_env: Env, params: { symbols: string }): Promise<Record<string, unknown>> {
  const symbols = params.symbols.split(',').map(s => s.trim()).filter(Boolean)
  const entries = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=1d&interval=1d`
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new MarketApiError(`Yahoo API error for ${symbol}: ${res.status}`, res.status)
      const raw = await res.json()
      const data = parseRecord(raw)
      return { symbol, data }
    }),
  )

  const result: Record<string, unknown> = {}
  for (const entry of entries) {
    if (entry.status === 'fulfilled') {
      result[entry.value.symbol] = entry.value.data
    }
  }
  return result
}

export async function fetchPriceHistory(_env: Env, params: { symbol: string; range: string }): Promise<{
  symbol: string
  candles: { datetime: number; open: number; high: number; low: number; close: number; volume: number }[]
}> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(params.symbol)}?range=${params.range}&interval=1d`
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new MarketApiError(`Yahoo API error: ${res.status}`, res.status)

  const raw = await res.json()
  const chart = parseYahooChart(raw)
  const firstResult = chart.result?.[0]
  const timestamps = firstResult?.timestamp
  const quote = firstResult?.indicators?.quote?.[0]

  const candles = timestamps?.map((ts, i) => ({
    datetime: ts,
    open: quote?.open?.[i] ?? 0,
    high: quote?.high?.[i] ?? 0,
    low: quote?.low?.[i] ?? 0,
    close: quote?.close?.[i] ?? 0,
    volume: quote?.volume?.[i] ?? 0,
  })) ?? []

  return { symbol: params.symbol, candles }
}
