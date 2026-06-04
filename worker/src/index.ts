import { handleAuthCallback, handleAuthLogin, handleAuthRefresh, handleAuthStatus } from './controllers/auth.controller'
import { fetchAccountTransactions, fetchAccountNumbers, fetchAccountsWithPositions, TraderApiError } from './services/schwab-trader.service'
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

		if (url.pathname === '/api/accountNumbers') {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}

			try {
				return withAuthCors(
					request,
					env,
					new Response(JSON.stringify(await fetchAccountNumbers(env)), {
						status: 200,
						headers: {
							'content-type': 'application/json; charset=utf-8',
						},
					}),
				)
			} catch (error) {
				if (error instanceof TraderApiError) {
					return withAuthCors(request, env, jsonError(error.message, error.status))
				}
				return withAuthCors(request, env, jsonError('Unexpected worker error', 500))
			}
		}

		if (url.pathname === '/api/accounts') {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}

			try {
				const fields = url.searchParams.get('fields')
				return withAuthCors(
					request,
					env,
					new Response(JSON.stringify(await fetchAccountsWithPositions(env, fields)), {
						status: 200,
						headers: {
							'content-type': 'application/json; charset=utf-8',
						},
					}),
				)
			} catch (error) {
				if (error instanceof TraderApiError) {
					return withAuthCors(request, env, jsonError(error.message, error.status))
				}
				return withAuthCors(request, env, jsonError('Unexpected worker error', 500))
			}
		}

		const transactionsPathMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)\/transactions$/)
		if (transactionsPathMatch) {
			if (method !== 'GET') {
				return withAuthCors(request, env, jsonError('Method not allowed', 405))
			}

			try {
				const accountHash = decodeURIComponent(transactionsPathMatch[1] ?? '')
				if (!accountHash) {
					return withAuthCors(request, env, jsonError('Missing account hash', 400))
				}

				return withAuthCors(
					request,
					env,
					new Response(
						JSON.stringify(
							await fetchAccountTransactions(env, {
								accountHash,
								fromDate: url.searchParams.get('fromDate'),
								toDate: url.searchParams.get('toDate'),
								types: url.searchParams.get('types'),
							}),
						),
						{
							status: 200,
							headers: {
								'content-type': 'application/json; charset=utf-8',
							},
						},
					),
				)
			} catch (error) {
				if (error instanceof TraderApiError) {
					return withAuthCors(request, env, jsonError(error.message, error.status))
				}
				return withAuthCors(request, env, jsonError('Unexpected worker error', 500))
			}
		}

		return jsonError('Not found', 404)
	},
} satisfies ExportedHandler<Env>
