import { ref } from 'vue'
import { useVaultStore } from '~/stores/vault.store'
import { usePositionsStore } from '~/stores/positions.store'

export type SyncState = 'idle' | 'authenticating' | 'loading' | 'success' | 'error'

const SPREADSHEET_ID = '1xd5WcdjLdeZGSQcJL3qOEP-1bT_sOma9f7HEzDyImQA'
const SHEET_NAME = 'Stock market'
const START_ROW = 12
const START_YEAR = 2026

const ACCOUNT_NAMES = {
  schwabTraditional: 'Schwab Traditional',
  schwabRoth: 'Schwab Roth',
  optum: 'Optum Investments',
  schwabIndividual: 'Schwab Individual',
} as const

function loadGisLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.google !== 'undefined' && window.google.accounts) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

function getAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const g = window.google
      if (!g) {
        reject(new Error('Google Identity Services not loaded'))
        return
      }
      const client = g.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: (response) => {
          if (response.access_token) {
            resolve(response.access_token)
          } else {
            reject(new Error(response.error_description ?? 'OAuth failed'))
          }
        },
      })
      client.requestAccessToken()
    } catch (err) {
      reject(err instanceof Error ? err : new Error('OAuth error'))
    }
  })
}

export function useGoogleSheetsSync() {
  const state = ref<SyncState>('idle')
  const error = ref<string | null>(null)

  async function sync(): Promise<void> {
    const vaultStore = useVaultStore()
    const positionsStore = usePositionsStore()

    const clientId = vaultStore.payload?.googleSheetsClientId
    if (!clientId) {
      error.value = 'Google Client ID not configured'
      state.value = 'error'
      return
    }

    state.value = 'authenticating'
    error.value = null

    try {
      await loadGisLibrary()
      const token = await getAccessToken(clientId)

      state.value = 'loading'

      const year = new Date().getFullYear()
      const accounts = vaultStore.accounts
      const positions = positionsStore.latest

      const marketValueForAccount = (displayName: string): number => {
        const account = accounts.find((a) => a.displayName === displayName)
        if (!account) return 0
        return positions.filter((p) => p.accountId === account.id).reduce((s, p) => s + p.marketValue, 0)
      }

      const schwabTraditional = marketValueForAccount(ACCOUNT_NAMES.schwabTraditional)
      const schwabRoth = marketValueForAccount(ACCOUNT_NAMES.schwabRoth)
      const optumInvestments = marketValueForAccount(ACCOUNT_NAMES.optum)
      const schwabIndividual = marketValueForAccount(ACCOUNT_NAMES.schwabIndividual)

      const rowNumber = START_ROW + (year - START_YEAR)
      const range = `'${SHEET_NAME}'!A${rowNumber}:D${rowNumber}`
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[year, schwabTraditional + schwabRoth, optumInvestments, schwabIndividual]],
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Sheets API error (${response.status}): ${body}`)
      }

      state.value = 'success'
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Sync failed'
      state.value = 'error'
    }
  }

  function reset(): void {
    state.value = 'idle'
    error.value = null
  }

  return { state, error, sync, reset }
}
