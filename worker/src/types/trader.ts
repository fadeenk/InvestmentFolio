export interface SchwabAccountNumberItem {
	accountNumber: string
	hashValue: string
}

export type SchwabAccountNumbersResponse = SchwabAccountNumberItem[]

export interface SchwabAccountsResponse {
	accounts: SchwabAccount[]
}

export interface SchwabAccount {
	securitiesAccount: Record<string, unknown>
}

export interface SchwabTransferItem {
	instrument?: Record<string, unknown>
	amount?: number
	cost?: number
	price?: number
	feeType?: string
	positionEffect?: string
}

export interface SchwabTransaction {
	activityId: number
	time: string
	description: string
	accountNumber: string
	type: string
	status: string
	subAccount: string
	tradeDate: string
	settlementDate?: string
	positionId?: number
	orderId?: number
	netAmount: number
	activityType: string
	transferItems: SchwabTransferItem[]
}

export interface SchwabTransactionsResponse {
	transactions: SchwabTransaction[]
}
