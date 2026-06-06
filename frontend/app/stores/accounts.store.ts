import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useVaultStore } from './vault.store'
import type { Account } from '@/types/vault'
import { AccountType } from '@/types/enums'
import { randomUUID } from '@/utils/crypto'

export const useAccountsStore = defineStore('accounts', () => {
  const vaultStore = useVaultStore()

  const all = computed<Account[]>(() => vaultStore.payload?.accounts ?? [])

  function getById(id: string): Account | undefined {
    return all.value.find((a) => a.id === id)
  }

  function addAccount(
    input: Omit<Account, 'id' | 'currentBalance' | 'cashBalance' | 'lastUpdatedAt' | 'isActive'> & {
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
      currentBalance: input.initialBalance ?? 0,
      cashBalance: input.type === AccountType.CASH ? (input.initialBalance ?? 0) : 0,
      lastUpdatedAt: now,
    }

    vaultStore.mutatePayload((p) => {
      p.accounts.push(account)
    })

    return id
  }

  function updateAccount(id: string, updates: Partial<Pick<Account, 'displayName' | 'accountNumber' | 'currentBalance' | 'cashBalance'>>): void {
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
    getById,
    addAccount,
    updateAccount,
    updateBalance,
    reorderAccounts,
  }
})
