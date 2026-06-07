import { getEncryptedTokens } from './auth-kv.service'
import { decryptTokenEnvelope } from './token-crypto.service'
import type { WorkerEnv } from '../types/auth'
import type { SchwabPriceHistoryResponse } from '../types/market'
import { MarketApiError } from '../types/market'

const DEFAULT_API_BASE_URL = 'https://api.schwabapi.com'

function getApiBaseUrl(env: WorkerEnv): string {
	return (env.SCHWAB_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

async function getAccessToken(env: WorkerEnv): Promise<string> {
	const encrypted = await getEncryptedTokens(env)
	if (!encrypted) {
		throw new MarketApiError('Not connected', 401)
	}

	const envelope = await decryptTokenEnvelope(env, encrypted)
	if (!envelope.accessToken) {
		throw new MarketApiError('Not connected', 401)
	}

	if (new Date(envelope.accessTokenExpiresAt).getTime() <= Date.now()) {
		throw new MarketApiError('Access token expired', 401)
	}

	return envelope.accessToken
}

export interface FetchQuotesParams {
	symbols: string
	fields?: string
	indicative?: boolean
}

export interface FetchPriceHistoryParams {
	symbol: string
	periodType: 'day' | 'month' | 'year' | 'ytd'
	period?: number
	frequencyType?: 'minute' | 'daily' | 'weekly' | 'monthly'
	frequency?: number
	startDate?: number
	endDate?: number
	needExtendedHoursData?: boolean
	needPreviousClose?: boolean
}

export async function fetchQuotes(env: WorkerEnv, params: FetchQuotesParams, accessTokenOverride?: string): Promise<unknown> {
	const accessToken = accessTokenOverride ?? (await getAccessToken(env))
	const query = new URLSearchParams()
	query.set('symbols', params.symbols)
	if (params.fields) query.set('fields', params.fields)
	if (params.indicative !== undefined) query.set('indicative', String(params.indicative))

	const url = `${getApiBaseUrl(env)}/marketdata/v1/quotes?${query.toString()}`
	const response = await fetch(url, {
		headers: {
			authorization: `Bearer ${accessToken}`,
			accept: 'application/json',
		},
	})

	if (!response.ok) {
		throw new MarketApiError(`Market data API error: ${response.status}`, response.status)
	}

	return response.json()
}

export async function fetchPriceHistory(env: WorkerEnv, params: FetchPriceHistoryParams, accessTokenOverride?: string): Promise<SchwabPriceHistoryResponse> {
	const accessToken = accessTokenOverride ?? (await getAccessToken(env))
	const query = new URLSearchParams()
	query.set('symbol', params.symbol)
	query.set('periodType', params.periodType)
	if (params.period !== undefined) query.set('period', String(params.period))
	if (params.frequencyType) query.set('frequencyType', params.frequencyType)
	if (params.frequency !== undefined) query.set('frequency', String(params.frequency))
	if (params.startDate !== undefined) query.set('startDate', String(params.startDate))
	if (params.endDate !== undefined) query.set('endDate', String(params.endDate))
	if (params.needExtendedHoursData !== undefined) query.set('needExtendedHoursData', String(params.needExtendedHoursData))
	if (params.needPreviousClose !== undefined) query.set('needPreviousClose', String(params.needPreviousClose))

	const url = `${getApiBaseUrl(env)}/marketdata/v1/pricehistory?${query.toString()}`
	const response = await fetch(url, {
		headers: {
			authorization: `Bearer ${accessToken}`,
			accept: 'application/json',
		},
	})

	if (!response.ok) {
		throw new MarketApiError(`Market data API error: ${response.status}`, response.status)
	}

	return response.json()
}
