import { describe, it, expect } from 'vitest'
import worker from '../src/index'

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>

interface KvPutOptions {
	expirationTtl?: number
}

class InMemoryKv {
	private readonly store = new Map<string, string>()

	get(key: string): Promise<string | null> {
		return Promise.resolve(this.store.get(key) ?? null)
	}

	put(key: string, value: string, options?: KvPutOptions): Promise<void> {
		void options
		this.store.set(key, value)
		return Promise.resolve()
	}

	delete(key: string): Promise<void> {
		this.store.delete(key)
		return Promise.resolve()
	}
}

interface TestEnv {
	TOKENS: InMemoryKv
	CLIENT_ID: string
	CLIENT_SECRET: string
	TOKEN_ENCRYPTION_KEY: string
	SCHWAB_API_BASE_URL: string
	SCHWAB_REDIRECT_URI: string
	SCHWAB_AUTH_URL: string
	SCHWAB_TOKEN_URL: string
	SCHWAB_SCOPE: string
	FRONTEND_ORIGIN: string
}

function createEnv(overrides: Partial<TestEnv> = {}): TestEnv {
	return {
		TOKENS: new InMemoryKv(),
		CLIENT_ID: 'test-client-id',
		CLIENT_SECRET: 'test-client-secret',
		TOKEN_ENCRYPTION_KEY: 'token-key-for-tests',
		SCHWAB_API_BASE_URL: 'https://example.schwab.test',
		SCHWAB_REDIRECT_URI: 'http://localhost:8787/auth/callback',
		SCHWAB_AUTH_URL: 'https://example.schwab.test/oauth/authorize',
		SCHWAB_TOKEN_URL: 'https://example.schwab.test/oauth/token',
		SCHWAB_SCOPE: 'readonly',
		FRONTEND_ORIGIN: 'http://localhost:3000',
		...overrides,
	}
}

async function putEncryptedTestTokens(
	env: TestEnv,
	overrides: Partial<{
		accessToken: string
		refreshToken: string
		accessTokenExpiresAt: string
		refreshTokenExpiresAt: string | null
		tokenType: string
		scope: string
		lastRefreshedAt: string
		connectedAccountCount: number
	}> = {},
): Promise<void> {
	const now = new Date().toISOString()
	const plaintext = {
		accessToken: 'worker-access-token',
		refreshToken: 'worker-refresh-token',
		accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
		refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		tokenType: 'Bearer',
		scope: 'readonly',
		lastRefreshedAt: now,
		connectedAccountCount: 0,
		...overrides,
	}

	const keySeed = new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY)
	const digest = await crypto.subtle.digest('SHA-256', keySeed)
	const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const encoded = new TextEncoder().encode(JSON.stringify(plaintext))
	const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded))

	const toBase64Url = (bytes: Uint8Array): string => {
		let binary = ''
		for (let i = 0; i < bytes.length; i += 1) {
			binary += String.fromCharCode(bytes[i])
		}
		return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
	}

	const encryptedRecord = JSON.stringify({
		v: 1,
		alg: 'A256GCM',
		iv: toBase64Url(iv),
		ct: toBase64Url(ciphertext),
		createdAt: now,
	})

	await env.TOKENS.put('schwab:tokens:shared', encryptedRecord)
}

