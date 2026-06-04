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
