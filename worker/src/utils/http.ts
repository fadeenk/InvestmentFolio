export function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
		},
	})
}

export function jsonError(message: string, status = 400, retryAfter?: number): Response {
	const body: Record<string, unknown> = { error: message }
	if (retryAfter !== undefined) body.retryAfter = retryAfter
	return jsonResponse(body, status)
}

export function redirectResponse(location: string, status = 302): Response {
	return new Response(null, {
		status,
		headers: {
			location,
		},
	})
}

const CORS_ALLOWED_METHODS = 'GET,POST,OPTIONS'
const CORS_ALLOWED_HEADERS = 'Content-Type,Authorization'

function resolveCorsOrigin(request: Request, frontendOrigin: string): string {
	const requestOrigin = request.headers.get('Origin')
	const list = frontendOrigin.split(',').map((s) => s.trim())

	if (requestOrigin && list.includes(requestOrigin)) return requestOrigin

	return list[0] ?? ''
}

export function withCors(request: Request, response: Response, frontendOrigin: string): Response {
	const headers = new Headers(response.headers)
	headers.set('Access-Control-Allow-Origin', resolveCorsOrigin(request, frontendOrigin))
	headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS)
	headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS)
	headers.set('Vary', 'Origin')

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

export function corsPreflight(request: Request, frontendOrigin: string): Response {
	return withCors(request, new Response(null, { status: 204 }), frontendOrigin)
}
