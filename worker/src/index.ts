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

function withAuthCors(request: Request, response: Response, env: Env): Response {
	if (!isCorsPath(new URL(request.url).pathname)) {
		return response
	}

	return withCors(request, response, env.FRONTEND_ORIGIN)
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url)
		const method = request.method.toUpperCase()

		if (method === 'OPTIONS' && isCorsPath(url.pathname)) {
			return corsPreflight(request, env.FRONTEND_ORIGIN)
		}

		// ── Auth routes ──────────────────────────────────────────────────────────

		if (url.pathname === '/auth/login') {
			if (method !== 'GET') {
				return withAuthCors(request, jsonError('Method not allowed', 405), env)
			}
			return withAuthCors(request, await handleAuthLogin(request, env), env)
		}

		if (url.pathname === '/auth/callback') {
			if (method !== 'GET') {
				return withAuthCors(request, jsonError('Method not allowed', 405), env)
			}
			return withAuthCors(request, await handleAuthCallback(request, env), env)
		}

		if (url.pathname === '/auth/refresh') {
			if (method !== 'POST') {
				return withAuthCors(request, jsonError('Method not allowed', 405), env)
			}
			return withAuthCors(request, await handleAuthRefresh(env), env)
		}

		if (url.pathname === '/auth/status') {
			if (method !== 'GET') {
				return withAuthCors(request, jsonError('Method not allowed', 405), env)
			}
			return withAuthCors(request, await handleAuthStatus(env), env)
		}
		// ── Simplified Market Data routes ──────────────────────────────────────────

		if (url.pathname === '/api/market/quotes') {
			if (method !== 'GET') {
				return withAuthCors(request, jsonError('Method not allowed', 405), env)
			}
			return withAuthCors(request, await handleMarketQuotes(request, env), env)
		}

		if (url.pathname === '/api/market/history') {
			if (method !== 'GET') {
				return withAuthCors(request, jsonError('Method not allowed', 405), env)
			}
			return withAuthCors(request, await handleMarketHistory(request, env), env)
		}

		return jsonError('Not found', 404)
	},
} satisfies ExportedHandler<Env>