describe('auth worker', () => {
	it('redirects to Schwab consent page for /auth/login', async () => {
		const request = new IncomingRequest('http://example.com/auth/login')
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(302)
		const location = response.headers.get('location')
		expect(location).toBeTruthy()
		expect(location).toContain('response_type=code')
		expect(location).toContain('client_id=test-client-id')
		expect(location).toContain('scope=readonly')
	})

	it('redirects callback failures to frontend with error query params', async () => {
		const request = new IncomingRequest('http://example.com/auth/callback')
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(302)
		const location = response.headers.get('location')
		expect(location).toContain('auth=error')
		expect(location).toContain('reason=Missing+required+callback+parameters')
	})

	it('refreshes tokens via /auth/refresh and updates stored payload', async () => {
		const env = createEnv()

		const originalFetch = globalThis.fetch
		globalThis.fetch = (input: RequestInfo | URL) => {
			const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
			if (requestUrl.includes('/oauth/token')) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							access_token: 'fresh-access-token',
							expires_in: 3600,
							refresh_token: 'fresh-refresh-token',
							token_type: 'Bearer',
							scope: 'readonly',
						}),
						{ status: 200, headers: { 'content-type': 'application/json' } },
					),
				)
			}

			throw new Error('Unexpected fetch URL in test')
		}

		try {
			const now = new Date().toISOString()
			const plaintext = {
				accessToken: 'old-access-token',
				refreshToken: 'old-refresh-token',
				accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
				refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
				tokenType: 'Bearer',
				scope: 'readonly',
				lastRefreshedAt: now,
				connectedAccountCount: 0,
			}

			const keySeed = new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY)
			const digest = await crypto.subtle.digest('SHA-256', keySeed)
			const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
			const iv = crypto.getRandomValues(new Uint8Array(12))
			const encoded = new TextEncoder().encode(JSON.stringify(plaintext))
			const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded))

			const toBase64Url = (bytes: Uint8Array): string => {
				let binary = ''
				for (let i = 0; i < bytes.length; i += 1) {
					binary += String.fromCharCode(bytes[i])
				}
				return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
			}

			const encryptedRecord = JSON.stringify({
				v: 1,
				alg: 'A256GCM',
				iv: toBase64Url(iv),
				ct: toBase64Url(ciphertext),
				createdAt: now,
			})

			await env.TOKENS.put('schwab:tokens:shared', encryptedRecord)

			const request = new IncomingRequest('http://example.com/auth/refresh', {
				method: 'POST',
			})
			const response = await worker.fetch(request, env)

			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body.success).toBe(true)
			expect(typeof body.accessTokenExpiresAt).toBe('string')
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('returns 404 for unknown routes', async () => {
		const request = new IncomingRequest('http://example.com/unknown')
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(404)
		expect(await response.json()).toEqual({ error: 'Not found' })
	})

	it('handles auth preflight requests with CORS headers', async () => {
		const request = new IncomingRequest('http://example.com/auth/status', {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:3000',
			},
		})
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(204)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
	})

	it('returns enriched auth status payload with expiry metadata', async () => {
		const env = createEnv()
		await putEncryptedTestTokens(env, {
			connectedAccountCount: 0,
			refreshTokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60_000).toISOString(),
		})

		const request = new IncomingRequest('http://example.com/auth/status')
		const response = await worker.fetch(request, env)
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body.isConnected).toBe(true)
		expect(typeof body.accessTokenExpiresAt).toBe('string')
		expect(typeof body.refreshTokenExpiresAt).toBe('string')
		expect(typeof body.accessTokenSecondsRemaining).toBe('number')
		expect(typeof body.refreshTokenSecondsRemaining).toBe('number')
		expect(body.isRefreshTokenExpiringSoon).toBe(false)
		expect(body.warning).toBeNull()
	})

	it('flags refresh-token expiry warning within 24 hours', async () => {
		const env = createEnv()
		await putEncryptedTestTokens(env, {
			refreshTokenExpiresAt: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
		})

		const request = new IncomingRequest('http://example.com/auth/status')
		const response = await worker.fetch(request, env)
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body.isConnected).toBe(true)
		expect(body.isRefreshTokenExpiringSoon).toBe(true)
		expect(body.warning).toContain('24 hours')
	})

	it('adds CORS headers to auth responses', async () => {
		const request = new IncomingRequest('http://example.com/auth/status', {
			headers: {
				Origin: 'http://localhost:3000',
			},
		})
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(200)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
	})

	it('returns 401 for /api/market/quotes when no token is connected', async () => {
		const request = new IncomingRequest('http://example.com/api/market/quotes?symbols=AAPL')
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(401)
		expect(await response.json()).toEqual({ error: 'Not connected' })
	})

	it('returns 400 for /api/market/quotes when symbols parameter is missing', async () => {
		const request = new IncomingRequest('http://example.com/api/market/quotes')
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ error: 'Missing required parameter: symbols' })
	})

	it('proxies /api/market/quotes to Schwab and returns simplified response', async () => {
		const env = createEnv()
		await putEncryptedTestTokens(env)

		const originalFetch = globalThis.fetch
		globalThis.fetch = (input: RequestInfo | URL) => {
			const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
			if (requestUrl.includes('/marketdata/v1/quotes') && requestUrl.includes('symbols=AAPL%2CMSFT')) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							AAPL: { quote: { lastPrice: 175.5, closePrice: 170.0 } },
							MSFT: { quote: { lastPrice: 410.2, closePrice: 405.0 } },
						}),
						{ status: 200, headers: { 'content-type': 'application/json' } },
					),
				)
			}

			throw new Error(`Unexpected fetch URL in test: ${requestUrl}`)
		}

		try {
			const request = new IncomingRequest('http://example.com/api/market/quotes?symbols=AAPL,MSFT')
			const response = await worker.fetch(request, env)

			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({
				AAPL: { price: 175.5, previousClose: 170.0 },
				MSFT: { price: 410.2, previousClose: 405.0 },
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('returns 401 for /api/market/history when no token is connected', async () => {
		const request = new IncomingRequest('http://example.com/api/market/history?symbol=AAPL')
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(401)
		expect(await response.json()).toEqual({ error: 'Not connected' })
	})

	it('returns 400 for /api/market/history when symbol parameter is missing', async () => {
		const request = new IncomingRequest('http://example.com/api/market/history')
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ error: 'Missing required parameter: symbol' })
	})

	it('proxies /api/market/history to Schwab and returns simplified response', async () => {
		const env = createEnv()
		await putEncryptedTestTokens(env)

		const originalFetch = globalThis.fetch
		globalThis.fetch = (input: RequestInfo | URL) => {
			const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
			if (
				requestUrl.includes('/marketdata/v1/pricehistory') &&
				requestUrl.includes('symbol=AAPL') &&
				requestUrl.includes('periodType=year') &&
				requestUrl.includes('period=5')
			) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							candles: [
								{ datetime: 1678886400000, open: 150, high: 152, low: 149.5, close: 151, volume: 1000000 },
								{ datetime: 1678972800000, open: 151, high: 153, low: 150.5, close: 152, volume: 1100000 },
							],
							symbol: 'AAPL',
							empty: false,
						}),
						{ status: 200, headers: { 'content-type': 'application/json' } },
					),
				)
			}

			throw new Error(`Unexpected fetch URL in test: ${requestUrl}`)
		}

		try {
			const request = new IncomingRequest('http://example.com/api/market/history?symbol=AAPL')
			const response = await worker.fetch(request, env)

			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({
				symbol: 'AAPL',
				candles: [
					{ date: '2023-03-15', open: 150, high: 152, low: 149.5, close: 151, volume: 1000000 },
					{ date: '2023-03-16', open: 151, high: 153, low: 150.5, close: 152, volume: 1100000 },
				],
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('adds CORS headers to market data API responses', async () => {
		const request = new IncomingRequest('http://example.com/api/market/quotes?symbols=AAPL', {
			headers: {
				Origin: 'http://localhost:3000',
			},
		})
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(401)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
	})

	it('handles API preflight requests with CORS headers', async () => {
		const request = new IncomingRequest('http://example.com/api/market/quotes', {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:3000',
			},
		})
		const env = createEnv()
		const response = await worker.fetch(request, env)

		expect(response.status).toBe(204)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
	})

	it('accepts CORS from any origin in FRONTEND_ORIGIN list', async () => {
		const env = createEnv({ FRONTEND_ORIGIN: 'http://localhost:3000,https://folio.example.com' })

		const preflight = await worker.fetch(
			new IncomingRequest('http://example.com/auth/status', {
				method: 'OPTIONS',
				headers: { Origin: 'https://folio.example.com' },
			}),
			env,
		)
		expect(preflight.status).toBe(204)
		expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://folio.example.com')

		const response = await worker.fetch(
			new IncomingRequest('http://example.com/auth/status', {
				headers: { Origin: 'https://folio.example.com' },
			}),
			env,
		)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://folio.example.com')
	})

	it('falls back to first origin when no Origin header is present', async () => {
		const env = createEnv({ FRONTEND_ORIGIN: 'http://localhost:3000,https://folio.example.com' })

		const response = await worker.fetch(new IncomingRequest('http://example.com/auth/status'), env)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
	})
})
