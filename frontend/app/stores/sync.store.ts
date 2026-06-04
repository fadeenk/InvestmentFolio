// ─────────────────────────────────────────────────────────────────────────────
// stores/sync.store.ts
//
// Orchestrates all data-update methods:
//   - Schwab API sync (via Cloudflare Worker)
//   - CSV import (Optum / Schwab historical)
//   - Token lifecycle (status, refresh, re-auth warnings)
//
// This store calls the Worker endpoints; it does NOT parse Schwab JSON directly.
// Parsing/mapping lives in composables/useSchwabMapper.ts (to be implemented).
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useVaultStore } from './vault.store'
import { useAccountsStore } from './accounts.store'
import { usePositionsStore } from './positions.store'
import { useTransactionsStore } from './transactions.store'
import type {
  SchwabAccountNumbersResponse,
  SchwabAccountsResponse,
  SchwabAuthStatusResponse,
  SchwabRefreshResponse,
  SchwabTransactionsResponse,
} from '@/types/schwab'
import type { Position } from '@/types/vault'
import { SyncStatus, TokenStatus } from '@/types/vault'
import { buildSchwabHashMaps, mapSchwabAccountsToVaultDrafts, mapSchwabTransactionsToVaultDrafts } from '@/utils/schwab-mapper'

// ---------------------------------------------------------------------------
// Worker URL — injected at build time via Nuxt runtimeConfig
// ---------------------------------------------------------------------------

function getWorkerBaseUrl(): string {
  try {
    const config = useRuntimeConfig()
    const runtimeUrl = config.public.workerUrl
    if (runtimeUrl) {
      return runtimeUrl.replace(/\/$/, '')
    }
  } catch {
    // Non-Nuxt unit-test context falls back to global/window values.
  }

  if (typeof window !== 'undefined') {
    const w = window as Window & { __FOLIO_WORKER_URL__?: string }
    if (w.__FOLIO_WORKER_URL__) {
      return w.__FOLIO_WORKER_URL__.replace(/\/$/, '')
    }
  }

  if (typeof globalThis !== 'undefined') {
    const g = globalThis as typeof globalThis & { __FOLIO_WORKER_URL__?: string }
    if (g.__FOLIO_WORKER_URL__) {
      return g.__FOLIO_WORKER_URL__.replace(/\/$/, '')
    }
  }

  return ''
}

// ---------------------------------------------------------------------------
// Sync result shape
// ---------------------------------------------------------------------------

