import { setActivePinia, createPinia } from 'pinia'
import { usePortfolioStore } from '~/stores/portfolio'

describe('portfolio store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Mock Math.random for deterministic updatePrices test
    // Use 0.6 to get a positive change (0.6 - 0.5) * 0.1 = 0.01 → 1% increase
    vi.spyOn(Math, 'random').mockReturnValue(0.6)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should add a position', () => {
    const store = usePortfolioStore()
    const position = {
      id: '1',
      accountId: 'acc1',
      symbol: 'AAPL',
      assetType: 'Stock' as const,
      shares: 10,
      avgCost: 150,
      currentPrice: 155,
      costBasisMethod: 'FIFO' as const
    }
    store.addPosition(position)
    expect(store.positions.length).toBe(1)
    expect(store.positions[0].symbol).toBe('AAPL')
  })

  it('should calculate totalValue', () => {
    const store = usePortfolioStore()
    store.addPosition({
      id: '1',
      accountId: 'acc1',
      symbol: 'AAPL',
      assetType: 'Stock' as const,
      shares: 10,
      avgCost: 150,
      currentPrice: 155,
      costBasisMethod: 'FIFO' as const
    })
    expect(store.totalValue).toBe(1550) // 10 * 155
  })

  it('should calculate allocationByAsset', () => {
    const store = usePortfolioStore()
    store.addPosition({
      id: '1',
      accountId: 'acc1',
      symbol: 'AAPL',
      assetType: 'Stock' as const,
      shares: 10,
      avgCost: 150,
      currentPrice: 155,
      costBasisMethod: 'FIFO' as const
    })
    store.addPosition({
      id: '2',
      accountId: 'acc1',
      symbol: 'GOOGL',
      assetType: 'Stock' as const,
      shares: 5,
      avgCost: 2800,
      currentPrice: 2850,
      costBasisMethod: 'FIFO' as const
    })
    const allocation = store.allocationByAsset
    expect(allocation.length).toBe(1) // Both are Stock
    expect(allocation[0].label).toBe('Stock')
    expect(allocation[0].value).toBe(1550 + 14250) // 10*155 + 5*2850
  })

  it('should add account', () => {
    const store = usePortfolioStore()
    store.addAccount({
      id: 'acc1',
      bank: 'Chase' as const,
      type: 'Taxable' as const,
      name: 'Main Account',
      number: '123456'
    })
    expect(store.accounts.length).toBe(1)
  })

  it('should reject invalid position', () => {
    const store = usePortfolioStore()
    const warnSpy = vi.spyOn(console, 'warn')
    store.addPosition({
      id: '1',
      accountId: 'acc1',
      symbol: 'AAPL',
      assetType: 'Stock' as const,
      shares: 0, // Invalid
      avgCost: 150,
      currentPrice: 155,
      costBasisMethod: 'FIFO' as const
    })
    expect(store.positions.length).toBe(0)
    expect(warnSpy).toHaveBeenCalled()
  })

  it('should update prices', () => {
    const store = usePortfolioStore()
    store.addPosition({
      id: '1',
      accountId: 'acc1',
      symbol: 'AAPL',
      assetType: 'Stock' as const,
      shares: 10,
      avgCost: 150,
      currentPrice: 155,
      costBasisMethod: 'FIFO' as const
    })
    const originalPrice = store.positions[0].currentPrice
    store.updatePrices()
    // Price should have changed (±5%)
    expect(store.positions[0].currentPrice).not.toBe(originalPrice)
    expect(store.positions[0].currentPrice).toBeGreaterThan(originalPrice * 0.95)
    expect(store.positions[0].currentPrice).toBeLessThan(originalPrice * 1.05)
  })

  it('should reject invalid account', () => {
    const store = usePortfolioStore()
    const warnSpy = vi.spyOn(console, 'warn')
    store.addAccount({
      id: '', // Invalid
      bank: 'Chase' as const,
      type: 'Taxable' as const,
      name: 'Test',
      number: '123'
    })
    expect(store.accounts.length).toBe(0)
    expect(warnSpy).toHaveBeenCalled()
  })
})