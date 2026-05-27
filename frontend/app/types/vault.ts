import type {
  Bank,
  AccountType,
  TransactionType,
  AssetType,
  CostBasisMethod,
  SyncMethod,
  ImportSource,
} from './enums'
/**
 * Top-level decrypted JSON payload stored inside the .foli vault file.
 * Every field written here will be AES-256-GCM encrypted at rest.
 */
export interface VaultPayload {
  schemaVersion: number
  createdAt: string // ISO 8601
  lastSyncedAt: string | null // ISO 8601, null until first sync
  accounts: Account[]
  transactions: Transaction[]
  positions: Position[]
  taxLots: TaxLot[]
  dividends: IncomeRecord[]
  /**
   * Symbol → ordered array of daily price points.
   * Used for portfolio value charting without requiring a live API call.
   */
  priceHistory: Record<string, PricePoint[]>
  metadata: VaultMetadata
}

// ─────────────────────────────────────────────────────────────────────────────
// Vault metadata & user preferences
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultMetadata {
  /** Display preferences saved by the user. */
  displayPreferences: DisplayPreferences
  /**
   * Schwab account hashes retrieved from /trader/v1/accounts/accountNumbers.
   * Map of accountNumber (last 4) → Schwab hash string.
   * Used to construct per-account API request paths.
   */
  schwabAccountHashes: Record<string, string>
  /**
   * Cached Schwab OAuth token metadata (not the raw tokens — those live
   * in Cloudflare Worker KV). Expiry timestamps are stored here so the
   * frontend can warn the user without hitting the Worker.
   */
  schwabTokenMeta: SchwabTokenMeta | null
  /** Per-account cost basis method override (accountId → method). */
  costBasisMethodByAccount: Record<string, CostBasisMethod>
  /** ISO 8601 timestamp of the last full vault save. */
  lastSavedAt: string | null
}

export interface DisplayPreferences {
  theme: 'light' | 'dark' | 'system'
  currencyFormat: string // e.g. 'USD'
  dateFormat: string // e.g. 'MM/DD/YYYY'
  defaultAccountFilter: string | null // accountId or null → "All accounts"
  defaultCostBasisMethod: CostBasisMethod
  defaultTimeRange: string // TimeRange enum value
}

export interface SchwabTokenMeta {
  accessTokenExpiresAt: string // ISO 8601
  refreshTokenExpiresAt: string // ISO 8601
  connectedAccountCount: number
  lastRefreshedAt: string // ISO 8601
}
export interface Account {
  id: string
  bank: Bank
  type: AccountType
  displayName: string
  /** Last 4 digits only, e.g. "4821". Stored for display; never the full number. */
  accountNumber: string
  /**
   * Schwab-provided opaque hash used as the path parameter for per-account
   * API calls. Null for non-Schwab accounts.
   */
  accountHash: string | null
  /** Derived from bank; stored explicitly so the UI doesn't need to re-derive. */
  syncMethod: SyncMethod
  /** Total market value of all positions + cash at last sync. */
  currentBalance: number
  /** Uninvested cash. For CASH accounts this equals currentBalance. */
  cashBalance: number
  lastUpdatedAt: string // ISO 8601
  isActive: boolean
}

export interface Transaction {
  id: string
  /** Schwab's own transaction ID for deduplication; null for manual/CSV entries. */
  externalId: string | null

  accountId: string
  type: TransactionType
  assetType: AssetType
  symbol: string
  description: string
  quantity: number | null
  price: number
  date: string
  fees: number
  importSource: ImportSource
  /** ISO 8601 timestamp of when this record was imported/entered. */
  importedAt: string
  /** Optional free-text note added by the user. */
  notes: string | null
  /**
   * For SELL transactions: IDs of the tax lots this sale was matched against.
   * Populated after lot matching is run.
   */
  matchedLotIds: string[]
}

export interface Position {
  id: string
  accountId: string
  symbol: string
  assetType: AssetType
  quantity: number
  avgCost: number
  currentPrice: number
  /** quantity × currentPrice */
  marketValue: number
  /** marketValue − (quantity × averageCost) */
  unrealizedGainLoss: number
  unrealizedGainLossPct: number
  /** Day's gain/loss (current price vs previous close). */
  dayGainLoss: number
  dayGainLossPct: number
  costBasisMethod: CostBasisMethod
}

