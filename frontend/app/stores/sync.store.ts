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
import type { SchwabAuthStatusResponse, SchwabRefreshResponse } from '@/types/schwab'
import { SyncStatus, TokenStatus } from '@/types/vault'

// ---------------------------------------------------------------------------
// Worker URL — injected at build time via Nuxt runtimeConfig
// ---------------------------------------------------------------------------

function getWorkerBaseUrl(): string {
  // Access via useRuntimeConfig() in a real Nuxt context.
  // Provided here as a standalone fallback for testing.
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, string>
    return w.__FOLIO_WORKER_URL__ ?? ''
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

  // ── State ──────────────────────────────────────────────────────────────────

  const syncStatus = ref<SyncStatus>(SyncStatus.IDLE)
  const tokenStatus = ref<TokenStatus>(TokenStatus.NOT_CONNECTED)
  const lastSyncSummary = ref<SyncSummary | null>(null)
  const lastError = ref<string | null>(null)

  /** Seconds until the access token expires. Updated by pollTokenStatus(). */
  const accessTokenSecondsRemaining = ref<number | null>(null)
  /** Seconds until the refresh token expires. */
  const refreshTokenSecondsRemaining = ref<number | null>(null)

  /** True while a sync is actively running. */
  const isSyncing = computed(() => syncStatus.value === SyncStatus.IN_PROGRESS)

  /** True when the user should be prompted to re-authorize with Schwab. */
  const requiresReauth = computed(
    () =>
      tokenStatus.value === TokenStatus.EXPIRED || tokenStatus.value === TokenStatus.NOT_CONNECTED,
  )

  /** True when the refresh token expires within 24 hours. */
  const expirationWarning = computed(
    () =>
      refreshTokenSecondsRemaining.value !== null &&
      refreshTokenSecondsRemaining.value < 86_400 &&
      refreshTokenSecondsRemaining.value > 0,
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
      if (data.success) {
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
      const accountsResp = await _workerGet(`${base}/api/accounts?fields=positions`)
      if (!accountsResp.ok) {
        if (accountsResp.status === 401) {
          const refreshed = await refreshAccessToken()
          if (!refreshed) throw new Error('Token refresh failed — re-authorization required')
          // Retry once
          const retry = await _workerGet(`${base}/api/accounts?fields=positions`)
          if (!retry.ok) throw new Error(`Accounts API error: ${retry.status}`)
        } else if (accountsResp.status === 429) {
          const retryAfter = accountsResp.headers.get('Retry-After') ?? '60'
          syncStatus.value = SyncStatus.RATE_LIMITED
          throw new Error(`Rate limited — retry after ${retryAfter}s`)
        } else {
          throw new Error(`Accounts API error: ${accountsResp.status}`)
        }
      }

      // Mapper wiring point:
      // const accountsData: SchwabAccountsResponse = await accountsResp.json()
      // const { accountsSynced, positionsUpdated } = await mapper.applyAccounts(accountsData)
      // summary.accountsSynced = accountsSynced
      // summary.positionsUpdated = positionsUpdated

      // 3. Fetch transactions for each Schwab account hash
      // Wiring point: iterate vault schwabAccountHashes, call /api/accounts/{hash}/transactions

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
  async function importCsv(
    _file: File,
    _accountId: string,
  ): Promise<{ added: number; duplicates: number; errors: string[] }> {
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
    // In production, the Bearer token is a short-lived JWT issued by the Worker
    // after OAuth, stored in the vault metadata (access-token-echoed form).
    // Implementation: read from vault metadata → schwabTokenMeta → accessToken.
    // For now, stub with an empty Authorization header.
    return { Authorization: 'Bearer ', 'Content-Type': 'application/json' }
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

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    syncStatus,
    tokenStatus,
    lastSyncSummary,
    lastError,
    accessTokenSecondsRemaining,
    refreshTokenSecondsRemaining,
    isSyncing,
    requiresReauth,
    expirationWarning,
    pollTokenStatus,
    refreshAccessToken,
    initiateOAuthFlow,
    syncSchwab,
    importCsv,
  }
})
