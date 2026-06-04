import type { SchwabTokenResponse, WorkerEnv } from '../types/auth'

const DEFAULT_AUTH_URL = 'https://api.schwabapi.com/v1/oauth/authorize'
const DEFAULT_TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token'

interface RequestTokenParams {
	grantType: 'authorization_code' | 'refresh_token'
	code?: string
	redirectUri?: string
	refreshToken?: string
}

function getAuthUrl(env: WorkerEnv): string {
	return env.SCHWAB_AUTH_URL ?? DEFAULT_AUTH_URL
}

function getTokenUrl(env: WorkerEnv): string {
	return env.SCHWAB_TOKEN_URL ?? DEFAULT_TOKEN_URL
}

function getScope(env: WorkerEnv): string {
	return env.SCHWAB_SCOPE ?? 'readonly'
}

function buildBasicAuth(clientId: string, clientSecret: string): string {
	return `Basic ${btoa(`${clientId}:${clientSecret}`)}`
}

function readOptionalString(data: Record<string, unknown>, key: string): string | undefined {
	const value = data[key]
	return typeof value === 'string' ? value : undefined
}

function readOptionalNumber(data: Record<string, unknown>, key: string): number | undefined {
	const value = data[key]
	return typeof value === 'number' ? value : undefined
}

async function requestToken(env: WorkerEnv, params: RequestTokenParams): Promise<SchwabTokenResponse> {
	const body = new URLSearchParams()
	body.set('grant_type', params.grantType)

	if (params.grantType === 'authorization_code') {
		if (!params.code || !params.redirectUri) {
			throw new Error('Missing authorization code exchange parameters')
		}
		body.set('code', params.code)
		body.set('redirect_uri', params.redirectUri)
	}

	if (params.grantType === 'refresh_token') {
		if (!params.refreshToken) {
			throw new Error('Missing refresh token')
		}
		body.set('refresh_token', params.refreshToken)
	}

	const response = await fetch(getTokenUrl(env), {
		method: 'POST',
		headers: {
			authorization: buildBasicAuth(env.CLIENT_ID, env.CLIENT_SECRET),
			'content-type': 'application/x-www-form-urlencoded',
		},
		body,
	})

	if (!response.ok) {
		throw new Error('Token endpoint request failed')
	}

	const payload = await response.json()
	if (payload === null || typeof payload !== 'object') {
		throw new Error('Invalid token endpoint response')
	}

	const data = payload as Record<string, unknown>
	const accessToken = readOptionalString(data, 'access_token')
	const expiresIn = readOptionalNumber(data, 'expires_in')
	if (!accessToken || expiresIn === undefined) {
		throw new Error('Invalid token endpoint response')
	}

	const refreshToken = readOptionalString(data, 'refresh_token')
	if (params.grantType === 'authorization_code' && !refreshToken) {
		throw new Error('Missing refresh token in authorization response')
	}

	const normalized: SchwabTokenResponse = {
		access_token: accessToken,
		expires_in: expiresIn,
	}

	if (refreshToken !== undefined) {
		normalized.refresh_token = refreshToken
	}

	const refreshTokenExpiresIn = readOptionalNumber(data, 'refresh_token_expires_in')
	if (refreshTokenExpiresIn !== undefined) {
		normalized.refresh_token_expires_in = refreshTokenExpiresIn
	}

	const scope = readOptionalString(data, 'scope')
	if (scope !== undefined) {
		normalized.scope = scope
	}

	const tokenType = readOptionalString(data, 'token_type')
	if (tokenType !== undefined) {
		normalized.token_type = tokenType
	}

	return normalized
}

export function buildAuthorizeUrl(env: WorkerEnv, state: string, redirectUri: string): string {
	const url = new URL(getAuthUrl(env))
	url.searchParams.set('response_type', 'code')
	url.searchParams.set('client_id', env.CLIENT_ID)
	url.searchParams.set('redirect_uri', redirectUri)
	url.searchParams.set('scope', getScope(env))
	url.searchParams.set('state', state)
	return url.toString()
}

export async function exchangeCodeForTokens(env: WorkerEnv, code: string, redirectUri: string): Promise<SchwabTokenResponse> {
	return requestToken(env, {
		grantType: 'authorization_code',
		code,
		redirectUri,
	})
}

export async function refreshAccessToken(env: WorkerEnv, refreshToken: string): Promise<SchwabTokenResponse> {
	return requestToken(env, {
		grantType: 'refresh_token',
		refreshToken,
	})
}
