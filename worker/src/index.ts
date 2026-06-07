import { handleAuthCallback, handleAuthLogin, handleAuthRefresh, handleAuthStatus } from './controllers/auth.controller'
import { fetchQuotes, fetchPriceHistory } from './services/schwab-market.service'
import { MarketApiError } from './types/market'
import { corsPreflight, jsonError, withCors } from './utils/http'

function isAuthPath(pathname: string): boolean {
	return pathname.startsWith('/auth/')
}

function isApiPath(pathname: string): boolean {
	return pathname.startsWith('/api/')
}

function isCorsPath(pathname: string): boolean {
	return isAuthPath(pathname) || isApiPath(pathname)
}

function withAuthCors(request: Request, env: Env, response: Response): Response {
	if (!isCorsPath(new URL(request.url).pathname)) {
		return response
	}

	return withCors(request, response, env.FRONTEND_ORIGIN ?? '')
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url)
		const method = request.method.toUpperCase()

		if (method === 'OPTIONS' && isCorsPath(url.pathname)) {
			return corsPreflight(request, env.FRONTEND_ORIGIN ?? '')
		}

		// ── Auth routes ──────────────────────────────────────────────────────────

		if (url.pathname === '/auth/login') {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}
			return withAuthCors(request, env, await handleAuthLogin(request, env))
		}

		if (url.pathname === '/auth/callback') {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}
			return withAuthCors(request, env, await handleAuthCallback(request, env))
		}

		if (url.pathname === '/auth/refresh') {
			if (method !== 'POST') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}
			return withAuthCors(request, env, await handleAuthRefresh(env))
		}

		if (url.pathname === '/auth/status') {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}
			return withAuthCors(request, env, await handleAuthStatus(env))
		}

		// ── Market Data API routes ───────────────────────────────────────────────

		if (url.pathname === '/api/quotes') {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}

			const symbols = url.searchParams.get('symbols')
			if (!symbols) {
				return withAuthCors(request, env, jsonError('Missing required parameter: symbols', 400))
			}

			try {
				const fields = url.searchParams.get('fields')
				const data = await fetchQuotes(env, {
					symbols,
					...(fields ? { fields } : {}),
				})
				return withAuthCors(
					request,
					env,
					new Response(JSON.stringify(data), {
						status: 200,
						headers: { 'content-type': 'application/json; charset=utf-8' },
					}),
				)
			} catch (error) {
				if (error instanceof MarketApiError) {
					return withAuthCors(request, env, jsonError(error.message, error.status))
				}
				return withAuthCors(request, env, jsonError('Unexpected worker error', 500))
			}
		}

		if (url.pathname === '/api/pricehistory') {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}

			const symbol = url.searchParams.get('symbol')
			const periodType = url.searchParams.get('periodType')
			if (!symbol || !periodType) {
				return withAuthCors(request, env, jsonError('Missing required parameters: symbol, periodType', 400))
			}

			if (!['day', 'month', 'year', 'ytd'].includes(periodType)) {
				return withAuthCors(request, env, jsonError('Invalid periodType. Must be day, month, year, or ytd', 400))
			}

			try {
				const periodStr = url.searchParams.get('period')
				const frequencyTypeStr = url.searchParams.get('frequencyType')
				const frequencyStr = url.searchParams.get('frequency')
				const startDateStr = url.searchParams.get('startDate')
				const endDateStr = url.searchParams.get('endDate')
				const needExtendedHoursData = url.searchParams.get('needExtendedHoursData')
				const needPreviousClose = url.searchParams.get('needPreviousClose')

				const data = await fetchPriceHistory(env, {
					symbol,
					periodType: periodType as 'day' | 'month' | 'year' | 'ytd',
					...(periodStr ? { period: Number(periodStr) } : {}),
					...(frequencyTypeStr ? { frequencyType: frequencyTypeStr as 'minute' | 'daily' | 'weekly' | 'monthly' } : {}),
					...(frequencyStr ? { frequency: Number(frequencyStr) } : {}),
					...(startDateStr ? { startDate: Number(startDateStr) } : {}),
					...(endDateStr ? { endDate: Number(endDateStr) } : {}),
					...(needExtendedHoursData === 'true' ? { needExtendedHoursData: true } : {}),
					...(needPreviousClose === 'true' ? { needPreviousClose: true } : {}),
				})
				return withAuthCors(
					request,
					env,
					new Response(JSON.stringify(data), {
						status: 200,
						headers: { 'content-type': 'application/json; charset=utf-8' },
					}),
				)
			} catch (error) {
				if (error instanceof MarketApiError) {
					return withAuthCors(request, env, jsonError(error.message, error.status))
				}
				return withAuthCors(request, env, jsonError('Unexpected worker error', 500))
			}
		}

		return jsonError('Not found', 404)
	},
} satisfies ExportedHandler<Env>
