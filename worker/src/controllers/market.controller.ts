import { fetchQuotes, fetchPriceHistory } from '../services/market.service'
import { MarketApiError } from '../types/market'
import { jsonResponse, jsonError } from '../utils/http'

interface QuoteItem {
	price: number
	previousClose: number
}

interface HistoryCandle {
	date: string
	open: number
	high: number
	low: number
	close: number
	volume: number
}

interface HistoryResponse {
	symbol: string
	candles: HistoryCandle[]
}

function extractQuoteItem(raw: unknown): QuoteItem | null {
	if (!raw || typeof raw !== 'object') return null
	const obj = raw as Record<string, unknown>
	const chart = obj.chart as Record<string, unknown> | undefined
	const result = (chart?.result as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined
	const meta = result?.meta as Record<string, unknown> | undefined
	if (!meta) return null

	const price = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : 0
	const previousClose = typeof meta.previousClose === 'number' ? meta.previousClose : 0

	return { price, previousClose }
}

function epochSecondsToDate(epochSec: number): string {
	return new Date(epochSec * 1000).toISOString().slice(0, 10)
}

export async function handleMarketQuotes(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url)
	const symbols = url.searchParams.get('symbols')

	if (!symbols) {
		return jsonError('Missing required parameter: symbols', 400)
	}

	try {
		const rawData = await fetchQuotes(env, { symbols })
		const result: Record<string, QuoteItem> = {}
		for (const [symbol, entry] of Object.entries(rawData)) {
			const item = extractQuoteItem(entry)
			if (item) {
				result[symbol] = item
			}
		}
		return jsonResponse(result)
	} catch (error) {
		if (error instanceof MarketApiError) {
			return jsonError(error.message, error.status)
		}
		return jsonError('Unexpected worker error', 500)
	}
}

export async function handleMarketHistory(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url)
	const symbol = url.searchParams.get('symbol')
	const range = url.searchParams.get('range') ?? 'max'

	if (!symbol) {
		return jsonError('Missing required parameter: symbol', 400)
	}

	try {
		const data = await fetchPriceHistory(env, { symbol, range })
		const result: HistoryResponse = {
			symbol: data.symbol,
			candles: data.candles.map((c: { datetime: number; open: number; high: number; low: number; close: number; volume: number }) => ({
				date: epochSecondsToDate(c.datetime),
				open: c.open,
				high: c.high,
				low: c.low,
				close: c.close,
				volume: c.volume,
			})),
		}
		return jsonResponse(result)
	} catch (error) {
		if (error instanceof MarketApiError) {
			return jsonError(error.message, error.status)
		}
		return jsonError('Unexpected worker error', 500)
	}
}
