import { fetchQuotes, fetchPriceHistory } from '../services/schwab-market.service'
import { MarketApiError } from '../types/market'
import type { WorkerEnv } from '../types/auth'
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

	const quote = obj.quote as Record<string, unknown> | undefined
	if (!quote) return null

	const previousClose = typeof quote.closePrice === 'number' ? quote.closePrice : 0

	let price = 0
	const regular = obj.regular as Record<string, unknown> | undefined
	if (regular && typeof regular.regularMarketLastPrice === 'number') {
		price = regular.regularMarketLastPrice
	} else if (typeof quote.lastPrice === 'number') {
		price = quote.lastPrice
	} else if (typeof quote.mark === 'number') {
		price = quote.mark
	} else if (typeof quote.closePrice === 'number') {
		price = quote.closePrice
	}

	return { price, previousClose }
}

function epochMsToDate(epochMs: number): string {
	return new Date(epochMs).toISOString().slice(0, 10)
}

export async function handleMarketQuotes(request: Request, env: WorkerEnv): Promise<Response> {
	const url = new URL(request.url)
	const symbols = url.searchParams.get('symbols')

	if (!symbols) {
		return jsonError('Missing required parameter: symbols', 400)
	}

	try {
		const rawData = await fetchQuotes(env, { symbols })
		const quotes = rawData as Record<string, unknown>

		const result: Record<string, QuoteItem> = {}
		for (const [symbol, entry] of Object.entries(quotes)) {
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

export async function handleMarketHistory(request: Request, env: WorkerEnv): Promise<Response> {
	const url = new URL(request.url)
	const symbol = url.searchParams.get('symbol')

	if (!symbol) {
		return jsonError('Missing required parameter: symbol', 400)
	}

	try {
		const data = await fetchPriceHistory(env, {
			symbol,
			periodType: 'year',
			period: 5,
			frequencyType: 'daily',
		})

		const result: HistoryResponse = {
			symbol: data.symbol,
			candles: data.candles.map((c) => ({
				date: epochMsToDate(c.datetime),
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
