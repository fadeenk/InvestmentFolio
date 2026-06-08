import { consumeOAuthState, getEncryptedTokens, putEncryptedTokens, putOAuthState } from '../services/auth-kv.service'
import { exchangeCodeForTokens, buildAuthorizeUrl, refreshAccessToken } from '../services/schwab-oauth.service'
import { decryptTokenEnvelope, encryptTokenEnvelope } from '../services/token-crypto.service'
import type { AuthStatusResponse, RefreshResponse, TokenEnvelope, WorkerEnv } from '../types/auth'
import { jsonResponse, redirectResponse } from '../utils/http'

const OAUTH_STATE_TTL_SECONDS = 600
const REFRESH_EXPIRY_WARNING_SECONDS = 86_400
const REFRESH_EXPIRY_WARNING_MESSAGE = 'Refresh token expires within 24 hours. Re-authorize soon to avoid interruptions.'

function addSecondsToIso(iso: string, seconds: number): string {
	const time = new Date(iso).getTime() + seconds * 1000
	return new Date(time).toISOString()
}

function parseIsoMs(iso: string | null | undefined): number | null {
	if (!iso) {
		return null
	}

	const parsed = Date.parse(iso)
	return Number.isFinite(parsed) ? parsed : null
}

function computeSecondsRemaining(expiryMs: number | null, nowMs: number): number | null {
	if (expiryMs === null) {
		return null
	}

	return Math.max(0, Math.floor((expiryMs - nowMs) / 1000))
}

function isRefreshTokenValidAt(envelope: TokenEnvelope, nowMs: number): boolean {
	const refreshExpiryMs = parseIsoMs(envelope.refreshTokenExpiresAt)
	return refreshExpiryMs === null || refreshExpiryMs > nowMs
}

function isAccessTokenValidAt(envelope: TokenEnvelope, nowMs: number): boolean {
	const accessExpiryMs = parseIsoMs(envelope.accessTokenExpiresAt)
	return accessExpiryMs !== null && accessExpiryMs > nowMs
}

function buildDisconnectedStatus(): AuthStatusResponse {
	return {
		isConnected: false,
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
		accessTokenSecondsRemaining: null,
		refreshTokenSecondsRemaining: null,
		isRefreshTokenExpiringSoon: false,
		warning: null,
		connectedAccountCount: 0,
		lastRefreshedAt: null,
	}
}

function buildStatusFromEnvelope(envelope: TokenEnvelope, connectedAccountCount: number): AuthStatusResponse {
	const nowMs = Date.now()
	const accessExpiryMs = parseIsoMs(envelope.accessTokenExpiresAt)
	const refreshExpiryMs = parseIsoMs(envelope.refreshTokenExpiresAt)
	const refreshSecondsRemaining = computeSecondsRemaining(refreshExpiryMs, nowMs)
	const isRefreshTokenExpiringSoon =
		refreshSecondsRemaining !== null && refreshSecondsRemaining <= REFRESH_EXPIRY_WARNING_SECONDS && refreshSecondsRemaining > 0

	return {
		isConnected: isRefreshTokenValidAt(envelope, nowMs),
		accessTokenExpiresAt: envelope.accessTokenExpiresAt,
		refreshTokenExpiresAt: envelope.refreshTokenExpiresAt,
		accessTokenSecondsRemaining: computeSecondsRemaining(accessExpiryMs, nowMs),
		refreshTokenSecondsRemaining: refreshSecondsRemaining,
		isRefreshTokenExpiringSoon,
		warning: isRefreshTokenExpiringSoon ? REFRESH_EXPIRY_WARNING_MESSAGE : null,
		connectedAccountCount,
		lastRefreshedAt: envelope.lastRefreshedAt,
	}
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
	return env.FRONTEND_ORIGIN?.split(',')[0]?.trim() ?? '/'
}

