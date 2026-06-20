import { MarketApiError } from '../types/market'

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

export async function fetchQuotes(_env: Env, params: { symbols: string }): Promise<Record<string, unknown>> {
  const symbols = params.symbols.split(',').map(s => s.trim()).filter(Boolean)
  const entries = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=1d&interval=1d`
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new MarketApiError(`Yahoo API error for ${symbol}: ${res.status}`, res.status)
      const data = await res.json() as Record<string, unknown>
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
  candles: unknown[]
}> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(params.symbol)}?range=${params.range}&interval=1d`
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new MarketApiError(`Yahoo API error: ${res.status}`, res.status)

  const data = await res.json() as {
    chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: number[]; open?: number[]; high?: number[]; low?: number[]; volume?: number[] }[] } }[] }
  }
  const candles = data.chart?.result?.[0]?.timestamp?.map((ts, i) => {
    const quote = data.chart?.result?.[0]?.indicators?.quote?.[0]
    return {
      datetime: ts,
      open: quote?.open?.[i] ?? 0,
      high: quote?.high?.[i] ?? 0,
      low: quote?.low?.[i] ?? 0,
      close: quote?.close?.[i] ?? 0,
      volume: quote?.volume?.[i] ?? 0,
    }
  }) ?? []

  return { symbol: params.symbol, candles }
}
