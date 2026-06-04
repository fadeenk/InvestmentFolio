import { consumeOAuthState, getEncryptedTokens, putEncryptedTokens, putOAuthState } from '../services/auth-kv.service'
import { exchangeCodeForTokens, buildAuthorizeUrl, refreshAccessToken } from '../services/schwab-oauth.service'
import { decryptTokenEnvelope, encryptTokenEnvelope } from '../services/token-crypto.service'
import type { AuthStatusResponse, RefreshResponse, TokenEnvelope, WorkerEnv } from '../types/auth'
import { jsonResponse, redirectResponse } from '../utils/http'

const OAUTH_STATE_TTL_SECONDS = 600

function asWorkerEnv(env: Env): WorkerEnv {
	return env
}

function addSecondsToIso(iso: string, seconds: number): string {
	const time = new Date(iso).getTime() + seconds * 1000
	return new Date(time).toISOString()
}

function getCallbackUrl(request: Request, env: WorkerEnv): string {
	if (env.SCHWAB_REDIRECT_URI) {
		return env.SCHWAB_REDIRECT_URI
	}

	const requestUrl = new URL(request.url)
	requestUrl.pathname = '/auth/callback'
	requestUrl.search = ''
	requestUrl.hash = ''
	return requestUrl.toString()
}

function getFrontendRedirect(env: WorkerEnv): string {
	return env.FRONTEND_ORIGIN ?? '/'
}

function buildFrontendRedirect(env: WorkerEnv, auth: 'connected' | 'error', reason?: string): string {
	const target = new URL(getFrontendRedirect(env))
	target.searchParams.set('auth', auth)
	if (reason) {
		target.searchParams.set('reason', reason)
	}

	return target.toString()
}

function buildStatusFromEnvelope(envelope: TokenEnvelope): AuthStatusResponse {
	const now = Date.now()
	const accessExpiry = Date.parse(envelope.accessTokenExpiresAt)
	const refreshExpiry = envelope.refreshTokenExpiresAt ? Date.parse(envelope.refreshTokenExpiresAt) : null
	const refreshValid = refreshExpiry === null || refreshExpiry > now
	const accessValid = Number.isFinite(accessExpiry) && accessExpiry > now

	return {
		isConnected: accessValid && refreshValid,
		accessTokenExpiresAt: envelope.accessTokenExpiresAt,
		refreshTokenExpiresAt: envelope.refreshTokenExpiresAt,
		connectedAccountCount: envelope.connectedAccountCount,
		lastRefreshedAt: envelope.lastRefreshedAt,
	}
}

export async function handleAuthLogin(request: Request, env: Env): Promise<Response> {
	const workerEnv = asWorkerEnv(env)
	const state = crypto.randomUUID()
	const callbackUrl = getCallbackUrl(request, workerEnv)

	await putOAuthState(
		workerEnv,
		state,
		{
			createdAt: new Date().toISOString(),
			redirectUri: callbackUrl,
		},
		OAUTH_STATE_TTL_SECONDS,
	)

	const consentUrl = buildAuthorizeUrl(workerEnv, state, callbackUrl)
	return redirectResponse(consentUrl)
}

