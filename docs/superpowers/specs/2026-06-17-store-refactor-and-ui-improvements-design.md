# InvestmentFolio: Store Refactor & UI Improvements

Date: 2026-06-17

## Motivation

Clean up 11 scattered Pinia stores by merging tightly-coupled data stores into one,
fix lingering UI issues (dark/light mode, mobile responsiveness, vault re-open),
and replace static Unovis charts with interactive ApexCharts.

## Changes

### 1. Store Consolidation (7 stores, down from 11)

**New layout:**

| Store    | Role                                                   | Notes                |
| -------- | ------------------------------------------------------ | -------------------- |
| `vault`  | Crypto/lifecycle/payload                               | Unchanged            |
| `data`   | Accounts + Transactions + Positions + Income + TaxLots | Merged from 5 stores |
| `market` | Market data sync                                       | Unchanged            |
| `oauth`  | Schwab OAuth                                           | Unchanged            |
| `sync`   | CSV import orchestration                               | Unchanged            |
| `ui`     | UI state (sidebar, modals, banners)                    | Unchanged            |
| `prefs`  | Persisted prefs (currency, darkMode)                   | Unchanged            |

**Deleted stores:** `accounts.store.ts`, `positions.store.ts`, `transactions.store.ts`, `income.store.ts`, `taxLots.store.ts`, `portfolio.ts` (legacy mock).

The new `data` store:

- Reads/writes `vaultStore.payload` via `mutatePayload()`
- Exports grouped accessors: `useDataStore().accounts`, `.transactions`, `.positions`, `.income`, `.taxLots`
- All callers update their imports to `useDataStore()` instead of individual stores
- Internally organized into clear sections (one per domain)

### 2. Backward Compatibility

- Vault binary format (magic bytes, PBKDF2, AES-256-GCM) — **100% unchanged**
- `VaultPayload` schema — **unchanged** (same fields, same types)
- No migration needed — old `.iFolio` files open without modification

### 3. ApexCharts (Interactive Charts)

Install `vue3-apexcharts` + `apexcharts`. Replace 2 base + 4 wrapper chart components:

| Current (Unovis)                         | Replacement (ApexCharts)              |
| ---------------------------------------- | ------------------------------------- |
| `charts/LineChart.vue`                   | Line with zoom/pan/tooltip            |
| `charts/PieChart.vue`                    | Donut with interactive legend + click |
| `dashboard/DashboardPortfolioChart.vue`  | Apex wrapper (line)                   |
| `dashboard/DashboardAllocationChart.vue` | Apex wrapper (donut)                  |
| `dashboard/DashboardIncomeChart.vue`     | Apex stacked bar                      |
| `dashboard/DashboardBalancesChart.vue`   | Apex area chart with series toggle    |

Charts remain presentational (props-only, no store imports). Dashboard page computes data as before.

Unovis dependency removed from `package.json`.

### 4. UI/UX Fixes

- **Dark/light mode**: Fix `theme.ts` plugin — ensure `useColorMode()` toggles all Nuxt UI v3 components. Remove CSS-only theme overrides that conflict.
- **Mobile responsiveness**: Grid layouts collapse to single column on small screens via `<UContainer>` + responsive grid classes. Navigation becomes `USheet` hamburger. Tables get horizontal scroll.
- **Remember last vault**: The `vaultHandleStore.ts` (IndexedDB) already exists. Fix landing page (`pages/index.vue`) to auto-open on app load if a valid handle is persisted. Add a "forget vault" option.
- **Navigation layout**: Header collapses to hamburger on mobile. Fix any layout shifts.

### 5. Documentation

- Update root `README.md` with new store structure
- Inline JSDoc on `data` store methods
- Remove/replace references to deleted stores in docs

## Non-Goals

- No changes to the vault crypto system
- No changes to the Cloudflare Worker
- No changes to the VaultPayload type or schema version
- No new features beyond the scope listed above
