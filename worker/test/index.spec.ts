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

async function putEncryptedTestTokens(env: TestEnv): Promise<void> {
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
		const response = await worker.fetch(request, env as unknown as Env)

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
		const response = await worker.fetch(request, env as unknown as Env)

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
			const response = await worker.fetch(request, env as unknown as Env)

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
		const response = await worker.fetch(request, env as unknown as Env)

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
		const response = await worker.fetch(request, env as unknown as Env)

		expect(response.status).toBe(204)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
	})

	it('adds CORS headers to auth responses', async () => {
		const request = new IncomingRequest('http://example.com/auth/status', {
			headers: {
				Origin: 'http://localhost:3000',
			},
		})
		const env = createEnv()
		const response = await worker.fetch(request, env as unknown as Env)

		expect(response.status).toBe(200)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
	})

	it('returns 401 for /api/accountNumbers when no token is connected', async () => {
		const request = new IncomingRequest('http://example.com/api/accountNumbers')
		const env = createEnv()
		const response = await worker.fetch(request, env as unknown as Env)

		expect(response.status).toBe(401)
		expect(await response.json()).toEqual({ error: 'Not connected' })
	})

	it('proxies /api/accountNumbers to Schwab trader endpoint', async () => {
		const env = createEnv()
		await putEncryptedTestTokens(env)

		const originalFetch = globalThis.fetch
		globalThis.fetch = (input: RequestInfo | URL) => {
			const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
			if (requestUrl.includes('/trader/v1/accounts/accountNumbers')) {
				return Promise.resolve(
					new Response(JSON.stringify([{ accountNumber: '123456789', hashValue: 'hash-1' }]), {
						status: 200,
						headers: { 'content-type': 'application/json' },
					}),
				)
			}

			throw new Error('Unexpected fetch URL in test')
		}

		try {
			const request = new IncomingRequest('http://example.com/api/accountNumbers')
			const response = await worker.fetch(request, env as unknown as Env)

			expect(response.status).toBe(200)
			expect(await response.json()).toEqual([{ accountNumber: '123456789', hashValue: 'hash-1' }])
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('proxies /api/accounts?fields=positions and wraps array payload as {accounts}', async () => {
		const env = createEnv()
		await putEncryptedTestTokens(env)

		const originalFetch = globalThis.fetch
		globalThis.fetch = (input: RequestInfo | URL) => {
			const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
			if (requestUrl.includes('/trader/v1/accounts?fields=positions')) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{
								securitiesAccount: {
									accountNumber: '123456789',
									positions: [],
								},
							},
						]),
						{ status: 200, headers: { 'content-type': 'application/json' } },
					),
				)
			}

			throw new Error('Unexpected fetch URL in test')
		}

		try {
			const request = new IncomingRequest('http://example.com/api/accounts?fields=positions')
			const response = await worker.fetch(request, env as unknown as Env)

			expect(response.status).toBe(200)
			expect(await response.json()).toEqual({
				accounts: [
					{
						securitiesAccount: {
							accountNumber: '123456789',
							positions: [],
						},
					},
				],
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('proxies /api/accounts/{hash}/transactions with date query params', async () => {
		const env = createEnv()
		await putEncryptedTestTokens(env)

		const originalFetch = globalThis.fetch
		globalThis.fetch = (input: RequestInfo | URL) => {
			const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
			if (
				requestUrl.includes('/trader/v1/accounts/hash-123/transactions') &&
				requestUrl.includes('fromDate=2026-05-01T00%3A00%3A00.000Z') &&
				requestUrl.includes('toDate=2026-06-03T23%3A59%3A59.000Z')
			) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{
								activityId: 101,
								time: '2026-06-01T10:00:00.000Z',
								description: 'Dividend payment',
								accountNumber: '12345678',
								type: 'DIVIDEND_OR_INTEREST',
								status: 'VALID',
								subAccount: 'CASH',
								tradeDate: '2026-06-01',
								netAmount: 42.5,
								activityType: 'DIVIDEND_OR_INTEREST',
								transferItems: [],
							},
						]),
						{ status: 200, headers: { 'content-type': 'application/json' } },
					),
				)
			}

			throw new Error(`Unexpected fetch URL in test: ${requestUrl}`)
		}

		try {
			const request = new IncomingRequest(
				'http://example.com/api/accounts/hash-123/transactions?fromDate=2026-05-01T00:00:00.000Z&toDate=2026-06-03T23:59:59.000Z',
			)
			const response = await worker.fetch(request, env as unknown as Env)

			expect(response.status).toBe(200)
			expect(await response.json()).toEqual({
				transactions: [
					{
						activityId: 101,
						time: '2026-06-01T10:00:00.000Z',
						description: 'Dividend payment',
						accountNumber: '12345678',
						type: 'DIVIDEND_OR_INTEREST',
						status: 'VALID',
						subAccount: 'CASH',
						tradeDate: '2026-06-01',
						netAmount: 42.5,
						activityType: 'DIVIDEND_OR_INTEREST',
						transferItems: [],
					},
				],
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('returns 401 for /api/accounts/{hash}/transactions when no token is connected', async () => {
		const request = new IncomingRequest('http://example.com/api/accounts/hash-123/transactions')
		const env = createEnv()
		const response = await worker.fetch(request, env as unknown as Env)

		expect(response.status).toBe(401)
		expect(await response.json()).toEqual({ error: 'Not connected' })
	})

	it('handles API preflight requests with CORS headers', async () => {
		const request = new IncomingRequest('http://example.com/api/accounts', {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:3000',
			},
		})
		const env = createEnv()
		const response = await worker.fetch(request, env as unknown as Env)

		expect(response.status).toBe(204)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
	})
})
