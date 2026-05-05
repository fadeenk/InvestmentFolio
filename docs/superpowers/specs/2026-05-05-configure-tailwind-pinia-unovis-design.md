# Design: Configure Tailwind CSS, Pinia, and Unovis

## 1. Architecture & Structure

The project is a Nuxt 4 app with three workspaces: `frontend/`, `worker/`, and root. For this configuration task, we focus on `frontend/app/`.

We adopt a modular structure:

```
frontend/app/
├── assets/css/main.css          # Tailwind v4 theme extension
├── stores/
│   ├── portfolio.ts              # Holdings, asset data
│   ├── preferences.ts            # User settings (currency, theme)
│   └── ui.ts                    # UI state (sidebar, modals)
├── components/
│   └── charts/
│       ├── LineChart.vue         # Portfolio value over time
│       ├── PieChart.vue          # Allocation breakdown
│       └── BarChart.vue         # Asset comparison
├── pages/
│   └── dashboard.vue            # Sample page wiring stores + charts
├── types/                        # Enums and interfaces (per notes.md)
│   ├── vault.ts
│   ├── schwab.ts
│   └── enums.ts
└── app.vue                       # Root component (already exists)
```

- **Pinia stores** are registered via `@pinia/nuxt` module (already in `nuxt.config.ts`). Each store uses the Composition API (`defineStore`). Stores are independent.
- **Unovis components** are plain Vue components that import from `@unovis/vue`. They receive data via props from the dashboard page, which fetches from stores or static sample data.
- **Tailwind CSS v4** uses CSS-based theming via `@theme` in `main.css`. We extend the existing green palette, add dark mode, semantic colors, and a secondary font.
- **Data flow**: Dashboard page → reads from Pinia stores → passes data to chart components as props. No direct store import in chart components; they remain presentational.

---

## 2. Type Definitions (per notes.md)

All data models live under `frontend/types/`, never inlined into components.

### `types/enums.ts`
Define enums with values:
- `Bank`: `Chase`, `Schwab`, `Fidelity`, `ETrade`, `Other`
- `AccountType`: `Taxable`, `IRA`, `RothIRA`, `401k`, `HSA`, `529`
- `SyncMethod`: `Manual`, `SchwabAPI`, `CSVImport`
- `TransactionType`: `Buy`, `Sell`, `Dividend`, `Split`, `Transfer`
- `AssetType`: `Stock`, `Bond`, `ETF`, `MutualFund`, `Cash`, `Crypto`
- `CostBasisMethod`: `FIFO`, `LIFO`, `SpecificLot`, `AverageCost`

### `types/vault.ts`
Define interfaces with properties (only those used in this spec):
- `Account`: `{ id: string; bank: Bank; type: AccountType; name: string; number: string }`
- `Transaction`: `{ id: string; accountId: string; type: TransactionType; assetType: AssetType; symbol: string; shares: number; price: number; date: string }`
- `Position`: `{ id: string; accountId: string; symbol: string; assetType: AssetType; shares: number; avgCost: number; currentPrice: number; costBasisMethod: CostBasisMethod }`
- `PricePoint`: `{ date: string; value: number }`

**Rule:** No `any`. Use `unknown` + type narrowing, or `satisfies` operator.

---

## 3. Pinia Stores

All stores use Composition API (`setup` stores) for type safety with Vue 3 + TypeScript.

### `stores/portfolio.ts`
- **Purpose**: Manage investment holdings and historical portfolio value.
- **State**:
  - `accounts: Account[]` (from vault.ts)
  - `positions: Position[]` (from vault.ts)
  - `priceHistory: PricePoint[]` (for time-series charts)
- **Getters**:
  - `totalValue`: Sum of `position.shares * position.currentPrice` for all positions
  - `allocationByAsset`: Groups positions by `AssetType`, returns `{ label: string; value: number }[]` where value is sum of (shares * currentPrice) per asset type
- **Actions**: 
  - `addPosition(position: Position)`: Adds a new position to `positions` array
  - `updatePrices()`: Simulates price updates by randomly adjusting `currentPrice` (±5%) for demo purposes

### `stores/preferences.ts`
- **Purpose**: Persist user-facing settings.
- **State**:
  - `currency: 'USD' | 'EUR' | 'GBP'` (default 'USD')
  - `darkMode: boolean` (synced with Tailwind dark class)
