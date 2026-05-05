# Configure Tailwind CSS, Pinia, and Unovis Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Tailwind CSS v4, Pinia state management, and Unovis charting library in the InvestmentFolio Nuxt 4 app with proper TypeScript types, stores, components, and theme extension.

**Architecture:** Modular structure with types in `types/`, stores in `stores/`, chart components in `components/charts/`, and a sample dashboard page. Uses Composition API for stores, props-only for chart components, and CSS-based theming for Tailwind v4.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Tailwind CSS v4, Pinia, Unovis, @nuxt/ui

---

## File Structure

| File | Responsibility |
|------|-----------------|
| `frontend/app/types/enums.ts` | Enum definitions (Bank, AccountType, etc.) |
| `frontend/app/types/vault.ts` | Interface definitions (Account, Position, etc.) |
| `frontend/app/stores/portfolio.ts` | Portfolio holdings state, getters, actions |
| `frontend/app/stores/preferences.ts` | User settings with persistence |
| `frontend/app/stores/ui.ts` | UI state (sidebar, modals) |
| `frontend/app/components/charts/LineChart.vue` | Portfolio value time-series chart |
| `frontend/app/components/charts/PieChart.vue` | Asset allocation doughnut chart |
| `frontend/app/components/charts/BarChart.vue` | Asset comparison bar chart |
| `frontend/app/pages/dashboard.vue` | Sample dashboard wiring stores + charts |
| `frontend/app/plugins/dark-mode.ts` | Dark mode class sync plugin |
| `frontend/app/assets/css/main.css` | Tailwind v4 theme extension |
| `frontend/nuxt.config.ts` | Add Pinia persistence, colorMode config |
| `frontend/vitest.config.ts` | Verify Nuxt test utils config |

---

## Chunk 1: Type Definitions

### Task 1: Create `types/enums.ts`

**Files:**
- Create: `frontend/app/types/enums.ts`

- [ ] **Step 1: Write the enum definitions**

```typescript
export enum Bank {
  Chase = 'Chase',
  Schwab = 'Schwab',
  Fidelity = 'Fidelity',
  ETrade = 'ETrade',
  Other = 'Other'
}

export enum AccountType {
  Taxable = 'Taxable',
  IRA = 'IRA',
  RothIRA = 'RothIRA',
  k401 = '401k',
  HSA = 'HSA',
  Plan529 = '529'
}

export enum SyncMethod {
  Manual = 'Manual',
  SchwabAPI = 'SchwabAPI',
  CSVImport = 'CSVImport'
}

export enum TransactionType {
  Buy = 'Buy',
  Sell = 'Sell',
  Dividend = 'Dividend',
  Split = 'Split',
  Transfer = 'Transfer'
}

export enum AssetType {
  Stock = 'Stock',
  Bond = 'Bond',
  ETF = 'ETF',
  MutualFund = 'MutualFund',
  Cash = 'Cash',
  Crypto = 'Crypto'
}

export enum CostBasisMethod {
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  SpecificLot = 'SpecificLot',
  AverageCost = 'AverageCost'
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/types/enums.ts
git commit -m "feat: add enum type definitions for banking and investment types"
```

---

### Task 2: Create `types/vault.ts`

**Files:**
- Create: `frontend/app/types/vault.ts`

- [ ] **Step 1: Write the interface definitions**

```typescript
import { Bank, AccountType, TransactionType, AssetType, CostBasisMethod } from './enums'

export interface Account {
  id: string
  bank: Bank
  type: AccountType
  name: string
  number: string
}

export interface Transaction {
  id: string
  accountId: string
  type: TransactionType
  assetType: AssetType
  symbol: string
  shares: number
  price: number
  date: string
}

export interface Position {
  id: string
  accountId: string
  symbol: string
  assetType: AssetType
  shares: number
  avgCost: number
  currentPrice: number
  costBasisMethod: CostBasisMethod
}

export interface PricePoint {
  date: string // ISO 8601 format (YYYY-MM-DD)
  value: number
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/types/vault.ts
git commit -m "feat: add vault type definitions for accounts, positions, and transactions"
```

---

## Chunk 2: Pinia Stores

### Task 3: Create `stores/portfolio.ts`

**Files:**
- Create: `frontend/app/stores/portfolio.ts`
- Test: `frontend/test/unit/stores/portfolio.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { usePortfolioStore } from '~/stores/portfolio'

describe('portfolio store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Mock Math.random for deterministic updatePrices test
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run test/unit/stores/portfolio.test.ts
```

