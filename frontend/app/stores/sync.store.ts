import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useTransactionsStore } from './transactions.store'
import { useUiStore } from './ui'
import { useVaultStore } from './vault.store'
import { ImportSource } from '@/types/enums'
import { SyncStatus } from '@/types/vault'
import type { Transaction } from '@/types/vault'
import { parseCsvText, getCsvSchemaForAccount, toTransactionType, toAssetType, normalizeDate } from '@/utils/csv'

export const useSyncStore = defineStore('sync', () => {
  const vaultStore = useVaultStore()
  const uiStore = useUiStore()
  const transactionsStore = useTransactionsStore()

  const syncStatus = ref<SyncStatus>(SyncStatus.IDLE)
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

      vaultStore.payload.lastSyncSummary = {
        startedAt,
        completedAt: new Date().toISOString(),
        accountsSynced: 0,
        transactionsAdded: added,
        positionsUpdated: 0,
        deduplicatedCount: duplicates,
        errors,
      }

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
