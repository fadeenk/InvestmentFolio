/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, vi } from 'vitest'
import worker from '../src/index'

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>

interface YahooQuoteMeta {
	regularMarketPrice: number
	previousClose: number
}

interface YahooQuoteResult {
	meta: YahooQuoteMeta
}

interface YahooQuoteResponse {
	chart: {
		result: YahooQuoteResult[]
	}
}

interface YahooIndicatorQuote {
	open: number[]
	high: number[]
	low: number[]
	close: number[]
	volume: number[]
}

interface YahooHistoryResult {
	timestamp: number[]
	indicators: {
		quote: YahooIndicatorQuote[]
	}
}

interface YahooHistoryResponse {
	chart: {
		result: YahooHistoryResult[]
	}
}

const MOCK_YAHOO_QUOTE: YahooQuoteResponse = {
	chart: {
		result: [
			{
				meta: {
					regularMarketPrice: 175.5,
					previousClose: 170.0,
				},
			},
		],
	},
}

const MOCK_YAHOO_HISTORY: YahooHistoryResponse = {
	chart: {
		result: [
			{
				timestamp: [1700000000, 1700086400],
				indicators: {
					quote: [
						{
							open: [150, 151],
							high: [152, 153],
							low: [149.5, 150.5],
							close: [151, 152],
							volume: [1000000, 1100000],
						},
					],
				},
			},
		],
	},
}

function createEnv(overrides: Partial<{ FRONTEND_ORIGIN: string }> = {}): unknown {
	return {
		FRONTEND_ORIGIN: overrides.FRONTEND_ORIGIN ?? 'http://localhost:3000',
	}
}

function urlFromFetchInput(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input
	if (input instanceof URL) return input.href
	return input.url
}

describe('market data worker', () => {
	it('returns 400 for /api/market/quotes when symbols parameter is missing', async () => {
		const request = new IncomingRequest('http://example.com/api/market/quotes')
		const env = createEnv() as Env
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ error: 'Missing required parameter: symbols' })
	})

	it('proxies /api/market/quotes to Yahoo and returns simplified response', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
			const url = urlFromFetchInput(input)
			if (url.includes('query1.finance.yahoo.com') && url.includes('AAPL')) {
				return new Response(JSON.stringify(MOCK_YAHOO_QUOTE), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				})
			}
			if (url.includes('query1.finance.yahoo.com') && url.includes('MSFT')) {
				return new Response(JSON.stringify(MOCK_YAHOO_QUOTE), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				})
			}
			throw new Error(`Unexpected fetch URL: ${url}`)
		})

		try {
			const request = new IncomingRequest('http://example.com/api/market/quotes?symbols=AAPL,MSFT')
			const env = createEnv() as Env
			const response = await worker.fetch(request, env)

			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({
				AAPL: { price: 175.5, previousClose: 170.0 },
				MSFT: { price: 175.5, previousClose: 170.0 },
			})
		} finally {
			vi.restoreAllMocks()
		}
	})

	it('returns 400 for /api/market/history when symbol parameter is missing', async () => {
		const request = new IncomingRequest('http://example.com/api/market/history')
		const env = createEnv() as Env
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ error: 'Missing required parameter: symbol' })
	})

	it('proxies /api/market/history to Yahoo and returns simplified response', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
			const url = urlFromFetchInput(input)
			if (url.includes('query1.finance.yahoo.com') && url.includes('AAPL') && url.includes('range=5y')) {
				return new Response(JSON.stringify(MOCK_YAHOO_HISTORY), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				})
			}
			throw new Error(`Unexpected fetch URL: ${url}`)
		})

		try {
			const request = new IncomingRequest('http://example.com/api/market/history?symbol=AAPL&range=5y')
			const env = createEnv() as Env
			const response = await worker.fetch(request, env)

			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({
				symbol: 'AAPL',
				candles: [
					{ date: '2023-11-14', open: 150, high: 152, low: 149.5, close: 151, volume: 1000000 },
					{ date: '2023-11-15', open: 151, high: 153, low: 150.5, close: 152, volume: 1100000 },
				],
			})
		} finally {
			vi.restoreAllMocks()
		}
	})

	it('returns 404 for unknown routes', async () => {
		const request = new IncomingRequest('http://example.com/unknown')
		const env = createEnv() as Env
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(404)
		expect(await response.json()).toEqual({ error: 'Not found' })
	})

	it('adds CORS headers to market data API responses', async () => {
		const request = new IncomingRequest('http://example.com/api/market/quotes?symbols=AAPL', {
			headers: { Origin: 'http://localhost:3000' },
		})
		const env = createEnv() as Env
		const response = await worker.fetch(request, env)

		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
	})

	it('handles API preflight requests with CORS headers', async () => {
		const request = new IncomingRequest('http://example.com/api/market/quotes', {
			method: 'OPTIONS',
			headers: { Origin: 'http://localhost:3000' },
		})
		const env = createEnv() as Env
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(204)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
	})

	it('accepts CORS from any origin in FRONTEND_ORIGIN list', async () => {
		const preflight = await worker.fetch(
			new IncomingRequest('http://example.com/api/market/quotes', {
				method: 'OPTIONS',
				headers: { Origin: 'https://folio.example.com' },
			}),
			createEnv({ FRONTEND_ORIGIN: 'http://localhost:3000,https://folio.example.com' }) as Env,
		)
		expect(preflight.status).toBe(204)
		expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://folio.example.com')

		const response = await worker.fetch(
			new IncomingRequest('http://example.com/api/market/quotes?symbols=AAPL', {
				headers: { Origin: 'https://folio.example.com' },
			}),
			createEnv({ FRONTEND_ORIGIN: 'http://localhost:3000,https://folio.example.com' }) as Env,
		)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://folio.example.com')
	})

	it('falls back to first origin when no Origin header is present', async () => {
		const env = createEnv({ FRONTEND_ORIGIN: 'http://localhost:3000,https://folio.example.com' }) as Env
		const response = await worker.fetch(new IncomingRequest('http://example.com/api/market/quotes?symbols=AAPL'), env)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
	})
})
