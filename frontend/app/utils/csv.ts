import { AssetType, Bank, TransactionType } from '@/types/enums'
import type { Account } from '@/types/vault'

export interface CsvRow {
  [key: string]: string
}

export type CsvSchema = {
  requiredColumns: string[]
  mapRow: (row: CsvRow) => {
    rawType: string
    symbol: string
    description: string
    quantity: number | null
    price: number
    date: string
    fees: number
    assetType: AssetType | undefined
    externalId: string | null
    notes: string | null
  }
  filterRow?: (row: CsvRow) => boolean
}

export const CSV_SCHEMAS_BY_BANK: Record<Bank, CsvSchema> = {
  [Bank.OTHER]: {
    requiredColumns: ['date', 'type', 'action', 'symbol', 'amount', 'price', 'fees', 'total'],
    mapRow: (row) => {
      const rawType = row.type || row.action || ''
      return {
        rawType,
        symbol: (row.symbol ?? '').trim().toUpperCase(),
        description: row.action ?? row.symbol ?? '',
        quantity: toOptionalNumber(row.amount),
        price: toNumber(row.price, 0),
        date: row.date ?? '',
        fees: toNumber(row.fees, 0),
        assetType: toAssetType(row.assettype, row.action ?? row.symbol ?? ''),
        externalId: row.externalid || null,
        notes: row.notes || null,
      }
    },
  },
  [Bank.OPTUM]: {
    requiredColumns: ['date', 'transaction type', 'requested action', 'amount', 'fund name', 'shares', 'share price'],
    mapRow: (row) => {
      const rawType = row['requested action'] || row['transaction type'] || ''
      const quantity = toOptionalNumber(row.shares)
      const amount = toOptionalNumber(row.amount)
      const sharePrice = toOptionalNumber(row['share price'])

      return {
        rawType,
        symbol: (row['fund name'] ?? '').trim().toUpperCase(),
        description: row['fund name'] ?? '',
        quantity,
        price: sharePrice ?? amount ?? 0,
        date: row.date ?? '',
        fees: 0,
        assetType: toAssetType(row.assettype, row['fund name'] ?? row['requested action'] ?? ''),
        externalId: row.externalid || null,
        notes: row.notes || null,
      }
    },
  },
  [Bank.SCHWAB]: {
    requiredColumns: ['date', 'action', 'symbol', 'description', 'quantity', 'price', 'fees & comm', 'amount'],
    filterRow: (row) => {
      return row.action !== 'Full Redemption Adj'
    },
    mapRow: (row) => {
      const rawType = processSchwabAction(row.action, row.description)
      const quantity = row.action === 'Full Redemption' ? toOptionalNumber(row.quantity)! * -1 : toOptionalNumber(row.quantity)
      const amount = toOptionalNumber(row.amount)
      const price = getSchwabPrice(row)

      return {
        rawType,
        symbol: (row.symbol ?? '').trim().toUpperCase(),
        description: row.description ?? '',
        quantity,
        price: price ?? amount ?? 0,
        date: row.date ?? '',
        fees: toNumber(row['fees & comm'], 0),
        assetType: toAssetType(row.assettype, row.description),
        externalId: row.externalid || null,
        notes: row.notes || null,
      }
    },
  },
}

function getSchwabPrice(row: CsvRow): number | null {
  if (row.action === 'Full Redemption') return 1
  else if (row.action === 'Buy' && row.description!.startsWith('US TREASURY BIL')) return toNumber(row.price) / 100
  else return toOptionalNumber(row.price)
}

function processSchwabAction(action: string | undefined, description: string | undefined): string {
  if (!action) return ''
  else if (action === 'Full Redemption') return TransactionType.Sell
  else if (action === 'Security Transfer') return TransactionType.Buy
  else if (action === 'Qualified Dividend') return TransactionType.Dividend
  else if (action === 'Journal' && description?.startsWith('TRANSFER FUNDS')) return TransactionType.DEPOSIT
  return action
}

export function parseCsvText(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) {
    return []
  }

  const headers = splitCsvLine(lines[0] ?? '').map((h) => h.trim().toLowerCase())
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i += 1) {
    const parts = splitCsvLine(lines[i] ?? '')
    const row: CsvRow = {}

    headers.forEach((header, index) => {
      row[header] = (parts[index] ?? '').trim()
    })

    rows.push(row)
  }

  return rows
}

function splitCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]

    if (ch === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += ch
  }

  values.push(current)
  return values
}

export function toTransactionType(rawType: string): TransactionType {
  const normalized = rawType
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')

  switch (normalized) {
    case 'BUY':
      return TransactionType.Buy
    case 'SELL':
      return TransactionType.Sell
    case 'DIVIDEND':
    case 'DIV':
    case 'CASH_DIVIDEND':
      return TransactionType.Dividend
    case 'INTEREST':
    case 'CREDIT_INTEREST':
      return TransactionType.Interest
    case 'SPLIT':
      return TransactionType.Split
    case 'DEPOSIT':
    case 'FUNDS_RECEIVED':
      return TransactionType.DEPOSIT
    case 'WITHDRAWAL':
      return TransactionType.WITHDRAWAL
    case 'TRANSFER_IN':
      return TransactionType.TRANSFER_IN
    case 'TRANSFER_OUT':
      return TransactionType.TRANSFER_OUT
    case 'JOURNAL':
      return TransactionType.Journal
    default:
      throw new Error(`Unsupported transaction type: ${rawType}`)
  }
}

export function toAssetType(rawAssetType: string | undefined, description: string | undefined): AssetType {
  const normalized = (rawAssetType ?? '').trim().toUpperCase()
  if (description?.startsWith('US TREASURY BIL')) return AssetType.CashEquivalent

  switch (normalized) {
    case 'BOND':
      return AssetType.Bond
    case 'ETF':
      return AssetType.ETF
    case 'MUTUALFUND':
    case 'MUTUAL_FUND':
      return AssetType.MutualFund
    case 'CASH':
      return AssetType.Cash
    case 'CRYPTO':
      return AssetType.Crypto
    case 'STOCK':
    default:
      return AssetType.Stock
  }
}

export function toNumber(value: string | undefined, defaultValue = 0): number {
  if (!value || value.trim() === '') {
    return defaultValue
  }

  let normalized = value.trim()
  let isNegative = false

  if (/^\(.*\)$/.test(normalized)) {
    isNegative = true
    normalized = normalized.slice(1, -1)
  }

  if (normalized.endsWith('-')) {
    isNegative = !isNegative
    normalized = normalized.slice(0, -1)
  }

  normalized = normalized.replace(/[$,\s]/g, '')

  if (normalized.startsWith('-')) {
    isNegative = !isNegative
    normalized = normalized.slice(1)
  } else if (normalized.startsWith('+')) {
    normalized = normalized.slice(1)
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number: ${value}`)
  }

  return isNegative ? -Math.abs(parsed) : parsed
}

export function toOptionalNumber(value: string | undefined): number | null {
  if (!value || value.trim() === '') {
    return null
  }

  return toNumber(value)
}

export function normalizeDate(rawDate: string): string {
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${rawDate}`)
  }

  return date.toISOString()
}

export function getCsvSchemaForAccount(account: Account | undefined): CsvSchema {
  const bank = account?.bank ?? Bank.OTHER
  return CSV_SCHEMAS_BY_BANK[bank]
}
