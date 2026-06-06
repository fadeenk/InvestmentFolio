/** The financial institution that owns the account. Determines sync strategy. */
export enum Bank {
  OPTUM = 'OPTUM',
  OTHER = 'OTHER',
}

/** The tax / functional type of the account. */
export enum AccountType {
  BROKERAGE = 'BROKERAGE',
  ROTH = 'ROTH',
  TRADITIONAL = 'TRADITIONAL',
  TRADITIONAL401K = 'TRADITIONAL 401K',
  Roth401K = '401K ROTH',
  HSA = 'HSA',
  CASH = 'CASH',
}

/** How account data is ingested. Derived from Bank but stored explicitly. */
export enum SyncMethod {
  Manual = 'Manual',
  CSVImport = 'CSVImport',
}

/**
 * Canonical iFolio transaction types — a normalised superset of all incoming
 * sources (CSV imports and manual entry).
 */
export enum TransactionType {
  Buy = 'Buy',
  Sell = 'Sell',
  Dividend = 'Dividend',
  Interest = 'Interest',
  Split = 'Split',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
}

/** Where a transaction record originated. */
export enum ImportSource {
  CSV_IMPORT = 'CSV_IMPORT',
  MANUAL = 'MANUAL',
}

/** Broad asset class used for allocation charting. */
export enum AssetType {
  Stock = 'Stock',
  Bond = 'Bond',
  ETF = 'ETF',
  MutualFund = 'MutualFund',
  Cash = 'Cash',
  Crypto = 'Crypto',
}

/** Cost basis accounting method applied per account. */
export enum CostBasisMethod {
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  SpecificLot = 'SpecificLot',
  AverageCost = 'AverageCost',
}

// ---------------------------------------------------------------------------
// UI / Display preferences
// ---------------------------------------------------------------------------

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export enum CurrencyFormat {
  USD = 'USD',
  // Extend for other currencies in future versions
}

export enum DateFormat {
  MM_DD_YYYY = 'MM/DD/YYYY',
  DD_MM_YYYY = 'DD/MM/YYYY',
  YYYY_MM_DD = 'YYYY-MM-DD',
}

/** Time-range options used throughout the dashboard. */
export enum TimeRange {
  ONE_DAY = '1D',
  ONE_WEEK = '1W',
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  YTD = 'YTD',
  ONE_YEAR = '1Y',
  ALL = 'ALL',
}