- **Actions**: `toggleDarkMode`, `setCurrency`
- **Persistence**: Use `pinia-plugin-persistedstate` (install as Nuxt module `@pinia-plugin-persistedstate/nuxt`). Configure store with `{ persist: true }` to save to localStorage.
- **Initial sync**: Create a Nuxt plugin `plugins/dark-mode.ts` that reads `preferences.darkMode` on app load and applies `.dark` class to `<html>` via `useHead({ htmlAttrs: { class: preferences.darkMode ? 'dark' : '' } })`.
- **Error handling**: If localStorage data is corrupted (parse error), catch error in plugin and reset to defaults.

### `stores/ui.ts`
- **Purpose**: Manage transient UI state.
- **State**:
  - `sidebarOpen: boolean`
  - `activeModal: string | null`
- **Actions**: `toggleSidebar`, `openModal`, `closeModal`

All stores are auto-imported by `@pinia/nuxt`. Types imported from `~/types/vault` and `~/types/enums`.

---

## 3.5 Package Installation

Install required packages (some already installed per project exploration):
```bash
cd frontend
npm install @pinia-plugin-persistedstate/nuxt @unovis/vue @unovis/ts vitest @nuxt/test-utils @nuxt/ui
```

Verify existing packages: `tailwindcss`, `pinia`, `@pinia/nuxt` (already installed).

---

## 4. Unovis Chart Components

Three presentational Vue components under `components/charts/`. Each receives data via props and renders using `@unovis/vue`. Decoupled from stores.

### `components/charts/LineChart.vue`
- **Props**:
  - `data: PricePoint[]` (from types/vault.ts)
  - `xKey?: string` (default `'date'`)
  - `yKey?: string` (default `'value'`)
  - `color?: string` (default `'--color-primary'`)
- **Implementation**: Import `Line` from `@unovis/vue`. Transform `PricePoint[]` to `{ x: new Date(d.date), y: d.value }[]` format. `date` is ISO 8601 string (YYYY-MM-DD). Wrap in `<div class="w-full h-64">`.
- **Use case**: Portfolio value over time.

### `components/charts/PieChart.vue`
- **Props**:
  - `data: { label: string; value: number }[]` (computed from positions grouped by `AssetType`)
  - `innerRadius?: number` (default `0.6` for doughnut)
  - `colors?: string[]`
- **Implementation**: Import `Pie` from `@unovis/vue`. Show allocation by asset class.
- **Use case**: Allocation breakdown (Stocks, Bonds, ETFs).

### `components/charts/BarChart.vue`
- **Props**:
  - `data: { category: string; value: number }[]`
  - `orientation?: 'vertical' | 'horizontal'` (default `'vertical'`)
- **Implementation**: Import `Bar` from `@unovis/vue`. Compare assets by return or market value.
- **Use case**: Asset comparison chart.

All components use Tailwind for layout (`w-full`, `h-64`, `p-4`).

---

## 5. Tailwind Theme Extension

Tailwind CSS v4 uses CSS-based theming via `@theme` in `main.css`.

### Current Setup (already in `main.css`)
- `@import "tailwindcss"` and `@import "@nuxt/ui"`
- Custom green palette (`--color-green-50` through `--color-green-950`)
- `--font-sans: 'Public Sans', sans-serif`

### Extensions
1. **Dark mode** — Use `class` strategy so `preferences.ts` store can toggle via adding/removing `dark` class on `<html>`. Configure in `nuxt.config.ts` with `colorMode: { classSuffix: '' }` for Nuxt UI v4.
2. **Semantic color tokens** — Add in `@theme` with `.dark` variants:
   - `--color-primary: var(--color-green-600)` / `.dark: --color-primary: var(--color-green-400)`
   - `--color-secondary: var(--color-blue-600)` / `.dark: --color-secondary: var(--color-blue-400)`
   - `--color-background: var(--color-white)` / `.dark: --color-background: var(--color-gray-900)`
   - `--color-surface: var(--color-gray-50)` / `.dark: --color-surface: var(--color-gray-800)`
   - `--color-text: var(--color-gray-900)` / `.dark: --color-text: var(--color-gray-100)`