Expected: FAIL with "Cannot find module ~/stores/portfolio"

- [ ] **Step 3: Write minimal implementation**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run test/unit/stores/portfolio.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app/stores/portfolio.ts frontend/test/unit/stores/portfolio.test.ts
git commit -m "feat: add portfolio store with positions, price history, and computed getters"
```

---

### Task 4: Create `stores/preferences.ts`

**Files:**
- Create: `frontend/app/stores/preferences.ts`
- Test: `frontend/test/unit/stores/preferences.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { usePreferencesStore } from '~/stores/preferences'

describe('preferences store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should toggle dark mode', () => {
    const store = usePreferencesStore()
    expect(store.darkMode).toBe(false)
    store.toggleDarkMode()
    expect(store.darkMode).toBe(true)
  })

  it('should set currency', () => {
    const store = usePreferencesStore()
    store.setCurrency('EUR')
    expect(store.currency).toBe('EUR')
  })

  it('should persist currency to localStorage', () => {
    const store = usePreferencesStore()
    store.setCurrency('EUR')
    const stored = JSON.parse(localStorage.getItem('preferences') || '{}')
    expect(stored.currency).toBe('EUR')
  })
})
```

- [ ] **Step 2: Note dependencies**

> **Note:** Task 14 (Chunk 6) installs `@pinia-plugin-persistedstate/nuxt`. To run persistence tests, execute this task after Chunk 6, or install the package first:
> ```bash
> cd frontend && npm install @pinia-plugin-persistedstate/nuxt
> ```

> **Note:** This task requires Vitest and Pinia test utilities. Ensure they are installed:
> ```bash
> cd frontend && npm install vitest @pinia/nuxt
> ```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd frontend && npx vitest run test/unit/stores/preferences.test.ts
```

Expected: FAIL (if plugin not installed, persistence test may fail)

- [ ] **Step 4: Write minimal implementation**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePreferencesStore = defineStore('preferences', () => {
  const currency = ref<'USD' | 'EUR' | 'GBP'>('USD')
  const darkMode = ref(false)

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
  }

  function setCurrency(newCurrency: 'USD' | 'EUR' | 'GBP') {
    currency.value = newCurrency
  }

  return { currency, darkMode, toggleDarkMode, setCurrency }
}, {
  persist: true
})
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npx vitest run test/unit/stores/preferences.test.ts
```

Expected: PASS (if plugin installed)

- [ ] **Step 6: Commit**

```bash
git add frontend/app/stores/preferences.ts frontend/test/unit/stores/preferences.test.ts
git commit -m "feat: add preferences store with currency and dark mode, with persistence"
```

---

### Task 5: Create `stores/ui.ts`

**Files:**
- Create: `frontend/app/stores/ui.ts`
- Test: `frontend/test/unit/stores/ui.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '~/stores/ui'

