export interface SchwabCandle {
	datetime: number
	open: number
	high: number
	low: number
	close: number
	volume: number
}

export interface SchwabPriceHistoryResponse {
	candles: SchwabCandle[]
	symbol: string
	empty: boolean
}

export interface WorkerErrorResponse {
	error: string
	code: number
	retryAfter?: number
}

export class MarketApiError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.status = status
	}
}
