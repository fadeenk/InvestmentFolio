export function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
		},
	})
}

export function jsonError(message: string, status = 400): Response {
	return jsonResponse({ error: message }, status)
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
	if (!requestOrigin) {
		return frontendOrigin
	}

	if (!frontendOrigin || requestOrigin === frontendOrigin) {
		return requestOrigin
	}

	return frontendOrigin
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
