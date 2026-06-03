export interface WorkerEnv {
	TOKENS: KVNamespace
	CLIENT_ID: string
	CLIENT_SECRET: string
	TOKEN_ENCRYPTION_KEY: string
	SCHWAB_REDIRECT_URI?: string
	SCHWAB_AUTH_URL?: string
	SCHWAB_TOKEN_URL?: string
	SCHWAB_SCOPE?: string
	FRONTEND_ORIGIN?: string
}

export interface OAuthStateRecord {
	createdAt: string
	redirectUri: string
}

export interface SchwabTokenResponse {
	access_token: string
	expires_in: number
	refresh_token?: string
	refresh_token_expires_in?: number
	scope?: string
	token_type?: string
}

export interface TokenEnvelope {
	accessToken: string
	refreshToken: string
	accessTokenExpiresAt: string
	refreshTokenExpiresAt: string | null
	tokenType: string | null
	scope: string | null
	lastRefreshedAt: string
	connectedAccountCount: number
}

export interface EncryptedTokenRecord {
	v: 1
	alg: 'A256GCM'
	iv: string
	ct: string
	createdAt: string
}

export interface AuthStatusResponse {
	isConnected: boolean
	accessTokenExpiresAt: string | null
	refreshTokenExpiresAt: string | null
	connectedAccountCount: number
	lastRefreshedAt: string | null
}

export interface RefreshResponse {
	success: boolean
	accessTokenExpiresAt?: string
	error?: string
}
