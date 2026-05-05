import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Account, Position, PricePoint } from '~/types/vault'
import { AssetType } from '~/types/enums'

export const usePortfolioStore = defineStore('portfolio', () => {
  const accounts = ref<Account[]>([])
  const positions = ref<Position[]>([])
  const priceHistory = ref<PricePoint[]>([])

  const totalValue = computed(() => {
    return positions.value.reduce((sum, pos) => sum + pos.shares * pos.currentPrice, 0)
  })

  const allocationByAsset = computed(() => {
    const groups: Record<string, number> = {}
    positions.value.forEach(pos => {
      const key = pos.assetType
      groups[key] = (groups[key] || 0) + (pos.shares * pos.currentPrice)
    })
    return Object.entries(groups).map(([label, value]) => ({ label, value }))
  })

  function addAccount(account: Account) {
    if (!account.id || !account.name) {
      console.warn('Invalid account: id and name are required')
      return
    }
    accounts.value.push(account)
  }

  function addPosition(position: Position) {
    if (position.shares <= 0) {
      console.warn('Invalid position: shares must be > 0')
      return
    }
    if (position.avgCost <= 0) {
      console.warn('Invalid position: avgCost must be > 0')
      return
    }
    positions.value.push(position)
  }

  function updatePrices() {
    positions.value.forEach(pos => {
      const change = (Math.random() - 0.5) * 0.1 // ±5%
      pos.currentPrice = Math.max(0.01, pos.currentPrice * (1 + change))
    })
  }

  return { accounts, positions, priceHistory, totalValue, allocationByAsset, addAccount, addPosition, updatePrices }
})