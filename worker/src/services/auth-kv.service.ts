import type { OAuthStateRecord, WorkerEnv } from '../types/auth'

const SHARED_TOKEN_KEY = 'schwab:tokens:shared'
const STATE_PREFIX = 'schwab:oauth:state:'

export async function putOAuthState(
	env: WorkerEnv,
	state: string,
	payload: OAuthStateRecord,
	ttlSeconds: number,
): Promise<void> {
	await env.TOKENS.put(`${STATE_PREFIX}${state}`, JSON.stringify(payload), {
		expirationTtl: ttlSeconds,
	})
}

export async function consumeOAuthState(
	env: WorkerEnv,
	state: string,
): Promise<OAuthStateRecord | null> {
	const key = `${STATE_PREFIX}${state}`
	const raw = await env.TOKENS.get(key)

	if (raw === null) {
		return null
	}

	await env.TOKENS.delete(key)

	try {
		return JSON.parse(raw) as OAuthStateRecord
	} catch {
		return null
	}
}

export async function getEncryptedTokens(env: WorkerEnv): Promise<string | null> {
	return env.TOKENS.get(SHARED_TOKEN_KEY)
}

export async function putEncryptedTokens(env: WorkerEnv, record: string): Promise<void> {
	await env.TOKENS.put(SHARED_TOKEN_KEY, record)
}
