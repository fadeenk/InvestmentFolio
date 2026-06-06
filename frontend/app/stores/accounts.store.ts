import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useVaultStore } from './vault.store'
import type { Account } from '@/types/vault'
import { AccountType, Bank, SyncMethod } from '@/types/enums'
import { randomUUID } from '@/utils/crypto'

function syncMethodForBank(bank: Bank): SyncMethod {
  if (bank === Bank.OPTUM) {
    return SyncMethod.CSVImport
  }

  return SyncMethod.Manual
}

function maskAccountNumber(accountNumber: string): string {
  const trimmed = accountNumber.trim()
  if (trimmed.length <= 4) {
    return trimmed
  }

  const suffix = trimmed.slice(-4)
  return `****${suffix}`
}

export const useAccountsStore = defineStore('accounts', () => {
  const vaultStore = useVaultStore()

  const all = computed<Account[]>(() => vaultStore.payload?.accounts ?? [])
  const active = computed(() => all.value.filter((a) => a.isActive))

  const optumAccounts = computed(() => active.value.filter((a) => a.bank === Bank.OPTUM))
  const manualAccounts = computed(() => active.value.filter((a) => a.bank === Bank.OTHER))

  function getById(id: string): Account | undefined {
    return all.value.find((a) => a.id === id)
  }

  function isCashAccount(account: Account): boolean {
    return account.type === AccountType.CASH
  }

  function addAccount(
    input: Omit<Account, 'id' | 'syncMethod' | 'currentBalance' | 'cashBalance' | 'lastUpdatedAt' | 'isActive'> & {
      initialBalance?: number
    },
  ): string {
    const id = randomUUID()
    const now = new Date().toISOString()

    const account: Account = {
      id,
      bank: input.bank,
      type: input.type,
      displayName: input.displayName,
      accountNumber: input.accountNumber,
      syncMethod: syncMethodForBank(input.bank),
      currentBalance: input.initialBalance ?? 0,
      cashBalance: input.type === AccountType.CASH ? (input.initialBalance ?? 0) : 0,
      lastUpdatedAt: now,
      isActive: true,
    }

    vaultStore.mutatePayload((p) => {
      p.accounts.push(account)
    })

    return id
  }

  function updateAccount(id: string, updates: Partial<Pick<Account, 'displayName' | 'accountNumber' | 'isActive' | 'currentBalance' | 'cashBalance'>>): void {
    vaultStore.mutatePayload((p) => {
      const account = p.accounts.find((a) => a.id === id)
      if (!account) throw new Error(`Account ${id} not found`)
      Object.assign(account, updates, { lastUpdatedAt: new Date().toISOString() })
    })
  }

  function updateBalance(id: string, currentBalance: number, cashBalance?: number): void {
    vaultStore.mutatePayload((p) => {
      const account = p.accounts.find((a) => a.id === id)
      if (!account) throw new Error(`Account ${id} not found`)
      account.currentBalance = currentBalance
      if (cashBalance !== undefined) account.cashBalance = cashBalance
      account.lastUpdatedAt = new Date().toISOString()
    })
  }

  function deactivateAccount(id: string): void {
    updateAccount(id, { isActive: false })
  }

  function reactivateAccount(id: string): void {
    updateAccount(id, { isActive: true })
  }

  function reorderAccounts(orderedIds: string[]): void {
    vaultStore.mutatePayload((p) => {
      const map = new Map(p.accounts.map((a) => [a.id, a]))
      p.accounts = orderedIds.map((id) => {
        const account = map.get(id)
        if (!account) throw new Error(`Account ${id} not found during reorder`)
        return account
      })
    })
  }

  return {
    all,
    active,
    optumAccounts,
    manualAccounts,
    getById,
    isCashAccount,
    maskAccountNumber,
    addAccount,
    updateAccount,
    updateBalance,
    deactivateAccount,
    reactivateAccount,
    reorderAccounts,
  }
})
