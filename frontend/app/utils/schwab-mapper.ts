import type { AccountType, AssetType, CostBasisMethod, ImportSource, TransactionType } from '@/types/enums'
import {
  AccountType as AccountTypeEnum,
  AssetType as AssetTypeEnum,
  CostBasisMethod as CostBasisMethodEnum,
  ImportSource as ImportSourceEnum,
  TransactionType as TransactionTypeEnum,
} from '@/types/enums'
import type { Position, Transaction } from '@/types/vault'
import type {
  SchwabAccount,
  SchwabAccountsResponse,
  SchwabAccountNumbersResponse,
  SchwabAssetTypeRaw,
  SchwabPosition,
  SchwabSecuritiesAccount,
  SchwabTransaction,
  SchwabTransactionsResponse,
} from '@/types/schwab'

export interface SchwabMappedPositionDraft extends Omit<Position, 'id' | 'accountId'> {
  accountNumber: string
}

export interface SchwabMappedAccountDraft {
  accountNumber: string
  accountLast4: string
  accountHash: string | null
  displayName: string
  type: AccountType
  currentBalance: number
  cashBalance: number
  positions: SchwabMappedPositionDraft[]
}

export type SchwabMappedTransactionDraft = Omit<Transaction, 'id' | 'importedAt'>

export function buildSchwabHashMaps(items: SchwabAccountNumbersResponse): {
  byFullNumber: Record<string, string>
  byLast4: Record<string, string>
} {
  const byFullNumber: Record<string, string> = {}
  const byLast4: Record<string, string> = {}

  for (const item of items) {
    if (!item.accountNumber || !item.hashValue) continue
    byFullNumber[item.accountNumber] = item.hashValue
    byLast4[last4(item.accountNumber)] = item.hashValue
  }

  return { byFullNumber, byLast4 }
}

export function mapSchwabAccountsToVaultDrafts(
  response: SchwabAccountsResponse,
  hashByFullNumber: Record<string, string>,
  snapshotAt: string,
): SchwabMappedAccountDraft[] {
  return response.accounts
    .map((account) => mapAccount(account, hashByFullNumber, snapshotAt))
    .filter((mapped): mapped is SchwabMappedAccountDraft => mapped !== null)
}

export function mapSchwabTransactionsToVaultDrafts(response: SchwabTransactionsResponse, accountId: string): SchwabMappedTransactionDraft[] {
  return response.transactions.map((transaction) => mapTransaction(transaction, accountId))
}

function mapAccount(account: SchwabAccount, hashByFullNumber: Record<string, string>, snapshotAt: string): SchwabMappedAccountDraft | null {
  const securities = account.securitiesAccount as SchwabSecuritiesAccount
  if (!securities.accountNumber) {
    return null
  }

  const accountNumber = securities.accountNumber
  const accountLast4 = last4(accountNumber)
  const accountHash = hashByFullNumber[accountNumber] ?? null
  const current = securities.currentBalances

  const currentBalance = numberOrZero(current?.liquidationValue ?? current?.accountValue)
  const cashBalance = numberOrZero(current?.cashBalance ?? current?.totalCash)
  const type = mapAccountType(securities.type)

  const positions = (securities.positions ?? []).map((position) => mapPosition(position, accountNumber, snapshotAt))

  return {
    accountNumber,
    accountLast4,
    accountHash,
    displayName: `Schwab ${accountLast4}`,
    type,
    currentBalance,
    cashBalance,
    positions,
  }
}

function mapPosition(position: SchwabPosition, accountNumber: string, snapshotAt: string): SchwabMappedPositionDraft {
  const quantityRaw = numberOrZero(position.longQuantity) - numberOrZero(position.shortQuantity)
  const quantity = quantityRaw === 0 ? numberOrZero(position.longQuantity) : quantityRaw
  const marketValue = numberOrZero(position.marketValue)
  const avgCost = numberOrZero(position.taxLotAverageLongPrice || position.averageLongPrice || position.averagePrice)
  const currentPrice = quantity !== 0 ? marketValue / quantity : 0
  const dayGainLoss = numberOrZero(position.currentDayProfitLoss)
  const dayGainLossPct = numberOrZero(position.currentDayProfitLossPercentage)
  const openGainLoss = numberOrZero(position.longOpenProfitLoss) - numberOrZero(position.shortOpenProfitLoss)
  const costBasis = avgCost * quantity
  const unrealizedGainLoss = openGainLoss !== 0 ? openGainLoss : marketValue - costBasis
  const unrealizedGainLossPct = costBasis !== 0 ? (unrealizedGainLoss / costBasis) * 100 : 0

  return {
    accountNumber,
    symbol: position.instrument.symbol,
    assetType: mapAssetType(position.instrument.assetType),
    quantity,
    avgCost,
    currentPrice,
    marketValue,
    unrealizedGainLoss,
    unrealizedGainLossPct,
    dayGainLoss,
    dayGainLossPct,
    costBasisMethod: CostBasisMethodEnum.FIFO as CostBasisMethod,
    snapshotAt,
  }
}

function mapAccountType(raw: string): AccountType {
  switch (raw) {
    case 'CASH':
      return AccountTypeEnum.CASH
    case 'ROTH_IRA':
      return AccountTypeEnum.ROTH
    case 'IRA':
    case 'ROLLOVER_IRA':
      return AccountTypeEnum.TRADITIONAL
    case 'HSA':
      return AccountTypeEnum.HSA
    case 'MARGIN':
    default:
      return AccountTypeEnum.BROKERAGE
  }
}

