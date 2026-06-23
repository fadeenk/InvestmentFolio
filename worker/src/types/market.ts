export interface WorkerErrorResponse {
	error: string
	code: number
	retryAfter?: number
}

export class MarketApiError extends Error {
	status: number
	retryAfter: number | undefined

	constructor(message: string, status: number, retryAfter?: number) {
		super(message)
		this.status = status
		this.retryAfter = retryAfter
	}
}
