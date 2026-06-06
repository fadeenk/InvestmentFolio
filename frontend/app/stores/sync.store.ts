import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useTransactionsStore } from './transactions.store'
import { useUiStore } from './ui'
import { useVaultStore } from './vault.store'
import { AssetType, ImportSource, TransactionType } from '@/types/enums'
import { SyncStatus } from '@/types/vault'
import type { Transaction } from '@/types/vault'

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

const REQUIRED_COLUMNS = ['date', 'type', 'symbol', 'description', 'price']

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
  const normalized = rawType.trim().toUpperCase()

  switch (normalized) {
    case 'BUY':
      return TransactionType.Buy
    case 'SELL':
      return TransactionType.Sell
    case 'DIVIDEND':
      return TransactionType.Dividend
    case 'INTEREST':
      return TransactionType.Interest
    case 'SPLIT':
      return TransactionType.Split
    case 'DEPOSIT':
      return TransactionType.DEPOSIT
    case 'WITHDRAWAL':
      return TransactionType.WITHDRAWAL
    case 'TRANSFER_IN':
      return TransactionType.TRANSFER_IN
    case 'TRANSFER_OUT':
      return TransactionType.TRANSFER_OUT
    default:
      throw new Error(`Unsupported transaction type: ${rawType}`)
  }
}

function toAssetType(rawAssetType: string | undefined): AssetType {
  const normalized = (rawAssetType ?? '').trim().toUpperCase()

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

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number: ${value}`)
  }

  return parsed
}

function normalizeDate(rawDate: string): string {
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${rawDate}`)
  }

  return date.toISOString()
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
      const rows = parseCsvText(text)

      if (rows.length === 0) {
        return { added: 0, duplicates: 0, errors: ['CSV file does not contain data rows'] }
      }

      const firstRow = rows[0] ?? {}
      const missingColumns = REQUIRED_COLUMNS.filter((column) => !(column in firstRow))
      if (missingColumns.length > 0) {
        return {
          added: 0,
          duplicates: 0,
          errors: [`Missing required CSV columns: ${missingColumns.join(', ')}`],
        }
      }

      const incoming: Array<Omit<Transaction, 'id' | 'importedAt'>> = []

      for (const row of rows) {
        try {
          incoming.push({
            externalId: row.externalid || null,
            accountId,
            type: toTransactionType(row.type ?? ''),
            assetType: toAssetType(row.assettype),
            symbol: (row.symbol ?? '').trim().toUpperCase(),
            description: row.description ?? '',
            quantity: row.quantity ? toNumber(row.quantity, 0) : null,
            price: toNumber(row.price, 0),
            date: normalizeDate(row.date ?? ''),
            fees: toNumber(row.fees, 0),
            importSource: ImportSource.CSV_IMPORT,
            notes: row.notes || null,
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
