import { getEncryptedTokens } from './auth-kv.service'
import { decryptTokenEnvelope } from './token-crypto.service'
import type { WorkerEnv } from '../types/auth'
import type { SchwabAccountNumbersResponse, SchwabAccountsResponse, SchwabTransactionsResponse } from '../types/trader'

const DEFAULT_API_BASE_URL = 'https://api.schwabapi.com'

function getApiBaseUrl(env: WorkerEnv): string {
	return (env.SCHWAB_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

export class TraderApiError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.status = status
	}
}

async function getAccessToken(env: WorkerEnv): Promise<string> {
	const encrypted = await getEncryptedTokens(env)
	if (!encrypted) {
		throw new TraderApiError('Not connected', 401)
	}

	const envelope = await decryptTokenEnvelope(env, encrypted)
	if (!envelope.accessToken) {
		throw new TraderApiError('Not connected', 401)
	}

	if (new Date(envelope.accessTokenExpiresAt).getTime() <= Date.now()) {
		throw new TraderApiError('Access token expired', 401)
	}

	return envelope.accessToken
}

async function fetchTraderJson(env: WorkerEnv, path: string, accessTokenOverride?: string): Promise<unknown> {
	const accessToken = accessTokenOverride ?? (await getAccessToken(env))
	const response = await fetch(`${getApiBaseUrl(env)}${path}`, {
		headers: {
			authorization: `Bearer ${accessToken}`,
			accept: 'application/json',
		},
	})

	if (!response.ok) {
		throw new TraderApiError(`Trader API error: ${response.status}`, response.status)
	}

	return response.json()
}

function normalizeAccountsPayload(payload: unknown): SchwabAccountsResponse {
	if (Array.isArray(payload)) {
		return { accounts: payload as SchwabAccountsResponse['accounts'] }
	}

	if (payload && typeof payload === 'object') {
		const record = payload as Record<string, unknown>
		if (Array.isArray(record.accounts)) {
			return { accounts: record.accounts as SchwabAccountsResponse['accounts'] }
		}
	}

	throw new TraderApiError('Invalid accounts response shape', 502)
}

function normalizeTransactionsPayload(payload: unknown): SchwabTransactionsResponse {
	if (Array.isArray(payload)) {
		return { transactions: payload as SchwabTransactionsResponse['transactions'] }
	}

	if (payload && typeof payload === 'object') {
		const record = payload as Record<string, unknown>
		if (Array.isArray(record.transactions)) {
			return { transactions: record.transactions as SchwabTransactionsResponse['transactions'] }
		}
	}

	throw new TraderApiError('Invalid transactions response shape', 502)
}

export async function fetchAccountNumbers(env: WorkerEnv, accessTokenOverride?: string): Promise<SchwabAccountNumbersResponse> {
	const payload = await fetchTraderJson(env, '/trader/v1/accounts/accountNumbers', accessTokenOverride)
	if (!Array.isArray(payload)) {
		throw new TraderApiError('Invalid account numbers response shape', 502)
	}

	return payload as SchwabAccountNumbersResponse
}

export async function fetchAccountsWithPositions(env: WorkerEnv, fields: string | null): Promise<SchwabAccountsResponse> {
	const query = new URLSearchParams()
	if (fields) {
		query.set('fields', fields)
	}

	const path = `/trader/v1/accounts${query.size > 0 ? `?${query.toString()}` : ''}`
	const payload = await fetchTraderJson(env, path)
	return normalizeAccountsPayload(payload)
}

export interface FetchAccountTransactionsParams {
	accountHash: string
	startDate: string | null
	endDate: string | null
	types: string | null
	symbol: string | null
}

const DEFAULT_TRANSACTION_TYPES =
	'TRADE,RECEIVE_AND_DELIVER,DIVIDEND_OR_INTEREST,ACH_RECEIPT,ACH_DISBURSEMENT,CASH_RECEIPT,CASH_DISBURSEMENT,ELECTRONIC_FUND,WIRE_OUT,WIRE_IN,JOURNAL,MEMORANDUM,MARGIN_CALL,MONEY_MARKET,SMA_ADJUSTMENT'

export async function fetchAccountTransactions(env: WorkerEnv, params: FetchAccountTransactionsParams): Promise<SchwabTransactionsResponse> {
	const effectiveEndDate = params.endDate ?? new Date().toISOString()
	const effectiveStartDate = params.startDate ?? new Date(new Date(effectiveEndDate).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()

	const query = new URLSearchParams()
	query.set('startDate', effectiveStartDate)
	query.set('endDate', effectiveEndDate)

	if (!Number.isFinite(new Date(effectiveStartDate).getTime()) || !Number.isFinite(new Date(effectiveEndDate).getTime())) {
		throw new TraderApiError('Invalid startDate or endDate format', 400)
	}

	if (params.symbol) {
		query.set('symbol', params.symbol)
	}

	query.set('types', params.types ?? DEFAULT_TRANSACTION_TYPES)

	const startMs = new Date(effectiveStartDate).getTime()
	const endMs = new Date(effectiveEndDate).getTime()
	if (endMs <= startMs) {
		throw new TraderApiError('endDate must be after startDate', 400)
	}

	const oneYearMs = 365 * 24 * 60 * 60 * 1000
	if (endMs - startMs > oneYearMs) {
		throw new TraderApiError('startDate and endDate must be within 1 year', 400)
	}

	const path = `/trader/v1/accounts/${encodeURIComponent(params.accountHash)}/transactions${query.size > 0 ? `?${query.toString()}` : ''}`
	const payload = await fetchTraderJson(env, path)
	return normalizeTransactionsPayload(payload)
}
