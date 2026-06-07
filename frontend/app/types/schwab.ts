// ─────────────────────────────────────────────────────────────────────────────
// schwab.ts — Schwab API response shapes
//
// All interfaces here mirror the JSON structures returned by the Schwab API
// (or the Cloudflare Worker that relays them).
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Auth / Token (Cloudflare Worker relay responses)
// ─────────────────────────────────────────────────────────────────────────────

export interface SchwabAuthStatusResponse {
  isConnected: boolean
  accessTokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
  accessTokenSecondsRemaining: number | null
  refreshTokenSecondsRemaining: number | null
  isRefreshTokenExpiringSoon: boolean
  warning: string | null
  connectedAccountCount: number
  lastRefreshedAt: string | null
}

export interface SchwabRefreshResponse {
  success: boolean
  accessTokenExpiresAt?: string
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Data — Quotes  —  GET /marketdata/v1/quotes
// ─────────────────────────────────────────────────────────────────────────────

export type SchwabQuotesResponse = Record<string, SchwabQuote>

export type SchwabQuote = SchwabEquityQuote | SchwabOptionQuote | SchwabMutualFundQuote

interface SchwabQuoteBase {
  assetMainType: string
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
// Market Data — Price History  —  GET /marketdata/v1/pricehistory
// ─────────────────────────────────────────────────────────────────────────────

export interface SchwabPriceHistoryResponse {
  candles: SchwabCandle[]
  symbol: string
  empty: boolean
}

export interface SchwabCandle {
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
  retryAfter?: number
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