export interface SyncSummary {
  startedAt: string // ISO 8601
  completedAt: string | null
  accountsSynced: number
  transactionsAdded: number
  positionsUpdated: number
  deduplicatedCount: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSyncStore = defineStore('sync', () => {
  const vaultStore = useVaultStore()
  const accountsStore = useAccountsStore()
  const positionsStore = usePositionsStore()
  const transactionsStore = useTransactionsStore()

  // ── State ──────────────────────────────────────────────────────────────────

  const syncStatus = ref<SyncStatus>(SyncStatus.IDLE)
  const tokenStatus = ref<TokenStatus>(TokenStatus.NOT_CONNECTED)
  const lastSyncSummary = ref<SyncSummary | null>(null)
  const lastError = ref<string | null>(null)
  const callbackMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

  /** Seconds until the access token expires. Updated by pollTokenStatus(). */
  const accessTokenSecondsRemaining = ref<number | null>(null)
  /** Seconds until the refresh token expires. */
  const refreshTokenSecondsRemaining = ref<number | null>(null)

  /** True while a sync is actively running. */
  const isSyncing = computed(() => syncStatus.value === SyncStatus.IN_PROGRESS)

  /** True when the user should be prompted to re-authorize with Schwab. */
  const requiresReauth = computed(() => tokenStatus.value === TokenStatus.EXPIRED || tokenStatus.value === TokenStatus.NOT_CONNECTED)

  /** True when the refresh token expires within 24 hours. */
  const expirationWarning = computed(
    () => refreshTokenSecondsRemaining.value !== null && refreshTokenSecondsRemaining.value < 86_400 && refreshTokenSecondsRemaining.value > 0,
  )

  // ── Token lifecycle ────────────────────────────────────────────────────────

  /**
   * Fetch token status from the Worker and update local state.
   * Called on app startup and periodically during active sessions.
   */
  async function pollTokenStatus(): Promise<void> {
    const base = getWorkerBaseUrl()
    if (!base) return

    try {
      const resp = await fetch(`${base}/auth/status`, {
        headers: _bearerHeader(),
      })
      if (!resp.ok) {
        tokenStatus.value = TokenStatus.NOT_CONNECTED
        return
      }

      const data: SchwabAuthStatusResponse = await resp.json()
      _applyTokenStatus(data)

      // Cache token meta in vault metadata for offline display
      if (vaultStore.payload && data.isConnected) {
        vaultStore.mutatePayload((p) => {
          p.metadata.schwabTokenMeta = {
            accessTokenExpiresAt: data.accessTokenExpiresAt ?? '',
            refreshTokenExpiresAt: data.refreshTokenExpiresAt ?? '',
            connectedAccountCount: data.connectedAccountCount,
            lastRefreshedAt: data.lastRefreshedAt ?? new Date().toISOString(),
          }
        })
      }
    } catch {
      tokenStatus.value = TokenStatus.NOT_CONNECTED
    }
  }

  function consumeAuthCallbackFromQuery(params: URLSearchParams): void {
    const authState = params.get('auth')
    if (!authState) {
      callbackMessage.value = null
      return
    }

    if (authState === 'connected') {
      callbackMessage.value = {
        type: 'success',
        text: 'Schwab account connected successfully.',
      }
      return
    }

    const reason = params.get('reason')
    callbackMessage.value = {
      type: 'error',
      text: reason ?? 'Unable to complete Schwab authorization.',
    }
  }

  function clearCallbackMessage(): void {
    callbackMessage.value = null
  }

  /**
   * Trigger an access token refresh via the Worker.
   * Called automatically when the frontend receives a 401 mid-sync.
   */
  async function refreshAccessToken(): Promise<boolean> {
    const base = getWorkerBaseUrl()
    if (!base) return false

    try {
      const resp = await fetch(`${base}/auth/refresh`, {
        method: 'POST',
        headers: _bearerHeader(),
      })
      if (!resp.ok) {
        tokenStatus.value = TokenStatus.EXPIRED
        return false
      }

      const data: SchwabRefreshResponse = await resp.json()
      if (data.success && data.accessTokenExpiresAt) {
        await pollTokenStatus()
        return true
      }
      tokenStatus.value = TokenStatus.EXPIRED
      return false
    } catch {
      return false
    }
  }

  /**
   * Redirect the user to the Schwab OAuth consent page.
   * The Worker handles the callback and stores tokens in KV.
   */
  function initiateOAuthFlow(): void {
    const base = getWorkerBaseUrl()
    if (!base) throw new Error('Worker URL not configured')
    window.location.href = `${base}/auth/login`
  }

  async function syncSchwabWithAuth(): Promise<SyncSummary | null> {
    await pollTokenStatus()
    if (requiresReauth.value) {
      initiateOAuthFlow()
      return null
    }

    return syncSchwab()
  }

  async function ensureSyncedAfterUnlockOrAuth(): Promise<void> {
    if (isSyncing.value || !vaultStore.payload) {
      return
    }

    await pollTokenStatus()
    if (requiresReauth.value || isSyncing.value) {
      return
    }

    try {
      await syncSchwab()
    } catch {
      // Error state is already captured by sync status + lastError.
    }
  }

  // ── Schwab API Sync ────────────────────────────────────────────────────────

  /**
   * Full Schwab sync: accounts → positions → transactions → quotes.
   * All parsing/mapping is delegated to the mapper composable.
   * This store only handles orchestration, status tracking, and error handling.
   *
   * NOTE: The actual mapper calls (mapSchwabAccount, mapSchwabTransaction, etc.)
   * will be wired in once useSchwabMapper composable is implemented.
   */
  async function syncSchwab(): Promise<SyncSummary> {
    if (isSyncing.value) throw new Error('Sync already in progress')

    const startedAt = new Date().toISOString()
    syncStatus.value = SyncStatus.IN_PROGRESS
    lastError.value = null

    const summary: SyncSummary = {
      startedAt,
      completedAt: null,
      accountsSynced: 0,
      transactionsAdded: 0,
      positionsUpdated: 0,
      deduplicatedCount: 0,
      errors: [],
    }

    try {
      const base = getWorkerBaseUrl()
      if (!base) throw new Error('Worker URL not configured')

      // 1. Verify / refresh access token
      await pollTokenStatus()
      if (requiresReauth.value) {
        throw new Error('Schwab re-authorization required')
      }

      // 2. Fetch all accounts + positions
      let accountNumbersResp = await _workerGet(`${base}/api/accountNumbers`)
      if (!accountNumbersResp.ok) {
        if (accountNumbersResp.status === 401) {
          const refreshed = await refreshAccessToken()
          if (!refreshed) throw new Error('Token refresh failed — re-authorization required')
          accountNumbersResp = await _workerGet(`${base}/api/accountNumbers`)
          if (!accountNumbersResp.ok) throw new Error(`Account numbers API error: ${accountNumbersResp.status}`)
        } else {
          throw new Error(`Account numbers API error: ${accountNumbersResp.status}`)
        }
      }

      const accountNumbersData: SchwabAccountNumbersResponse = await accountNumbersResp.json()
      const hashMaps = buildSchwabHashMaps(accountNumbersData)
      accountsStore.mergeSchwabHashMaps(hashMaps.byFullNumber, hashMaps.byLast4)

      let accountsResp = await _workerGet(`${base}/api/accounts?fields=positions`)
      if (!accountsResp.ok) {
        if (accountsResp.status === 401) {
          const refreshed = await refreshAccessToken()
          if (!refreshed) throw new Error('Token refresh failed — re-authorization required')
          // Retry once
          accountsResp = await _workerGet(`${base}/api/accounts?fields=positions`)
          if (!accountsResp.ok) throw new Error(`Accounts API error: ${accountsResp.status}`)
        } else if (accountsResp.status === 429) {
          const retryAfter = accountsResp.headers.get('Retry-After') ?? '60'
          syncStatus.value = SyncStatus.RATE_LIMITED
          throw new Error(`Rate limited — retry after ${retryAfter}s`)
        } else {
          throw new Error(`Accounts API error: ${accountsResp.status}`)
        }
      }

      const accountsData: SchwabAccountsResponse = await accountsResp.json()
      const snapshotAt = new Date().toISOString()
      const existingAccountsByHash = new Map<string, string>()
      const existingAccountsByLast4 = new Map<string, string>()
      for (const account of accountsStore.all) {
        if (account.accountHash) {
          existingAccountsByHash.set(account.accountHash, account.lastUpdatedAt)
        }
        existingAccountsByLast4.set(account.accountNumber, account.lastUpdatedAt)
      }

      const mappedAccounts = mapSchwabAccountsToVaultDrafts(accountsData, hashMaps.byFullNumber, snapshotAt)

      const nextPositions: Array<Omit<Position, 'id'>> = []
      const syncWindowTargets: Array<{ accountId: string; accountHash: string; fromDate: string }> = []
      const toDate = new Date().toISOString()

      for (const mapped of mappedAccounts) {
        const previousUpdatedAt =
          (mapped.accountHash ? existingAccountsByHash.get(mapped.accountHash) : null) ??
          existingAccountsByLast4.get(mapped.accountLast4) ??
          vaultStore.payload?.lastSyncedAt ??
          defaultSyncWindowStart(toDate)

        const upserted = accountsStore.upsertSchwabAccount({
          accountNumber: mapped.accountNumber,
          accountHash: mapped.accountHash,
          displayName: mapped.displayName,
          type: mapped.type,
          currentBalance: mapped.currentBalance,
          cashBalance: mapped.cashBalance,
        })

        summary.accountsSynced += 1
        if (!upserted.created) {
          summary.deduplicatedCount += 1
        }

        if (mapped.accountHash) {
          syncWindowTargets.push({
            accountId: upserted.id,
            accountHash: mapped.accountHash,
            fromDate: previousUpdatedAt,
          })
        }

        for (const position of mapped.positions) {
          nextPositions.push({
            accountId: upserted.id,
            symbol: position.symbol,
            assetType: position.assetType,
            quantity: position.quantity,
            avgCost: position.avgCost,
            currentPrice: position.currentPrice,
            marketValue: position.marketValue,
            unrealizedGainLoss: position.unrealizedGainLoss,
            unrealizedGainLossPct: position.unrealizedGainLossPct,
            dayGainLoss: position.dayGainLoss,
            dayGainLossPct: position.dayGainLossPct,
            costBasisMethod: position.costBasisMethod,
            snapshotAt: position.snapshotAt,
          })
        }
      }

      if (nextPositions.length > 0) {
        positionsStore.upsertSnapshots(nextPositions)
      }
      summary.positionsUpdated = nextPositions.length

      // 3. Fetch transactions for each Schwab account hash.
      for (const target of syncWindowTargets) {
        const endpoint = `${base}/api/accounts/${encodeURIComponent(target.accountHash)}/transactions?fromDate=${encodeURIComponent(target.fromDate)}&toDate=${encodeURIComponent(toDate)}`
        let txResp = await _workerGet(endpoint)

        if (!txResp.ok) {
          if (txResp.status === 401) {
            const refreshed = await refreshAccessToken()
            if (!refreshed) throw new Error('Token refresh failed — re-authorization required')
            txResp = await _workerGet(endpoint)
            if (!txResp.ok) {
              throw new Error(`Transactions API error (${target.accountHash}): ${txResp.status}`)
            }
          } else if (txResp.status === 429) {
            const retryAfter = txResp.headers.get('Retry-After') ?? '60'
            syncStatus.value = SyncStatus.RATE_LIMITED
            throw new Error(`Rate limited — retry after ${retryAfter}s`)
          } else {
            throw new Error(`Transactions API error (${target.accountHash}): ${txResp.status}`)
          }
        }

        const transactionsData: SchwabTransactionsResponse = await txResp.json()
        const mappedTransactions = mapSchwabTransactionsToVaultDrafts(transactionsData, target.accountId)
        const inserted = transactionsStore.insertMany(mappedTransactions)

        summary.transactionsAdded += inserted
        summary.deduplicatedCount += mappedTransactions.length - inserted
      }

      // 4. Fetch quotes for all held symbols
      // Wiring point: collect symbols from positions, call /api/marketdata/quotes

      // 5. Update lastSyncedAt in vault
      vaultStore.mutatePayload((p) => {
        p.lastSyncedAt = new Date().toISOString()
      })

      summary.completedAt = new Date().toISOString()
      syncStatus.value = SyncStatus.SUCCESS
      lastSyncSummary.value = summary

      return summary
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      summary.errors.push(msg)
      summary.completedAt = new Date().toISOString()
      lastError.value = msg
      syncStatus.value = SyncStatus.ERROR
      lastSyncSummary.value = summary
      throw err
    }
  }

  // ── CSV Import ─────────────────────────────────────────────────────────────

  /**
   * Parse and import a CSV file from a supported institution.
   * The file is read in-browser; nothing is sent to the Worker.
   *
   * Returns an import summary (records added, duplicates skipped).
   */
  async function importCsv(_file: File, _accountId: string): Promise<{ added: number; duplicates: number; errors: string[] }> {
    // Wiring point:
    // 1. Detect institution from file format (Optum vs Schwab historical)
    // 2. Route to correct parser composable
    // 3. Call useTransactionsStore().insertMany(parsed)
    // 4. Return summary

    // Stub — replace once parsers are implemented
    return { added: 0, duplicates: 0, errors: ['CSV import parser not yet implemented'] }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _bearerHeader(): HeadersInit {
    return { Accept: 'application/json' }
  }

  async function _workerGet(url: string): Promise<Response> {
    return fetch(url, { headers: _bearerHeader() })
  }

  function _applyTokenStatus(data: SchwabAuthStatusResponse): void {
    if (!data.isConnected) {
      tokenStatus.value = TokenStatus.NOT_CONNECTED
      return
    }

    const now = Date.now()
    if (data.refreshTokenExpiresAt) {
      const refreshMs = new Date(data.refreshTokenExpiresAt).getTime() - now
      refreshTokenSecondsRemaining.value = Math.max(0, Math.floor(refreshMs / 1000))
      if (refreshMs <= 0) {
        tokenStatus.value = TokenStatus.EXPIRED
        return
      }
    }

    if (data.accessTokenExpiresAt) {
      const accessMs = new Date(data.accessTokenExpiresAt).getTime() - now
      accessTokenSecondsRemaining.value = Math.max(0, Math.floor(accessMs / 1000))
      if (accessMs < 60_000) {
        tokenStatus.value = TokenStatus.EXPIRING_SOON
        return
      }
    }

    tokenStatus.value = TokenStatus.VALID
  }

  function defaultSyncWindowStart(toDateIso: string): string {
    const end = new Date(toDateIso)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - 90)
    return start.toISOString()
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    syncStatus,
    tokenStatus,
    lastSyncSummary,
    lastError,
    callbackMessage,
    accessTokenSecondsRemaining,
    refreshTokenSecondsRemaining,
    isSyncing,
    requiresReauth,
    expirationWarning,
    pollTokenStatus,
    consumeAuthCallbackFromQuery,
    clearCallbackMessage,
    refreshAccessToken,
    initiateOAuthFlow,
    syncSchwabWithAuth,
    ensureSyncedAfterUnlockOrAuth,
    syncSchwab,
    importCsv,
  }
})