export interface TaxLot {
  id: string
  accountId: string
  symbol: string
  /** Transaction ID of the buy/acquisition that opened this lot. */
  openingTransactionId: string
  acquiredDate: string // ISO 8601 date
  acquiredPrice: number
  originalQuantity: number
  /** Remaining open quantity (reduced by partial sells). */
  remainingQuantity: number
  /** acquiredPrice × remainingQuantity */
  costBasis: number
  /** Current market value based on last known price. */
  currentValue: number
  unrealizedGainLoss: number
  unrealizedGainLossPct: number
  /** Number of days held as of last calculation. */
  daysHeld: number
  isLongTerm: boolean // true if daysHeld >= 366
  isOpen: boolean
  /**
   * Wash sale flag. True if a substantially identical security was purchased
   * within 30 days before/after this lot's closing sale.
   */
  isWashSale: boolean
  /** Dollar amount of loss disallowed due to wash sale rules. */
  washSaleDisallowedLoss: number
  /** Adjusted cost basis after wash sale adjustment. */
  adjustedCostBasis: number
}

export enum TermType {
  SHORT_TERM = 'SHORT_TERM',
  LONG_TERM = 'LONG_TERM',
}
/**
 * Record of a closed (fully or partially sold) tax lot.
 * Created when a SELL transaction is matched against open lots.
 */
export interface ClosedLot {
  id: string
  accountId: string
  symbol: string
  openingLotId: string // FK → TaxLot.id
  openingTransactionId: string
  closingTransactionId: string
  acquiredDate: string // ISO 8601
  soldDate: string // ISO 8601
  quantity: number
  costBasis: number
  proceeds: number
  realizedGainLoss: number
  termType: TermType
  taxYear: number
  isWashSale: boolean
  washSaleDisallowedLoss: number
}

export interface IncomeRecord {
  id: string
  accountId: string
  transactionId: string // FK → Transaction.id
  date: string // ISO 8601
  symbol: string | null
  /**
   * Granular income sub-type. Mirrors a subset of TransactionType values
   * relevant to income.
   */
  incomeType: TransactionType.Dividend | TransactionType.Interest
  amount: number
  taxYear: number
}

export interface PricePoint {
  date: string // ISO 8601 format (YYYY-MM-DD)
  [key: string]: number
}

/** Current state of the vault / session lifecycle. */
export enum VaultStatus {
  /** No vault file selected yet. */
  LOCKED = 'LOCKED',
  /** Vault file selected, passphrase entry in progress. */
  UNLOCKING = 'UNLOCKING',
  /** Vault is decrypted and data is in memory. */
  UNLOCKED = 'UNLOCKED',
  /** Vault is actively being saved/re-encrypted. */
  SAVING = 'SAVING',
}

/** High-level result state for a sync or import operation. */
export enum SyncStatus {
  IDLE = 'IDLE',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  /** Sync paused because the Schwab API rate limit was approached. */
  RATE_LIMITED = 'RATE_LIMITED',
}

/** OAuth token health reported by the Cloudflare Worker. */
export enum TokenStatus {
  VALID = 'VALID',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
  NOT_CONNECTED = 'NOT_CONNECTED',
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived / computed types (not persisted to vault, computed at runtime)
// ─────────────────────────────────────────────────────────────────────────────

/** Aggregated portfolio metrics used in the dashboard summary cards. */
export interface PortfolioSummary {
  totalMarketValue: number
  totalCostBasis: number
  totalUnrealizedGainLoss: number
  totalUnrealizedGainLossPct: number
  totalDayGainLoss: number
  totalDayGainLossPct: number
  totalCashBalance: number
  ytdRealizedGainLossShortTerm: number
  ytdRealizedGainLossLongTerm: number
  ytdRealizedGainLossTotal: number
  ytdIncomeTotal: number
  ytdDividends: number
  ytdInterest: number
}

/** Allocation slice used for the asset allocation chart. */
export interface AllocationSlice {
  assetType: AssetType
  label: string
  marketValue: number
  percentage: number
}

/** Monthly income aggregation used in the income bar chart. */
export interface MonthlyIncomeSummary {
  /** ISO 8601 year-month, e.g. "2025-03". */
  yearMonth: string
  totalDividends: number
  qualifiedDividends: number
  ordinaryDividends: number
  reinvestedDividends: number
  interest: number
  total: number
}

/** Annual tax summary for the Tax / Realized Gains view. */
export interface TaxYearSummary {
  taxYear: number
  shortTermGainLoss: number
  longTermGainLoss: number
  totalRealizedGainLoss: number
  dividends: number
  interest: number
  totalIncome: number
  washSaleDisallowedLosses: number
}

/** Per-security income summary for the Income view table. */
export interface SecurityIncomeSummary {
  symbol: string
  description: string
  ytdTotal: number
  priorYearTotal: number
  qualifiedDividends: number
  ordinaryDividends: number
  reinvestedDividends: number
  interest: number
}

/** Portfolio value data point used for the line chart. */
export interface PortfolioValuePoint {
  date: string // ISO 8601
  totalValue: number
  dayGainLoss: number
}
