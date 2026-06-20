import { readonly, ref, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import { useOAuthStore } from '~/stores/oauth.store'
import { useVaultStore } from '~/stores/vault.store'
import { VaultStatus } from '~/types/vault'
import { getMeta, getHandleStatus, pickAndReRemember, isAvailable } from '~/utils/vaultHandleStore'

export type LandingFlow = 'idle' | 'unlock' | 'open' | 'create'
export type RememberedState = 'none' | 'valid' | 'expired'

export function useVaultLanding() {
  const vault = useVaultStore()
  const router = useRouter()
  const route = useRoute()

  const flow = ref<LandingFlow>('idle')
  const rememberedState = ref<RememberedState>('none')
  const rememberedFileName = ref<string | null>(null)
  const rememberedOpenedAt = ref<string | null>(null)
  const passphrase = ref('')
  const passphraseConfirm = ref('')
  const passphraseError = ref('')
  const isBusy = ref(false)

  async function determineRememberedState() {
    const meta = getMeta()
    if (!meta) {
      rememberedState.value = 'none'
      rememberedFileName.value = null
      rememberedOpenedAt.value = null
      return
    }
    rememberedFileName.value = meta.fileName
    rememberedOpenedAt.value = meta.lastOpenedAt

    const status = await getHandleStatus()
    if (status === 'valid') {
      rememberedState.value = 'valid'
    } else if (status === 'expired') {
      rememberedState.value = 'expired'
    } else {
      rememberedState.value = 'none'
    }
  }

  function startFlow(type: LandingFlow) {
    if (type === 'idle') return
    flow.value = type
    passphraseError.value = ''
  }

  function cancelFlow() {
    flow.value = 'idle'
    passphrase.value = ''
    passphraseConfirm.value = ''
    passphraseError.value = ''
  }

  async function executeFlow() {
    if (flow.value === 'create') {
      if (passphrase.value.length < 8) {
        passphraseError.value = 'Passphrase must be at least 8 characters'
        return
      }
      if (passphrase.value !== passphraseConfirm.value) {
        passphraseError.value = 'Passphrases do not match'
        return
      }
    } else if (!passphrase.value) {
      passphraseError.value = 'Enter your vault passphrase'
      return
    }

    isBusy.value = true
    passphraseError.value = ''

    try {
      if (flow.value === 'create') {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'folio.iFolio',
          types: [
            {
              description: 'iFolio Vault',
              accept: { 'application/octet-stream': ['.iFolio'] },
            },
          ],
        })
        await vault.setFileHandle(handle)
        await vault.createVault(passphrase.value)
        await router.push('/dashboard')
      } else if (flow.value === 'open') {
        const supportsPicker = isAvailable()
        if (supportsPicker) {
          const [handle] = await window.showOpenFilePicker({
            types: [
              {
                description: 'iFolio Vault',
                accept: { 'application/octet-stream': ['.iFolio'] },
              },
            ],
          })
          if (!handle) return
          await vault.openVault(handle, passphrase.value)
        } else {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.iFolio'
          input.click()
          const file = await new Promise<File | null>((resolve) => {
            input.onchange = () => resolve(input.files?.[0] ?? null)
          })
          if (!file) return
          await vault.openVault(file, passphrase.value)
        }
        await router.push('/dashboard')
      } else if (flow.value === 'unlock') {
        if (rememberedState.value === 'expired') {
          const handle = await pickAndReRemember()
          if (!handle) return
          await vault.openVault(handle, passphrase.value)
        } else {
          const handle = await vault.tryQuickOpen()
          if (!handle) {
            passphraseError.value = 'Could not access the remembered vault file — please select it manually'
            forgetVault()
            return
          }
          await vault.openVault(handle, passphrase.value)
        }
        await router.push('/dashboard')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (vault.lastError) passphraseError.value = vault.lastError
    } finally {
      isBusy.value = false
    }
  }

  function forgetVault() {
    vault.forgetHandle()
    rememberedFileName.value = null
    rememberedOpenedAt.value = null
    rememberedState.value = 'none'
    flow.value = 'idle'
    passphrase.value = ''
    passphraseConfirm.value = ''
    passphraseError.value = ''
  }

  function queryToSearchParams(): URLSearchParams {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(route.query)) {
      if (Array.isArray(value)) {
        if (value[0]) params.set(key, value[0])
        continue
      }
      if (value) params.set(key, value)
    }
    return params
  }

  async function applyAuthCallbackStateFromQuery() {
    const auth = route.query.auth
    if (!auth) return

    const oauth = useOAuthStore()
    const authConnected = auth === 'connected'

    oauth.consumeAuthCallbackFromQuery(queryToSearchParams())
    oauth.clearCallbackMessage()

    const nextQuery: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(route.query)) {
      if (key === 'auth' || key === 'reason') continue
      if (Array.isArray(value)) {
        const filteredValues = value.filter((item): item is string => item !== null)
        if (filteredValues.length > 0) nextQuery[key] = filteredValues
        continue
      }
      if (value !== null) nextQuery[key] = value
    }

    await router.replace({ query: nextQuery })

    if (authConnected && vault.status === VaultStatus.UNLOCKED) {
      await oauth.ensureSyncedAfterUnlockOrAuth()
    }
  }

  onMounted(async () => {
    await determineRememberedState()
    await applyAuthCallbackStateFromQuery()
  })

  return {
    flow: readonly(flow),
    rememberedState: readonly(rememberedState),
    rememberedFileName: readonly(rememberedFileName),
    rememberedOpenedAt: readonly(rememberedOpenedAt),
    passphrase,
    passphraseConfirm,
    passphraseError,
    isBusy: readonly(isBusy),
    startFlow,
    cancelFlow,
    executeFlow,
    forgetVault,
  }
}