function buildFrontendRedirect(env: WorkerEnv, auth: 'connected' | 'error', frontendOrigin?: string, reason?: string): string {
	const target = new URL(frontendOrigin ?? getFrontendRedirect(env))
	target.searchParams.set('auth', auth)
	if (reason) {
		target.searchParams.set('reason', reason)
	}

	return target.toString()
}

async function refreshEnvelope(workerEnv: WorkerEnv, current: TokenEnvelope): Promise<TokenEnvelope> {
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
	return next
}

export async function handleAuthLogin(request: Request, env: WorkerEnv): Promise<Response> {
	const state = crypto.randomUUID()
	const callbackUrl = getCallbackUrl(request, env)
	const frontendOrigin = request.headers.get('Origin') ?? undefined

	await putOAuthState(
		env,
		state,
		{
			createdAt: new Date().toISOString(),
			redirectUri: callbackUrl,
			frontendOrigin,
		},
		OAUTH_STATE_TTL_SECONDS,
	)

	const consentUrl = buildAuthorizeUrl(env, state, callbackUrl)
	return redirectResponse(consentUrl)
}

export async function handleAuthCallback(request: Request, env: WorkerEnv): Promise<Response> {
	const url = new URL(request.url)
	const code = url.searchParams.get('code')
	const state = url.searchParams.get('state')
	const oauthError = url.searchParams.get('error')

	if (oauthError) {
		return redirectResponse(buildFrontendRedirect(env, 'error', undefined, 'Authorization was denied'))
	}

	if (!code || !state) {
		return redirectResponse(buildFrontendRedirect(env, 'error', undefined, 'Missing required callback parameters'))
	}

	const stateRecord = await consumeOAuthState(env, state)
	if (stateRecord === null) {
		return redirectResponse(buildFrontendRedirect(env, 'error', undefined, 'Invalid or expired authorization state'))
	}

	try {
		const tokenResult = await exchangeCodeForTokens(env, code, stateRecord.redirectUri)
		if (!tokenResult.refresh_token) {
			return redirectResponse(buildFrontendRedirect(env, 'error', stateRecord.frontendOrigin, 'Missing refresh token in callback response'))
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

		const encryptedRecord = await encryptTokenEnvelope(env, envelope)
		await putEncryptedTokens(env, encryptedRecord)

		return redirectResponse(buildFrontendRedirect(env, 'connected', stateRecord.frontendOrigin))
	} catch {
		return redirectResponse(buildFrontendRedirect(env, 'error', stateRecord.frontendOrigin, 'Failed to complete OAuth callback'))
	}
}

export async function handleAuthRefresh(env: WorkerEnv): Promise<Response> {
	const encrypted = await getEncryptedTokens(env)

	if (encrypted === null) {
		const payload: RefreshResponse = {
			success: false,
			error: 'No refresh token available',
		}
		return jsonResponse(payload, 401)
	}

	let current: TokenEnvelope
	try {
		current = await decryptTokenEnvelope(env, encrypted)
	} catch {
		const payload: RefreshResponse = {
			success: false,
			error: 'Stored token payload is invalid',
		}
		return jsonResponse(payload, 401)
	}

	try {
		const next = await refreshEnvelope(env, current)
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

export async function handleAuthStatus(env: WorkerEnv): Promise<Response> {
	const encrypted = await getEncryptedTokens(env)

	if (encrypted === null) {
		return jsonResponse(buildDisconnectedStatus())
	}

	try {
		let envelope = await decryptTokenEnvelope(env, encrypted)
		const nowMs = Date.now()
		if (!isRefreshTokenValidAt(envelope, nowMs)) {
			return jsonResponse(buildStatusFromEnvelope(envelope, 0))
		}

		if (!isAccessTokenValidAt(envelope, nowMs)) {
			try {
				envelope = await refreshEnvelope(env, envelope)
			} catch {
				// Keep status response non-blocking even if refresh attempt fails.
			}
		}

		return jsonResponse(buildStatusFromEnvelope(envelope, envelope.connectedAccountCount))
	} catch {
		return jsonResponse(buildDisconnectedStatus())
	}
}
