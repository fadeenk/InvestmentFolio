import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useTransactionsStore } from './transactions.store'
import { useUiStore } from './ui'
import { useVaultStore } from './vault.store'
import { AssetType, Bank, ImportSource, TransactionType } from '@/types/enums'
import { SyncStatus } from '@/types/vault'
import type { Account, Transaction } from '@/types/vault'

export interface SyncSummary {
  startedAt: string
  completedAt: string | null
  accountsSynced: number
  transactionsAdded: number
  positionsUpdated: number
  deduplicatedCount: number
  errors: string[]
}

interface CsvRow {
  [key: string]: string
}

type CsvSchema = {
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

const CSV_SCHEMAS_BY_BANK: Record<Bank, CsvSchema> = {
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
  else if (action === 'Journal' && description?.startsWith('TRANSFER FUNDS')) return TransactionType.DEPOSIT
  return action
}

function parseCsvText(text: string): CsvRow[] {
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

function toTransactionType(rawType: string): TransactionType {
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

function toAssetType(rawAssetType: string | undefined, description: string | undefined): AssetType {
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

function toNumber(value: string | undefined, defaultValue = 0): number {
  if (!value || value.trim() === '') {
    return defaultValue
  }

  let normalized = value.trim()
  let isNegative = false

  // Handle accounting negative format like (123.45)
  if (/^\(.*\)$/.test(normalized)) {
    isNegative = true
    normalized = normalized.slice(1, -1)
  }

  // Handle trailing negatives like 123.45-
  if (normalized.endsWith('-')) {
    isNegative = !isNegative
    normalized = normalized.slice(0, -1)
  }

  // Remove currency symbols, spaces, and thousands separators
  normalized = normalized.replace(/[$,\s]/g, '')

  // Preserve explicit leading sign if present
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

function toOptionalNumber(value: string | undefined): number | null {
  if (!value || value.trim() === '') {
    return null
  }

  return toNumber(value)
}

function normalizeDate(rawDate: string): string {
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${rawDate}`)
  }

  return date.toISOString()
}

function getCsvSchemaForAccount(account: Account | undefined): CsvSchema {
  const bank = account?.bank ?? Bank.OTHER
  return CSV_SCHEMAS_BY_BANK[bank]
}

export const useSyncStore = defineStore('sync', () => {
  const vaultStore = useVaultStore()
  const uiStore = useUiStore()
  const transactionsStore = useTransactionsStore()

  const syncStatus = ref<SyncStatus>(SyncStatus.IDLE)
  const lastSyncSummary = ref<SyncSummary | null>(null)
  const lastError = ref<string | null>(null)
  const callbackMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

  const isSyncing = computed(() => syncStatus.value === SyncStatus.IN_PROGRESS)
  const expirationWarning = computed(() => isSyncing.value)

  function consumeAuthCallbackFromQuery(_params: URLSearchParams): void {
    callbackMessage.value = null
  }

  function clearCallbackMessage(): void {
    callbackMessage.value = null
  }

  async function ensureSyncedAfterUnlockOrAuth(): Promise<void> {
    return
  }

  async function importCsv(file: File, accountId: string): Promise<{ added: number; duplicates: number; errors: string[] }> {
    if (!vaultStore.payload) {
      return { added: 0, duplicates: 0, errors: ['Vault must be unlocked before importing transactions'] }
    }

    syncStatus.value = SyncStatus.IN_PROGRESS
    lastError.value = null

    const startedAt = new Date().toISOString()
    const errors: string[] = []

    try {
      const text = await file.text()
      let rows = parseCsvText(text)

      if (rows.length === 0) {
        return { added: 0, duplicates: 0, errors: ['CSV file does not contain data rows'] }
      }

      const account = vaultStore.payload.accounts.find((item) => item.id === accountId)
      const schema = getCsvSchemaForAccount(account)

      const firstRow = rows[0] ?? {}
      const missingColumns = schema.requiredColumns.filter((column) => !(column in firstRow))
      if (missingColumns.length > 0) {
        return {
          added: 0,
          duplicates: 0,
          errors: [`Missing required CSV columns: ${missingColumns.join(', ')}`],
        }
      }

      rows = schema.filterRow ? rows.filter(schema.filterRow) : rows
      const incoming: Array<Omit<Transaction, 'id' | 'importedAt'>> = []

      for (const row of rows) {
        try {
          const parsed = schema.mapRow(row)

          incoming.push({
            externalId: parsed.externalId,
            accountId,
            type: toTransactionType(parsed.rawType),
            assetType: toAssetType(parsed.assetType, parsed.description),
            symbol: parsed.symbol,
            description: parsed.description,
            quantity: parsed.quantity,
            price: parsed.price,
            date: normalizeDate(parsed.date),
            fees: parsed.fees,
            importSource: ImportSource.CSV_IMPORT,
            notes: parsed.notes,
            matchedLotIds: [],
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown CSV parse error'
          errors.push(message)
        }
      }

      const added = transactionsStore.insertMany(incoming)
      const duplicates = incoming.length - added

      const summary: SyncSummary = {
        startedAt,
        completedAt: new Date().toISOString(),
        accountsSynced: 0,
        transactionsAdded: added,
        positionsUpdated: 0,
        deduplicatedCount: duplicates,
        errors,
      }

      lastSyncSummary.value = summary
      syncStatus.value = SyncStatus.SUCCESS

      if (errors.length > 0) {
        uiStore.setBanner('warning', `Imported ${added} transactions with ${errors.length} row errors.`)
      } else {
        uiStore.setBanner('success', `Imported ${added} transactions.`)
      }

      return { added, duplicates, errors }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CSV import failed'
      lastError.value = message
      syncStatus.value = SyncStatus.ERROR
      uiStore.setBanner('error', message)
      return { added: 0, duplicates: 0, errors: [message] }
    }
  }

  return {
    syncStatus,
    lastSyncSummary,
    lastError,
    callbackMessage,
    isSyncing,
    expirationWarning,
    consumeAuthCallbackFromQuery,
    clearCallbackMessage,
    ensureSyncedAfterUnlockOrAuth,
    importCsv,
  }
})
