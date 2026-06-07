import { handleAuthCallback, handleAuthLogin, handleAuthRefresh, handleAuthStatus } from './controllers/auth.controller'
import { handleMarketQuotes, handleMarketHistory } from './controllers/market.controller'
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
		// ── Simplified Market Data routes ──────────────────────────────────────────

		if (url.pathname === '/api/market/quotes') {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}
			return withAuthCors(request, env, await handleMarketQuotes(request, env))
		}

		if (url.pathname === '/api/market/history') {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}
			return withAuthCors(request, env, await handleMarketHistory(request, env))
		}

		return jsonError('Not found', 404)
	},
} satisfies ExportedHandler<Env>