3. **Secondary font** — Add `--font-mono: 'JetBrains Mono', monospace` for financial data.
4. **Dark mode colors** — Use `.dark` class variants in `@theme` block to redefine colors when `.dark` class is present on `<html>`.

---

## 6. Dashboard Page Integration

Sample page demonstrating everything working together.

### `pages/dashboard.vue`
- **Template**: Uses Nuxt UI components (`UContainer`, `UCard`, `UButton`, `USelect`).
- **Store integration**:
  - `usePortfolioStore()` — reads `positions`, `priceHistory`, `totalValue`
  - `usePreferencesStore()` — reads `darkMode`, `currency`; calls `toggleDarkMode()`, `setCurrency()`
  - `useUiStore()` — reads `sidebarOpen`
- **Chart wiring**:
  - Pass `portfolio.priceHistory` → `<LineChart>`
  - Compute `allocationData` from `portfolio.positions` grouped by `AssetType` → `<PieChart>`
  - Compute `assetComparison` from positions → `<BarChart>`
- **Dark mode toggle**: `<UButton>` calls `preferences.toggleDarkMode()`. The `plugins/dark-mode.ts` plugin handles adding/removing `dark` class on `<html>` reactively.
- **Currency selector**: `<USelect>` bound to `preferences.currency` with options `['USD','EUR','GBP']`.
- **Sample data**: In `onMounted`, populate stores with hardcoded sample data (2-3 positions, 6 months of price history).
- **Layout**: Grid layout with Tailwind (`grid grid-cols-1 md:grid-cols-2 gap-4`). LineChart full width on top, PieChart + BarChart side by side below.

---

## 7. Error Handling & Testing

### Error Handling
- **Unovis components**: 
  - If `data` prop is empty or malformed, render a fallback `<div>` with "No data available".
  - Validate required props: `data` must be array, `xKey`/`yKey` must exist in data objects.
- **Pinia stores**: Actions validate inputs (e.g., `shares > 0`, `avgCost > 0`). Use `console.warn` for invalid inputs with type guards.
- **Dark mode**: `useHead` composable in `dashboard.vue` ensures synchronization.
- **Persisted preferences**: Catch localStorage parse errors, reset to defaults on corruption.

### Testing (per notes.md TDD workflow)
**TDD Process (from notes.md):**
1. Write failing tests (TDD red phase)
2. Implement to make tests pass (green phase)
3. Refactor if needed (refactor phase)

**Test Implementation:**
- **Test config**: Ensure `vitest.config.ts` exists with Nuxt test utils integration:
  ```ts
  import { defineVitestConfig } from '@nuxt/test-utils/config'
  export default defineVitestConfig({ /* Nuxt test config */ })
  ```
- **Unit tests** (`test/unit/`): Test store actions/getters with Vitest + `@pinia/nuxt` testing utilities. Example: `portfolioStore.addPosition(...)` then assert `portfolioStore.positions.length`.
- **Component tests** (`test/nuxt/`): Use `@nuxt/test-utils` to mount chart components with sample props and assert rendered output (Unovis SVG elements).
- **No `any` types**. Use `unknown` + narrowing or `satisfies` operator. Violations fail CI lint check.

---

## 8. Summary

This design provides a full integration of Tailwind CSS v4, Pinia, and Unovis in the InvestmentFolio Nuxt 4 app. It follows project conventions (types in `types/`, no `any`, TDD workflow), creates reusable components and stores, and demonstrates everything with a sample dashboard page.

**Key files to create/modify:**
1. `frontend/app/types/enums.ts`
2. `frontend/app/types/vault.ts`
3. `frontend/app/stores/portfolio.ts`
4. `frontend/app/stores/preferences.ts`
5. `frontend/app/stores/ui.ts`
6. `frontend/app/components/charts/LineChart.vue`
7. `frontend/app/components/charts/PieChart.vue`
8. `frontend/app/components/charts/BarChart.vue`
9. `frontend/app/pages/dashboard.vue`
10. `frontend/app/plugins/dark-mode.ts`
11. Update `frontend/app/assets/css/main.css`
12. Update `frontend/nuxt.config.ts` (add `@pinia-plugin-persistedstate/nuxt` and `colorMode` config)
13. Verify `frontend/vitest.config.ts` has Nuxt test utils config
