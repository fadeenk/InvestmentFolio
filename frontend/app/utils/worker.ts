import { useRuntimeConfig } from '#imports'

export function getWorkerBaseUrl(): string {
  try {
    const config = useRuntimeConfig()
    const runtimeUrl = config.public.workerUrl
    if (runtimeUrl) {
      return runtimeUrl.replace(/\/$/, '')
    }
  } catch {
    // Nuxt unavailable (e.g., unit tests), fall through to globals
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