function mapAssetType(raw: SchwabAssetTypeRaw): AssetType {
  switch (raw) {
    case 'EQUITY':
      return AssetTypeEnum.Stock
    case 'ETF':
      return AssetTypeEnum.ETF
    case 'MUTUAL_FUND':
      return AssetTypeEnum.MutualFund
    case 'CASH_EQUIVALENT':
    case 'CURRENCY':
      return AssetTypeEnum.Cash
    case 'FIXED_INCOME':
      return AssetTypeEnum.Bond
    default:
      return AssetTypeEnum.Stock
  }
}

function mapTransaction(transaction: SchwabTransaction, accountId: string): SchwabMappedTransactionDraft {
  const normalizedType = mapTransactionType(transaction)
  const transferItems = transaction.transferItems ?? []
  const primaryTransferItem = transferItems.find((item) => !!item.instrument?.symbol)
  const primaryInstrument = primaryTransferItem?.instrument
  const quantity = getTransactionQuantity(transaction)
  const price = getTransactionPrice(transaction)
  const fees = getTransactionFees(transaction)
  const importedDate = normalizeTransactionDate(transaction)

  return {
    externalId: String(transaction.activityId),
    accountId,
    type: normalizedType,
    assetType: mapInstrumentAssetType(primaryInstrument?.assetType),
    symbol: primaryInstrument?.symbol ?? 'CASH',
    description: transaction.description || transaction.activityType || 'Schwab transaction',
    quantity,
    price,
    date: importedDate,
    fees,
    importSource: ImportSourceEnum.SCHWAB_API as ImportSource,
    notes: null,
    matchedLotIds: [],
  }
}

function mapTransactionType(transaction: SchwabTransaction): TransactionType {
  const rawType = uppercaseOrEmpty(transaction.type)
  const rawActivity = uppercaseOrEmpty(transaction.activityType)
  const combined = `${rawType} ${rawActivity}`

  if (combined.includes('DIVIDEND')) {
    return TransactionTypeEnum.Dividend as TransactionType
  }

  if (combined.includes('INTEREST')) {
    return TransactionTypeEnum.Interest as TransactionType
  }

  if (combined.includes('SPLIT')) {
    return TransactionTypeEnum.Split as TransactionType
  }

  if (isLikelyBuy(transaction, combined)) {
    return TransactionTypeEnum.Buy as TransactionType
  }

  if (isLikelySell(transaction, combined)) {
    return TransactionTypeEnum.Sell as TransactionType
  }

  if (combined.includes('TRANSFER')) {
    return transaction.netAmount >= 0 ? (TransactionTypeEnum.TRANSFER_IN as TransactionType) : (TransactionTypeEnum.TRANSFER_OUT as TransactionType)
  }

  if (combined.includes('DEPOSIT') || combined.includes('RECEIPT') || combined.includes('CREDIT')) {
    return TransactionTypeEnum.DEPOSIT as TransactionType
  }

  if (combined.includes('WITHDRAW') || combined.includes('DISBURSEMENT') || combined.includes('DEBIT')) {
    return TransactionTypeEnum.WITHDRAWAL as TransactionType
  }

  return transaction.netAmount >= 0 ? (TransactionTypeEnum.DEPOSIT as TransactionType) : (TransactionTypeEnum.WITHDRAWAL as TransactionType)
}

function isLikelyBuy(transaction: SchwabTransaction, combined: string): boolean {
  if (combined.includes('BUY') || combined.includes('BTO') || combined.includes('BOT')) {
    return true
  }

  const openingTransfer = (transaction.transferItems ?? []).some((item) => item.positionEffect === 'OPENING' && numberOrZero(item.amount) > 0)
  return openingTransfer && transaction.netAmount < 0
}

function isLikelySell(transaction: SchwabTransaction, combined: string): boolean {
  if (combined.includes('SELL') || combined.includes('STC') || combined.includes('SLD')) {
    return true
  }

  const closingTransfer = (transaction.transferItems ?? []).some((item) => item.positionEffect === 'CLOSING' && numberOrZero(item.amount) > 0)
  return closingTransfer && transaction.netAmount > 0
}

function getTransactionQuantity(transaction: SchwabTransaction): number | null {
  const transferQuantity = (transaction.transferItems ?? []).reduce((sum, item) => {
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount)) {
      return sum
    }
    return sum + Math.abs(item.amount)
  }, 0)

  if (transferQuantity > 0) {
    return transferQuantity
  }

  return null
}

function getTransactionPrice(transaction: SchwabTransaction): number {
  const prices = (transaction.transferItems ?? [])
    .map((item) => item.price)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (prices.length === 0) {
    return 0
  }

  return prices.reduce((sum, value) => sum + value, 0) / prices.length
}

function getTransactionFees(transaction: SchwabTransaction): number {
  return (transaction.transferItems ?? []).reduce((sum, item) => {
    if (!item.feeType) {
      return sum
    }
    return sum + Math.abs(numberOrZero(item.cost))
  }, 0)
}

function normalizeTransactionDate(transaction: SchwabTransaction): string {
  if (transaction.tradeDate) {
    return transaction.tradeDate.slice(0, 10)
  }

  if (transaction.time) {
    return transaction.time.slice(0, 10)
  }

  return new Date().toISOString().slice(0, 10)
}

function mapInstrumentAssetType(raw: unknown): AssetType {
  if (!raw || typeof raw !== 'string') {
    return AssetTypeEnum.Cash as AssetType
  }

  return mapAssetType(raw as SchwabAssetTypeRaw)
}

function last4(accountNumber: string): string {
  return accountNumber.slice(-4)
}

function numberOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function uppercaseOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.toUpperCase() : ''
}
