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
