// ─────────────────────────────────────────────────────────────────────────────
// schwab.ts — Schwab Trader API response shapes and mapping utilities
//
// All interfaces here mirror the JSON structures returned by the Schwab API.
// They are intentionally kept separate from the Folio domain models so that
// changes to the Schwab API surface don't bleed into the core vault types.
// ─────────────────────────────────────────────────────────────────────────────

import type { TransactionType } from './enums'

// ─────────────────────────────────────────────────────────────────────────────
// Auth / Token (Cloudflare Worker relay responses)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response from the Cloudflare Worker /auth/status endpoint.
 * The Worker returns this after checking its KV-stored token metadata.
 */
export interface SchwabAuthStatusResponse {
  isConnected: boolean
  accessTokenExpiresAt: string | null // ISO 8601
  refreshTokenExpiresAt: string | null // ISO 8601
  connectedAccountCount: number
  lastRefreshedAt: string | null // ISO 8601
}

/**
 * Response from the Cloudflare Worker /auth/refresh endpoint.
 */
export interface SchwabRefreshResponse {
  success: boolean
  accessTokenExpiresAt?: string // ISO 8601
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Account Numbers  —  GET /trader/v1/accounts/accountNumbers
// ─────────────────────────────────────────────────────────────────────────────

export interface SchwabAccountNumberItem {
  accountNumber: string
  hashValue: string
}

/** Raw response from GET /trader/v1/accounts/accountNumbers */
export type SchwabAccountNumbersResponse = SchwabAccountNumberItem[]

// ─────────────────────────────────────────────────────────────────────────────
// Accounts  —  GET /trader/v1/accounts?fields=positions
// ─────────────────────────────────────────────────────────────────────────────

export interface SchwabAccountsResponse {
  accounts: SchwabAccount[]
}

export interface SchwabAccount {
  securitiesAccount: SchwabSecuritiesAccount
}

export interface SchwabSecuritiesAccount {
  type: SchwabAccountTypeRaw
  accountNumber: string
  roundTrips: number
  isDayTrader: boolean
  isClosingOnlyRestricted: boolean
  pfcbFlag: boolean
  positions?: SchwabPosition[]
  initialBalances: SchwabBalances
  currentBalances: SchwabBalances
  projectedBalances: SchwabBalances
}

export type SchwabAccountTypeRaw = 'CASH' | 'MARGIN' | 'IRA' | 'ROTH_IRA' | 'ROLLOVER_IRA' | 'HSA'

export interface SchwabBalances {
  accruedInterest: number
  cashBalance: number
  cashReceipts: number
  longOptionMarketValue: number
  liquidationValue: number
  longMarketValue: number
  moneyMarketFund: number
  savings: number
  shortMarketValue: number
  pendingDeposits: number
  cashAvailableForTrading: number
  cashAvailableForWithdrawal: number
  cashCall: number
  longNonMarginableMarketValue: number
  totalCash: number
  totalEquityPercentage: number
  interestDebtDue: number
  marginBalance: number
  shortBalance: number
  accountValue: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Positions
// ─────────────────────────────────────────────────────────────────────────────

export interface SchwabPosition {
  shortQuantity: number
  averagePrice: number
  currentDayProfitLoss: number
  currentDayProfitLossPercentage: number
  longQuantity: number
  settledLongQuantity: number
  settledShortQuantity: number
  agedQuantity?: number
  instrument: SchwabInstrument
  marketValue: number
  maintenanceRequirement: number
  averageLongPrice: number
  averageShortPrice: number
  taxLotAverageLongPrice: number
  taxLotAverageShortPrice: number
  longOpenProfitLoss: number
  shortOpenProfitLoss: number
  previousSessionLongQuantity: number
  previousSessionShortQuantity: number
  currentDayCost: number
}

export interface SchwabInstrument {
  assetType: SchwabAssetTypeRaw
  cusip?: string
  symbol: string
  description?: string
  instrumentId?: number
  netChange?: number
  type?: string // for options: e.g. 'VANILLA', 'BINARY'
  putCall?: 'PUT' | 'CALL'
  underlyingSymbol?: string
  optionMultiplier?: number
  optionDeliverables?: SchwabOptionDeliverable[]
  maturityDate?: string
  variableRate?: number
  factor?: number
}

export type SchwabAssetTypeRaw =
  | 'EQUITY'
  | 'ETF'
  | 'OPTION'
  | 'INDEX'
  | 'MUTUAL_FUND'
  | 'CASH_EQUIVALENT'
  | 'FIXED_INCOME'
  | 'CURRENCY'
  | 'COLLECTIVE_INVESTMENT'

export interface SchwabOptionDeliverable {
  symbol: string
  deliverableUnits: number
  apiCurrencyType: string
  assetType: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Transactions  —  GET /trader/v1/accounts/{hash}/transactions
// ─────────────────────────────────────────────────────────────────────────────

export interface SchwabTransactionsResponse {
  transactions: SchwabTransaction[]
}

export interface SchwabTransaction {
  activityId: number
  time: string // ISO 8601 datetime
  user?: SchwabTransactionUser
  description: string
  accountNumber: string
  type: TransactionType
  status: 'VALID' | 'INVALID' | 'PENDING' | 'UNKNOWN'
  subAccount: string
  tradeDate: string // ISO 8601
  settlementDate?: string // ISO 8601
  positionId?: number
  orderId?: number
  netAmount: number
  activityType: string
  transferItems: SchwabTransferItem[]
}

export interface SchwabTransactionUser {
  cdDomainId: string
  login: string
  type: string
  userId: number
  systemUserName: string
  firstName: string
  lastName: string
  brokerRepCode: string
}

export interface SchwabTransferItem {
  instrument: SchwabInstrument
  amount: number
  cost: number
  price?: number
  feeType?: string
  positionEffect?: 'OPENING' | 'CLOSING' | 'AUTOMATIC' | 'UNKNOWN'
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders  —  GET /trader/v1/accounts/{hash}/orders
// ─────────────────────────────────────────────────────────────────────────────

export interface SchwabOrdersResponse {
  orders: SchwabOrder[]
}

export interface SchwabOrder {
  session: string
  duration: string
  orderType: string
  cancelTime?: string
  complexOrderStrategyType: string
  quantity: number
  filledQuantity: number
  remainingQuantity: number
  requestedDestination: string
  destinationLinkName: string
  releaseTime?: string
  stopPrice?: number
  stopPriceLinkBasis?: string
  stopPriceLinkType?: string
  stopPriceOffset?: number
  stopType?: string
  price?: number
  taxLotMethod?: string
  orderLegCollection: SchwabOrderLeg[]
  activationPrice?: number
  specialInstruction?: string
  orderStrategyType: string
  orderId: number
  cancelable: boolean
  editable: boolean
  status: SchwabOrderStatus
  enteredTime: string // ISO 8601
  closeTime?: string // ISO 8601
  tag?: string
  accountNumber: string
  orderActivityCollection?: SchwabOrderActivity[]
  replacingOrderCollection?: unknown[]
  childOrderStrategies?: unknown[]
  statusDescription?: string
}

export type SchwabOrderStatus =
  | 'AWAITING_PARENT_ORDER'
  | 'AWAITING_CONDITION'
  | 'AWAITING_STOP_CONDITION'
  | 'AWAITING_MANUAL_REVIEW'
  | 'ACCEPTED'
  | 'AWAITING_UR_OUT'
  | 'PENDING_ACTIVATION'
  | 'QUEUED'
  | 'WORKING'
  | 'REJECTED'
  | 'PENDING_CANCEL'
  | 'CANCELED'
  | 'PENDING_REPLACE'
  | 'REPLACED'
  | 'FILLED'
  | 'EXPIRED'
  | 'NEW'
  | 'AWAITING_RELEASE_TIME'
  | 'PENDING_ACKNOWLEDGEMENT'
  | 'PENDING_RECALL'
  | 'UNKNOWN'

export interface SchwabOrderLeg {
  orderLegType: string
  legId: number
  instrument: SchwabInstrument
  instruction:
    | 'BUY'
    | 'SELL'
    | 'BUY_TO_COVER'
    | 'SELL_SHORT'
    | 'BUY_TO_OPEN'
    | 'BUY_TO_CLOSE'
    | 'SELL_TO_OPEN'
    | 'SELL_TO_CLOSE'
    | 'EXCHANGE'
    | 'SELL_SHORT_EXEMPT'
  positionEffect: 'OPENING' | 'CLOSING' | 'AUTOMATIC' | 'UNKNOWN'
  quantity: number
  quantityType: string
  divCapGains: string
  toSymbol?: string
}

export interface SchwabOrderActivity {
  activityType: string
  activityId?: number
  executionType?: string
  quantity?: number
  orderRemainingQuantity?: number
  executionLegs?: SchwabExecutionLeg[]
}

export interface SchwabExecutionLeg {
  legId: number
  price: number
  quantity: number
  mismarkedQuantity: number
  instrumentId: number
  time: string // ISO 8601
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Data — Quotes  —  GET /marketdata/v1/quotes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response is a map of symbol → quote object.
 * The quote object shape varies slightly by asset type, so we use a
 * discriminated union keyed on assetMainType.
 */
export type SchwabQuotesResponse = Record<string, SchwabQuote>

export type SchwabQuote = SchwabEquityQuote | SchwabOptionQuote | SchwabMutualFundQuote

interface SchwabQuoteBase {
  assetMainType: SchwabAssetTypeRaw
  assetSubType?: string
  symbol: string
  realtime: boolean
  ssid?: number
  quoteType?: string
}

export interface SchwabEquityQuote extends SchwabQuoteBase {
  assetMainType: 'EQUITY' | 'ETF' | 'INDEX'
  quote: {
    '52WeekHigh': number
    '52WeekLow': number
    askMICId?: string
    askPrice: number
    askSize: number
    askTime: number
    bidMICId?: string
    bidPrice: number
    bidSize: number
    bidTime: number
    closePrice: number
    highPrice: number
    lastMICId?: string
    lastPrice: number
    lastSize: number
    lowPrice: number
    mark: number
    markChange: number
    markPercentChange: number
    netChange: number
    netPercentChange: number
    openPrice: number
    postMarketChange?: number
    postMarketPercentChange?: number
    quoteTime: number
    securityStatus: string
    totalVolume: number
    tradeTime: number
  }
  reference: {
    cusip: string
    description: string
    exchange: string
    exchangeName: string
    isHardToBorrow: boolean
    isShortable: boolean
    htbRate?: number
  }
  regular?: {
    regularMarketLastPrice: number
    regularMarketLastSize: number
    regularMarketNetChange: number
    regularMarketPercentChange: number
    regularMarketTradeTime: number
  }
}

export interface SchwabOptionQuote extends SchwabQuoteBase {
  assetMainType: 'OPTION'
  quote: {
    askPrice: number
    askSize: number
    bidPrice: number
    bidSize: number
    closePrice: number
    delta: number
    gamma: number
    highPrice: number
    indAskPrice?: number
    indBidPrice?: number
    indQuoteTime?: number
    impliedYield?: number
    lastPrice: number
    lastSize: number
    lowPrice: number
    mark: number
    markChange: number
    markPercentChange: number
    moneyIntrinsicValue: number
    netChange: number
    netPercentChange: number
    openInterest: number
    openPrice: number
    quoteTime: number
    rho: number
    securityStatus: string
    theoreticalOptionValue: number
    theta: number
    timeValue: number
    totalVolume: number
    tradeTime: number
    vega: number
    volatility: number
  }
  reference: {
    contractType: 'P' | 'C'
    cusip?: string
    daysToExpiration: number
    deliverables?: string
    description: string
    exchange: string
    exchangeName: string
    exerciseType: string
    expirationDay: number
    expirationMonth: number
    expirationYear: number
    isPennyPilot: boolean
    lastTradingDay: number
    multiplier: number
    settlementType: string
    strikePrice: number
    underlying: string
    underlyingId: number
  }
}

export interface SchwabMutualFundQuote extends SchwabQuoteBase {
  assetMainType: 'MUTUAL_FUND'
  quote: {
    '52WeekHigh': number
    '52WeekLow': number
    closePrice: number
    nAV: number
    netChange: number
    netPercentChange: number
    securityStatus: string
    totalVolume: number
    tradeTime: number
  }
  reference: {
    cusip: string
    description: string
    exchange: string
    exchangeName: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Data — Price History  —  GET /marketdata/v1/pricehistory/{symbol}
// ─────────────────────────────────────────────────────────────────────────────

export interface SchwabPriceHistoryResponse {
  candles: SchwabCandle[]
  symbol: string
  empty: boolean
}

export interface SchwabCandle {
  /** Unix epoch milliseconds. */
  datetime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Worker error envelope
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkerErrorResponse {
  error: string
  code: number
  retryAfter?: number // seconds, present on 429
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers (type guards)
// ─────────────────────────────────────────────────────────────────────────────

export function isSchwabEquityQuote(q: SchwabQuote): q is SchwabEquityQuote {
  return q.assetMainType === 'EQUITY' || q.assetMainType === 'INDEX'
}

export function isSchwabOptionQuote(q: SchwabQuote): q is SchwabOptionQuote {
  return q.assetMainType === 'OPTION'
}

export function isSchwabMutualFundQuote(q: SchwabQuote): q is SchwabMutualFundQuote {
  return q.assetMainType === 'MUTUAL_FUND'
}

export function isWorkerError(r: unknown): r is WorkerErrorResponse {
  return typeof r === 'object' && r !== null && 'error' in r && 'code' in r
}
