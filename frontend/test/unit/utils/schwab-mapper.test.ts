import { describe, expect, it } from 'vitest'
import { AssetType, AccountType } from '~/types/enums'
import type {
  SchwabAccountsResponse,
  SchwabBalances,
  SchwabPosition,
  SchwabSecuritiesAccount,
} from '~/types/schwab'
import { buildSchwabHashMaps, mapSchwabAccountsToVaultDrafts } from '~/utils/schwab-mapper'

function balances(overrides: Partial<SchwabBalances> = {}): SchwabBalances {
  return {
    accruedInterest: 0,
    cashBalance: 0,
    cashReceipts: 0,
    longOptionMarketValue: 0,
    liquidationValue: 0,
    longMarketValue: 0,
    moneyMarketFund: 0,
    savings: 0,
    shortMarketValue: 0,
    pendingDeposits: 0,
    cashAvailableForTrading: 0,
    cashAvailableForWithdrawal: 0,
    cashCall: 0,
    longNonMarginableMarketValue: 0,
    totalCash: 0,
    totalEquityPercentage: 0,
    interestDebtDue: 0,
    marginBalance: 0,
    shortBalance: 0,
    accountValue: 0,
    ...overrides,
  }
}

function position(overrides: Partial<SchwabPosition> = {}): SchwabPosition {
  return {
    shortQuantity: 0,
    averagePrice: 0,
    currentDayProfitLoss: 0,
    currentDayProfitLossPercentage: 0,
    longQuantity: 0,
    settledLongQuantity: 0,
    settledShortQuantity: 0,
    instrument: {
      assetType: 'EQUITY',
      symbol: 'AAPL',
    },
    marketValue: 0,
    maintenanceRequirement: 0,
    averageLongPrice: 0,
    averageShortPrice: 0,
    taxLotAverageLongPrice: 0,
    taxLotAverageShortPrice: 0,
    longOpenProfitLoss: 0,
    shortOpenProfitLoss: 0,
    previousSessionLongQuantity: 0,
    previousSessionShortQuantity: 0,
    currentDayCost: 0,
    ...overrides,
  }
}

function account(overrides: Partial<SchwabSecuritiesAccount> = {}): SchwabSecuritiesAccount {
  return {
    type: 'MARGIN',
    accountNumber: '12345678',
    roundTrips: 0,
    isDayTrader: false,
    isClosingOnlyRestricted: false,
    pfcbFlag: false,
    positions: [position()],
    initialBalances: balances(),
    currentBalances: balances({ liquidationValue: 1000, cashBalance: 100 }),
    projectedBalances: balances(),
    ...overrides,
  }
}

describe('schwab mapper edge cases', () => {
  it('buildSchwabHashMaps keeps both full-number and last4 maps', () => {
    const maps = buildSchwabHashMaps([
      { accountNumber: '12345678', hashValue: 'hash-1' },
      { accountNumber: '87655678', hashValue: 'hash-2' },
      { accountNumber: '', hashValue: 'skip-me' },
    ])

    expect(maps.byFullNumber['12345678']).toBe('hash-1')
    expect(maps.byLast4['5678']).toBe('hash-2')
    expect(maps.byFullNumber['']).toBeUndefined()
  })

  it('filters accounts without account number', () => {
    const response: SchwabAccountsResponse = {
      accounts: [
        {
          securitiesAccount: account({ accountNumber: '' }),
        },
      ],
    }

    const mapped = mapSchwabAccountsToVaultDrafts(response, {}, '2026-06-03T10:00:00.000Z')

    expect(mapped).toHaveLength(0)
  })

  it('maps missing hash to null and unknown asset type to Stock', () => {
    const response: SchwabAccountsResponse = {
      accounts: [
        {
          securitiesAccount: account({
            type: 'ROTH_IRA',
            accountNumber: '11112222',
            positions: [
              position({
                instrument: {
                  assetType: 'COLLECTIVE_INVESTMENT',
                  symbol: 'FUNDX',
                },
              }),
            ],
          }),
        },
      ],
    }

    const mapped = mapSchwabAccountsToVaultDrafts(response, {}, '2026-06-03T10:00:00.000Z')

    expect(mapped).toHaveLength(1)
    expect(mapped[0].accountHash).toBeNull()
    expect(mapped[0].type).toBe(AccountType.ROTH)
    expect(mapped[0].positions[0].assetType).toBe(AssetType.Stock)
  })

  it('handles zero quantity without dividing by zero', () => {
    const response: SchwabAccountsResponse = {
      accounts: [
        {
          securitiesAccount: account({
            positions: [
              position({
                longQuantity: 0,
                shortQuantity: 0,
                marketValue: 250,
              }),
            ],
          }),
        },
      ],
    }

    const mapped = mapSchwabAccountsToVaultDrafts(
      response,
      { '12345678': 'hash-1' },
      '2026-06-03T10:00:00.000Z',
    )

    expect(mapped[0].positions[0].currentPrice).toBe(0)
    expect(Number.isFinite(mapped[0].positions[0].unrealizedGainLossPct)).toBe(true)
  })
})
