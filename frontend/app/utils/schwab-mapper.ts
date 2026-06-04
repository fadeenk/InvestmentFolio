import type { AccountType, AssetType, CostBasisMethod } from '@/types/enums'
import {
  AccountType as AccountTypeEnum,
  AssetType as AssetTypeEnum,
  CostBasisMethod as CostBasisMethodEnum,
} from '@/types/enums'
import type { Position } from '@/types/vault'
import type {
  SchwabAccount,
  SchwabAccountsResponse,
  SchwabAccountNumbersResponse,
  SchwabAssetTypeRaw,
  SchwabPosition,
  SchwabSecuritiesAccount,
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

function mapAccount(
  account: SchwabAccount,
  hashByFullNumber: Record<string, string>,
  snapshotAt: string,
): SchwabMappedAccountDraft | null {
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

  const positions = (securities.positions ?? []).map((position) =>
    mapPosition(position, accountNumber, snapshotAt),
  )

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

function mapPosition(
  position: SchwabPosition,
  accountNumber: string,
  snapshotAt: string,
): SchwabMappedPositionDraft {
  const quantityRaw = numberOrZero(position.longQuantity) - numberOrZero(position.shortQuantity)
  const quantity = quantityRaw === 0 ? numberOrZero(position.longQuantity) : quantityRaw
  const marketValue = numberOrZero(position.marketValue)
  const avgCost = numberOrZero(
    position.taxLotAverageLongPrice || position.averageLongPrice || position.averagePrice,
  )
  const currentPrice = quantity !== 0 ? marketValue / quantity : 0
  const dayGainLoss = numberOrZero(position.currentDayProfitLoss)
  const dayGainLossPct = numberOrZero(position.currentDayProfitLossPercentage)
  const openGainLoss =
    numberOrZero(position.longOpenProfitLoss) - numberOrZero(position.shortOpenProfitLoss)
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

function last4(accountNumber: string): string {
  return accountNumber.slice(-4)
}

function numberOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
