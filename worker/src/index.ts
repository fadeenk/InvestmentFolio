import { handleMarketQuotes, handleMarketHistory } from './controllers/market.controller'
import { corsPreflight, jsonError, withCors } from './utils/http'

function isCorsPath(pathname: string): boolean {
	return pathname.startsWith('/api/')
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url)
		const method = request.method.toUpperCase()

		if (method === 'OPTIONS' && isCorsPath(url.pathname)) {
			return corsPreflight(request, env.FRONTEND_ORIGIN)
		}

		if (url.pathname === '/api/market/quotes') {
			if (method !== 'GET') {
				return withCors(request, jsonError('Method not allowed', 405), env.FRONTEND_ORIGIN)
			}
			return withCors(request, await handleMarketQuotes(request, env), env.FRONTEND_ORIGIN)
		}

		if (url.pathname === '/api/market/history') {
			if (method !== 'GET') {
				return withCors(request, jsonError('Method not allowed', 405), env.FRONTEND_ORIGIN)
			}
			return withCors(request, await handleMarketHistory(request, env), env.FRONTEND_ORIGIN)
		}

		return jsonError('Not found', 404)
	},
} satisfies ExportedHandler<Env>
