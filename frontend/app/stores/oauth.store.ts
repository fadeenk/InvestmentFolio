import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useUiStore } from './ui'
import { useVaultStore } from './vault.store'
import { getWorkerBaseUrl } from '@/utils/worker'
import { TokenStatus } from '@/types/vault'
import type { SchwabAuthStatusResponse, SchwabRefreshResponse } from '@/types/schwab'

export const useOAuthStore = defineStore('oauth', () => {
  const vaultStore = useVaultStore()
  const uiStore = useUiStore()

  const tokenStatus = ref<TokenStatus>(TokenStatus.NOT_CONNECTED)
  const callbackMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

  const accessTokenSecondsRemaining = ref<number | null>(null)
  const accessTokenExpiresAtMs = ref<number | null>(null)
  const refreshTokenSecondsRemaining = ref<number | null>(null)
  const connectedAccountCount = ref(0)
  const lastStatusWarning = ref<string | null>(null)

  const requiresReauth = computed(() => tokenStatus.value === TokenStatus.EXPIRED || tokenStatus.value === TokenStatus.NOT_CONNECTED)

  const expirationWarning = computed(
    () => refreshTokenSecondsRemaining.value !== null && refreshTokenSecondsRemaining.value < 86_400 && refreshTokenSecondsRemaining.value > 0,
  )

  async function pollTokenStatus(): Promise<void> {
    const base = getWorkerBaseUrl()
    if (!base) return

    try {
      const resp = await fetch(`${base}/auth/status`, {
        headers: _bearerHeader(),
      })
      if (!resp.ok) {
        tokenStatus.value = TokenStatus.NOT_CONNECTED
        connectedAccountCount.value = 0
        accessTokenSecondsRemaining.value = null
        accessTokenExpiresAtMs.value = null
        refreshTokenSecondsRemaining.value = null
        return
      }

      const data: SchwabAuthStatusResponse = (await resp.json()) as SchwabAuthStatusResponse
      _applyTokenStatus(data)
      _syncStatusWarningBanner(data.warning)

      if (vaultStore.payload && data.isConnected) {
        vaultStore.mutatePayloadSilent((p) => {
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
      connectedAccountCount.value = 0
      accessTokenSecondsRemaining.value = null
      accessTokenExpiresAtMs.value = null
      refreshTokenSecondsRemaining.value = null
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
        uiStore.setBanner('warning', 'Schwab session expired. Re-authorize to continue syncing.')
        return false
      }

      const data: SchwabRefreshResponse = (await resp.json()) as SchwabRefreshResponse
      if (data.success && data.accessTokenExpiresAt) {
        await pollTokenStatus()
        return true
      }
      tokenStatus.value = TokenStatus.EXPIRED
      uiStore.setBanner('warning', 'Schwab session expired. Re-authorize to continue syncing.')
      return false
    } catch {
      uiStore.setBanner('warning', 'Could not refresh Schwab session. Re-authorize to continue syncing.')
      return false
    }
  }

  function initiateOAuthFlow(): void {
    const base = getWorkerBaseUrl()
    if (!base) throw new Error('Worker URL not configured')
    window.location.href = `${base}/auth/login`
  }

  async function ensureSyncedAfterUnlockOrAuth(): Promise<void> {
    await pollTokenStatus()
  }

  function _bearerHeader(): HeadersInit {
    return { Accept: 'application/json' }
  }

  function _applyTokenStatus(data: SchwabAuthStatusResponse): void {
    connectedAccountCount.value = data.connectedAccountCount

    if (!data.isConnected) {
      tokenStatus.value = TokenStatus.NOT_CONNECTED
      accessTokenSecondsRemaining.value = null
      accessTokenExpiresAtMs.value = null
      refreshTokenSecondsRemaining.value = null
      return
    }

    const now = Date.now()
    const refreshSeconds =
      data.refreshTokenSecondsRemaining ??
      (data.refreshTokenExpiresAt ? Math.max(0, Math.floor((new Date(data.refreshTokenExpiresAt).getTime() - now) / 1000)) : null)
    const accessSeconds =
      data.accessTokenSecondsRemaining ??
      (data.accessTokenExpiresAt ? Math.max(0, Math.floor((new Date(data.accessTokenExpiresAt).getTime() - now) / 1000)) : null)

    refreshTokenSecondsRemaining.value = refreshSeconds
    accessTokenSecondsRemaining.value = accessSeconds
    accessTokenExpiresAtMs.value = data.accessTokenExpiresAt ? new Date(data.accessTokenExpiresAt).getTime() : null

    if (refreshSeconds !== null && refreshSeconds <= 0) {
      tokenStatus.value = TokenStatus.EXPIRED
      return
    }

    if (accessSeconds !== null && accessSeconds < 60) {
      tokenStatus.value = TokenStatus.EXPIRING_SOON
      return
    }

    tokenStatus.value = TokenStatus.VALID
  }

  function _syncStatusWarningBanner(warning: string | null): void {
    if (!warning) {
      lastStatusWarning.value = null
      return
    }

    if (warning === lastStatusWarning.value) {
      return
    }

    lastStatusWarning.value = warning
    uiStore.setBanner('warning', warning)
  }

  return {
    tokenStatus,
    callbackMessage,
    accessTokenSecondsRemaining,
    refreshTokenSecondsRemaining,
    connectedAccountCount,
    requiresReauth,
    expirationWarning,
    pollTokenStatus,
    consumeAuthCallbackFromQuery,
    clearCallbackMessage,
    refreshAccessToken,
    initiateOAuthFlow,
    ensureSyncedAfterUnlockOrAuth,
  }
})