describe('ui store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should toggle sidebar', () => {
    const store = useUiStore()
    expect(store.sidebarOpen).toBe(false)
    store.toggleSidebar()
    expect(store.sidebarOpen).toBe(true)
  })

  it('should open and close modal', () => {
    const store = useUiStore()
    store.openModal('settings')
    expect(store.activeModal).toBe('settings')
    store.closeModal()
    expect(store.activeModal).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run test/unit/stores/ui.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const activeModal = ref<string | null>(null)

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function openModal(modal: string) {
    activeModal.value = modal
  }

  function closeModal() {
    activeModal.value = null
  }

  return { sidebarOpen, activeModal, toggleSidebar, openModal, closeModal }
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run test/unit/stores/ui.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app/stores/ui.ts frontend/test/unit/stores/ui.test.ts
git commit -m "feat: add UI store for sidebar and modal state management"
```

---

## Chunk 3: Unovis Chart Components

### Task 6: Create `components/charts/LineChart.vue`

**Files:**
- Create: `frontend/app/components/charts/LineChart.vue`
- Test: `frontend/test/nuxt/components/charts/LineChart.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { mount } from '@nuxt/test-utils'
import LineChart from '~/components/charts/LineChart.vue'

describe('LineChart', () => {
  it('should render with data', () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [
          { date: '2026-01-01', value: 10000 },
          { date: '2026-01-02', value: 10500 }
        ]
      }
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('should show fallback for empty data', () => {
    const wrapper = mount(LineChart, {
      props: { data: [] }
    })
    expect(wrapper.text()).toContain('No data available')
  })

  it('should use xKey and yKey props', () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [
          { date: '2026-01-01', value: 10000 },
          { date: '2026-01-02', value: 10500 }
        ],
        xKey: 'date',
        yKey: 'value'
      }
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run test/nuxt/components/charts/LineChart.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```vue
<script setup lang="ts">
import { Line } from '@unovis/vue'
import type { PricePoint } from '~/types/vault'

const props = withDefaults(defineProps<{
  data: PricePoint[]
  xKey?: string
  yKey?: string
  color?: string
}>(), {
  xKey: 'date',
  yKey: 'value',
  color: '--color-primary'
})

const chartData = computed(() => {
  if (!props.data || props.data.length === 0) return []
  return props.data.map(d => ({
    x: new Date(d[props.xKey as keyof PricePoint] as string),
    y: d[props.yKey as keyof PricePoint] as number
  }))
})
</script>

<template>
  <div v-if="chartData.length > 0" class="w-full h-64 p-4">
    <Line :data="chartData" :x="(d: { x: Date }) => d.x" :y="(d: { y: number }) => d.y" :color="`var(${color})`" />
  </div>
  <div v-else class="w-full h-64 flex items-center justify-center text-gray-500">
    No data available
  </div>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run test/nuxt/components/charts/LineChart.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/charts/LineChart.vue frontend/test/nuxt/components/charts/LineChart.test.ts
git commit -m "feat: add LineChart component for portfolio value time-series"
```

---

### Task 7: Create `components/charts/PieChart.vue`

**Files:**
- Create: `frontend/app/components/charts/PieChart.vue`
- Test: `frontend/test/nuxt/components/charts/PieChart.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { mount } from '@nuxt/test-utils'
import PieChart from '~/components/charts/PieChart.vue'

describe('PieChart', () => {
  it('should render with data', () => {
    const wrapper = mount(PieChart, {
      props: {
        data: [
          { label: 'Stocks', value: 6000 },
          { label: 'Bonds', value: 4000 }
        ]
      }
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('should show fallback for empty data', () => {
    const wrapper = mount(PieChart, {
      props: { data: [] }
    })
    expect(wrapper.text()).toContain('No data available')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run test/nuxt/components/charts/PieChart.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```vue
<script setup lang="ts">
import { Pie } from '@unovis/vue'

const props = withDefaults(defineProps<{
  data: { label: string; value: number }[]
  innerRadius?: number
  colors?: string[]
}>(), {
  innerRadius: 0.6,
  colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
})
</script>

<template>
  <div v-if="data.length > 0" class="w-full h-64 p-4">
    <Pie 
      :data="data" 
      :value="(d: { value: number }) => d.value" 
      :label="(d: { label: string }) => d.label"
      :innerRadius="innerRadius"
      :colors="colors"
    />
  </div>
  <div v-else class="w-full h-64 flex items-center justify-center text-gray-500">
    No data available
  </div>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run test/nuxt/components/charts/PieChart.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/charts/PieChart.vue frontend/test/nuxt/components/charts/PieChart.test.ts
git commit -m "feat: add PieChart component for asset allocation visualization"
```

---

### Task 8: Create `components/charts/BarChart.vue`

**Files:**
- Create: `frontend/app/components/charts/BarChart.vue`
- Test: `frontend/test/nuxt/components/charts/BarChart.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { mount } from '@nuxt/test-utils'
import BarChart from '~/components/charts/BarChart.vue'

describe('BarChart', () => {
  it('should render with data', () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [
          { category: 'AAPL', value: 1550 },
          { category: 'GOOGL', value: 2800 }
        ]
      }
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('should show fallback for empty data', () => {
    const wrapper = mount(BarChart, {
      props: { data: [] }
    })
    expect(wrapper.text()).toContain('No data available')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run test/nuxt/components/charts/BarChart.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```vue
<script setup lang="ts">
import { Bar } from '@unovis/vue'

const props = withDefaults(defineProps<{
  data: { category: string; value: number }[]
  orientation?: 'vertical' | 'horizontal'
}>(), {
  orientation: 'vertical'
})
</script>

<template>
  <div v-if="data.length > 0" class="w-full h-64 p-4">
    <Bar 
      :data="data" 
      :value="(d: { value: number }) => d.value" 
      :label="(d: { category: string }) => d.category"
      :orientation="orientation"
    />
  </div>
  <div v-else class="w-full h-64 flex items-center justify-center text-gray-500">
    No data available
  </div>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run test/nuxt/components/charts/BarChart.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/charts/BarChart.vue frontend/test/nuxt/components/charts/BarChart.test.ts
git commit -m "feat: add BarChart component for asset comparison visualization"
```

---

## Chunk 4: Tailwind Theme Extension

### Task 9: Update `assets/css/main.css`

**Files:**
- Modify: `frontend/app/assets/css/main.css`

- [ ] **Step 1: Read current file**

```bash
cat frontend/app/assets/css/main.css
```

- [ ] **Step 2: Update with theme extensions**

Replace content with:

```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  --font-sans: 'Public Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Green palette (existing) */
  --color-green-50: #f0fdf4;
  --color-green-100: #dcfce7;
  --color-green-200: #bbf7d0;
  --color-green-300: #86efac;
  --color-green-400: #4ade80;
  --color-green-500: #22c55e;
  --color-green-600: #16a34a;
  --color-green-700: #15803d;
  --color-green-800: #166534;
  --color-green-900: #14532d;
  --color-green-950: #052e16;

  /* Semantic colors - light mode */
  --color-primary: var(--color-green-600);
  --color-secondary: var(--color-blue-600);
  --color-background: var(--color-white);
  --color-surface: var(--color-gray-50);
  --color-text: var(--color-gray-900);

  /* Dark mode overrides */
  @variant dark {
    --color-primary: var(--color-green-400);
    --color-secondary: var(--color-blue-400);
    --color-background: var(--color-gray-900);
    --color-surface: var(--color-gray-800);
    --color-text: var(--color-gray-100);
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no Tailwind compilation errors

- [ ] **Step 4: Commit**

```bash
git add frontend/app/assets/css/main.css
git commit -m "feat: extend Tailwind theme with dark mode, semantic colors, and mono font"
```

---

## Chunk 5: Dashboard Page & Plugin

### Task 10: Create `plugins/dark-mode.ts`

**Files:**
- Create: `frontend/app/plugins/dark-mode.ts`

- [ ] **Step 1: Write the plugin**

```typescript
import { defineNuxtPlugin } from '#app'
import { usePreferencesStore } from '~/stores/preferences'

export default defineNuxtPlugin(() => {
  const preferences = usePreferencesStore()
  
  // Apply dark class on initial load with error handling for corrupted data
  try {
    const stored = localStorage.getItem('preferences')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.darkMode !== undefined) {
        preferences.darkMode = parsed.darkMode
      }
    }
  } catch (e) {
    console.warn('Corrupted preferences data, resetting to defaults')
    localStorage.removeItem('preferences')
    preferences.$reset()
  }

  useHead({
    htmlAttrs: {
      class: preferences.darkMode ? 'dark' : ''
    }
  })

  // Watch for changes and update reactively
  watch(() => preferences.darkMode, (isDark) => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, { immediate: true })
})
```

- [ ] **Step 2: Verify plugin loads**

```bash
cd frontend && npm run build
```

Expected: Build succeeds, plugin registered

- [ ] **Step 3: Commit**

```bash
git add frontend/app/plugins/dark-mode.ts
git commit -m "feat: add dark mode plugin for syncing preferences with Tailwind class"
```

---

### Task 11: Create `pages/dashboard.vue`

**Files:**
- Create: `frontend/app/pages/dashboard.vue`

- [ ] **Step 1: Write the dashboard page**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { usePortfolioStore } from '~/stores/portfolio'
import { usePreferencesStore } from '~/stores/preferences'
import { useUiStore } from '~/stores/ui'
import LineChart from '~/components/charts/LineChart.vue'
import PieChart from '~/components/charts/PieChart.vue'
import BarChart from '~/components/charts/BarChart.vue'
import type { PricePoint } from '~/types/vault'
import { AssetType } from '~/types/enums'

const portfolio = usePortfolioStore()
const preferences = usePreferencesStore()
const ui = useUiStore()

// Computed data for charts
const allocationData = computed(() => portfolio.allocationByAsset)

const assetComparison = computed(() => {
  return portfolio.positions.map(pos => ({
    category: pos.symbol,
    value: pos.shares * pos.currentPrice
  }))
})

// Sample data for demo
onMounted(() => {
  // Add sample positions
  portfolio.addPosition({
    id: '1',
    accountId: 'acc1',
    symbol: 'AAPL',
    assetType: AssetType.Stock,
    shares: 10,
    avgCost: 150,
    currentPrice: 155,
    costBasisMethod: 'FIFO'
  })
  
  portfolio.addPosition({
    id: '2',
    accountId: 'acc1',
    symbol: 'GOOGL',
    assetType: AssetType.Stock,
    shares: 5,
    avgCost: 2800,
    currentPrice: 2850,
    costBasisMethod: 'FIFO'
  })

  // Sample price history (6 months per spec)
  portfolio.priceHistory = [
    { date: '2026-01-01', value: 10000 },
    { date: '2026-02-01', value: 10500 },
    { date: '2026-03-01', value: 11000 },
    { date: '2026-04-01', value: 10800 },
    { date: '2026-05-01', value: 11500 },
    { date: '2026-06-01', value: 12000 }
  ] as PricePoint[]
})
</script>

<template>
  <UContainer class="py-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-text">Investment Dashboard</h1>
      <div class="flex gap-4 items-center">
        <USelect 
          :modelValue="preferences.currency" 
          @update:modelValue="preferences.setCurrency($event)"
          :items="['USD', 'EUR', 'GBP']"
        />
        <UButton @click="preferences.toggleDarkMode()">
          {{ preferences.darkMode ? 'Light Mode' : 'Dark Mode' }}
        </UButton>
        <span class="text-sm text-gray-500">
          Sidebar: {{ ui.sidebarOpen ? 'Open' : 'Closed' }}
        </span>
      </div>
    </div>

    <div class="mb-6">
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Total Portfolio Value</h2>
        </template>
        <p class="text-3xl font-bold text-primary">
          {{ portfolio.totalValue.toLocaleString() }} {{ preferences.currency }}
        </p>
      </UCard>
    </div>

    <div class="mb-6">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Portfolio Value Over Time</h3>
        </template>
        <LineChart :data="portfolio.priceHistory" />
      </UCard>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Asset Allocation</h3>
        </template>
        <PieChart :data="allocationData" />
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Asset Comparison</h3>
        </template>
        <BarChart :data="assetComparison" />
      </UCard>
    </div>
  </UContainer>
</template>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/app/pages/dashboard.vue
git commit -m "feat: add dashboard page wiring stores, charts, and dark mode toggle"
```

---

## Chunk 6: Configuration Updates

### Task 12: Update `nuxt.config.ts`

**Files:**
- Modify: `frontend/nuxt.config.ts`

- [ ] **Step 1: Read current config**

```bash
cat frontend/nuxt.config.ts
```

- [ ] **Step 2: Add required modules and config**

Add to modules array: `'@pinia-plugin-persistedstate/nuxt'`

Add colorMode config:

```typescript
export default defineNuxtConfig({
  // existing config...
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt' // Add this
  ],
  colorMode: {
    classSuffix: '' // For Tailwind dark mode class strategy
  },
  // rest of config...
})
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no configuration errors

- [ ] **Step 4: Commit**

```bash
git add frontend/nuxt.config.ts
git commit -m "feat: add Pinia persistence plugin and colorMode config for dark mode"
```

---

### Task 13: Verify `vitest.config.ts`

**Files:**
- Verify: `frontend/vitest.config.ts`

- [ ] **Step 1: Check if config has Nuxt test utils**

```bash
cat frontend/vitest.config.ts
```

Expected content:

```typescript
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  // Nuxt test config
})
```

- [ ] **Step 2: Update if needed**

If not configured correctly, update to match above.

- [ ] **Step 3: Commit (if changed)**

```bash
git add frontend/vitest.config.ts
git commit -m "fix: ensure vitest config uses Nuxt test utils for component testing"
```

Expected: Commit only if `vitest.config.ts` was modified. If already correct, skip this task.

---

### Task 14: Install Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install required packages**

```bash
cd frontend
npm install @pinia-plugin-persistedstate/nuxt @unovis/vue @unovis/ts @nuxt/ui vitest @nuxt/test-utils
```

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "deps: add pinia persistence, unovis charting, and ensure nuxt ui"
```

---

## Plan Complete

Plan complete and saved to `docs/superpowers/plans/2026-05-05-configure-tailwind-pinia-unovis-plan.md`. Ready to execute?
