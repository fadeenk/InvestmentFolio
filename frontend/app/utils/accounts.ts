import type { Account } from '@/types/vault'
import { AccountType } from '@/types/enums'

export function maskAccountNumber(accountNumber: string): string {
  const trimmed = accountNumber.trim()
  if (trimmed.length <= 4) {
    return trimmed
  }

  const suffix = trimmed.slice(-4)
  return `****${suffix}`
}

export function isCashAccount(account: Account): boolean {
  return account.type === AccountType.CASH
}