export async function handleAuthCallback(request: Request, env: Env): Promise<Response> {
	const workerEnv = asWorkerEnv(env)
	const url = new URL(request.url)
	const code = url.searchParams.get('code')
	const state = url.searchParams.get('state')
	const oauthError = url.searchParams.get('error')

	if (oauthError) {
		return redirectResponse(buildFrontendRedirect(workerEnv, 'error', 'Authorization was denied'))
	}

	if (!code || !state) {
		return redirectResponse(buildFrontendRedirect(workerEnv, 'error', 'Missing required callback parameters'))
	}

	const stateRecord = await consumeOAuthState(workerEnv, state)
	if (stateRecord === null) {
		return redirectResponse(buildFrontendRedirect(workerEnv, 'error', 'Invalid or expired authorization state'))
	}

	try {
		const tokenResult = await exchangeCodeForTokens(workerEnv, code, stateRecord.redirectUri)
		if (!tokenResult.refresh_token) {
			return redirectResponse(buildFrontendRedirect(workerEnv, 'error', 'Missing refresh token in callback response'))
		}

		const nowIso = new Date().toISOString()
		const envelope: TokenEnvelope = {
			accessToken: tokenResult.access_token,
			refreshToken: tokenResult.refresh_token,
			accessTokenExpiresAt: addSecondsToIso(nowIso, tokenResult.expires_in),
			refreshTokenExpiresAt: tokenResult.refresh_token_expires_in !== undefined ? addSecondsToIso(nowIso, tokenResult.refresh_token_expires_in) : null,
			tokenType: tokenResult.token_type ?? null,
			scope: tokenResult.scope ?? null,
			lastRefreshedAt: nowIso,
			connectedAccountCount: 0,
		}

		const encryptedRecord = await encryptTokenEnvelope(workerEnv, envelope)
		await putEncryptedTokens(workerEnv, encryptedRecord)

		return redirectResponse(buildFrontendRedirect(workerEnv, 'connected'))
	} catch {
		return redirectResponse(buildFrontendRedirect(workerEnv, 'error', 'Failed to complete OAuth callback'))
	}
}

export async function handleAuthRefresh(env: Env): Promise<Response> {
	const workerEnv = asWorkerEnv(env)
	const encrypted = await getEncryptedTokens(workerEnv)

	if (encrypted === null) {
		const payload: RefreshResponse = {
			success: false,
			error: 'No refresh token available',
		}
		return jsonResponse(payload, 401)
	}

	let current: TokenEnvelope
	try {
		current = await decryptTokenEnvelope(workerEnv, encrypted)
	} catch {
		const payload: RefreshResponse = {
			success: false,
			error: 'Stored token payload is invalid',
		}
		return jsonResponse(payload, 401)
	}

	try {
		const refreshed = await refreshAccessToken(workerEnv, current.refreshToken)
		const nowIso = new Date().toISOString()
		const next: TokenEnvelope = {
			accessToken: refreshed.access_token,
			refreshToken: refreshed.refresh_token ?? current.refreshToken,
			accessTokenExpiresAt: addSecondsToIso(nowIso, refreshed.expires_in),
			refreshTokenExpiresAt:
				refreshed.refresh_token_expires_in !== undefined ? addSecondsToIso(nowIso, refreshed.refresh_token_expires_in) : current.refreshTokenExpiresAt,
			tokenType: refreshed.token_type ?? current.tokenType,
			scope: refreshed.scope ?? current.scope,
			lastRefreshedAt: nowIso,
			connectedAccountCount: current.connectedAccountCount,
		}

		const encryptedNext = await encryptTokenEnvelope(workerEnv, next)
		await putEncryptedTokens(workerEnv, encryptedNext)

		const payload: RefreshResponse = {
			success: true,
			accessTokenExpiresAt: next.accessTokenExpiresAt,
		}
		return jsonResponse(payload)
	} catch {
		const payload: RefreshResponse = {
			success: false,
			error: 'Refresh token exchange failed',
		}
		return jsonResponse(payload, 401)
	}
}

export async function handleAuthStatus(env: Env): Promise<Response> {
	const workerEnv = asWorkerEnv(env)
	const encrypted = await getEncryptedTokens(workerEnv)

	if (encrypted === null) {
		const payload: AuthStatusResponse = {
			isConnected: false,
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null,
			connectedAccountCount: 0,
			lastRefreshedAt: null,
		}
		return jsonResponse(payload)
	}

	try {
		const envelope = await decryptTokenEnvelope(workerEnv, encrypted)
		return jsonResponse(buildStatusFromEnvelope(envelope))
	} catch {
		const payload: AuthStatusResponse = {
			isConnected: false,
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null,
			connectedAccountCount: 0,
			lastRefreshedAt: null,
		}
		return jsonResponse(payload)
	}
}
