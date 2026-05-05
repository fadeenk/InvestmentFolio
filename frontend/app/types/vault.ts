import { Bank, AccountType, TransactionType, AssetType, CostBasisMethod } from './enums'

export interface Account {
  id: string
  bank: Bank
  type: AccountType
  name: string
  number: string
}

export interface Transaction {
  id: string
  accountId: string
  type: TransactionType
  assetType: AssetType
  symbol: string
  shares: number
  price: number
  date: string
}

export interface Position {
  id: string
  accountId: string
  symbol: string
  assetType: AssetType
  shares: number
  avgCost: number
  currentPrice: number
  costBasisMethod: CostBasisMethod
}

export interface PricePoint {
  date: string // ISO 8601 format (YYYY-MM-DD)
  value: number
}
