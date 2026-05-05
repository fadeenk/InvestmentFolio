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
import type { Position, PricePoint } from '~/types/vault'
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

  function addPosition(position: Position) {
    positions.value.push(position)
  }

  function updatePrices() {
    positions.value.forEach(pos => {
      const change = (Math.random() - 0.5) * 0.1 // ±5%
      pos.currentPrice = Math.max(0.01, pos.currentPrice * (1 + change))
    })
  }

  return { accounts, positions, priceHistory, totalValue, allocationByAsset, addPosition, updatePrices }
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
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run test/unit/stores/preferences.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePreferencesStore = defineStore('preferences', () => {
  const currency = ref<'USD' | 'EUR' | 'GBP'>('USD')
  const darkMode = ref(false)

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
  }

  function setCurrency(currency: 'USD' | 'EUR' | 'GBP') {
    currency.value = currency
  }

  return { currency, darkMode, toggleDarkMode, setCurrency }
}, {
  persist: true
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run test/unit/stores/preferences.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

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
  color: 'var(--color-primary)'
})

const chartData = computed(() => {
  if (!props.data || props.data.length === 0) return []
  return props.data.map(d => ({
    x: new Date(d.date),
    y: d.value
  }))
})
</script>

<template>
  <div v-if="chartData.length > 0" class="w-full h-64">
    <Line :data="chartData" :x="(d: any) => d.x" :y="(d: any) => d.y" :color="color" />
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
  colors: () => ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
})
</script>

<template>
  <div v-if="data.length > 0" class="w-full h-64">
    <Pie 
      :data="data" 
      :value="(d: any) => d.value" 
      :label="(d: any) => d.label"
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
  <div v-if="data.length > 0" class="w-full h-64">
    <Bar 
      :data="data" 
      :value="(d: any) => d.value" 
      :label="(d: any) => d.category"
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
  --color-green-50: #EFFDF5;
  --color-green-100: #DCFCE7;
  --color-green-200: #BBF7D0;
  --color-green-300: #86EFAC;
  --color-green-400: #4ADE80;
  --color-green-500: #22C55E;
  --color-green-600: #16A34A;
  --color-green-700: #15803D;
  --color-green-800: #166534;
  --color-green-900: #14532D;
  --color-green-950: #052E16;

  /* Semantic colors - light mode */
  --color-primary: var(--color-green-600);
  --color-secondary: var(--color-blue-600);
  --color-background: var(--color-white);
  --color-surface: var(--color-gray-50);
  --color-text: var(--color-gray-900);
}

/* Dark mode overrides */
.dark {
  --color-primary: var(--color-green-400);
  --color-secondary: var(--color-blue-400);
  --color-background: var(--color-gray-900);
  --color-surface: var(--color-gray-800);
  --color-text: var(--color-gray-100);
}
```

- [ ] **Step 3: Commit**

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
  
  // Apply dark class on initial load
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

- [ ] **Step 2: Commit**

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
    assetType: 'Stock',
    shares: 10,
    avgCost: 150,
    currentPrice: 155,
    costBasisMethod: 'FIFO'
  })
  
  portfolio.addPosition({
    id: '2',
    accountId: 'acc1',
    symbol: 'GOOGL',
    assetType: 'Stock',
    shares: 5,
    avgCost: 2800,
    currentPrice: 2850,
    costBasisMethod: 'FIFO'
  })

  // Sample price history
  portfolio.priceHistory = [
    { date: '2026-01-01', value: 10000 },
    { date: '2026-02-01', value: 10500 },
    { date: '2026-03-01', value: 11000 },
    { date: '2026-04-01', value: 10800 },
    { date: '2026-05-01', value: 11500 }
  ] as PricePoint[]
})
</script>

<template>
  <UContainer class="py-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-text">Investment Dashboard</h1>
      <div class="flex gap-4">
        <USelect 
          :modelValue="preferences.currency" 
          @update:modelValue="preferences.setCurrency($event)"
          :items="['USD', 'EUR', 'GBP']"
        />
        <UButton @click="preferences.toggleDarkMode()">
          {{ preferences.darkMode ? 'Light Mode' : 'Dark Mode' }}
        </UButton>
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

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Portfolio Value Over Time</h3>
        </template>
        <LineChart :data="portfolio.priceHistory" />
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Asset Allocation</h3>
        </template>
        <PieChart :data="allocationData" />
      </UCard>
    </div>

    <div class="grid grid-cols-1 gap-4">
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

- [ ] **Step 2: Commit**

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

- [ ] **Step 3: Commit**

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

---

### Task 14: Install Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install required packages**

```bash
cd frontend
npm install @pinia-plugin-persistedstate/nuxt @unovis/vue @unovis/ts @nuxt/ui
```

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "deps: add pinia persistence, unovis charting, and ensure nuxt ui"
```

---

## Plan Complete

Plan complete and saved to `docs/superpowers/plans/2026-05-05-configure-tailwind-pinia-unovis-plan.md`. Ready to execute?
