# InvestmentFolio (iFolio) — Showcase Notes

## Overview

A privacy-first, offline-capable personal investment portfolio tracker. All financial data is encrypted locally in the browser — no portfolio data ever touches a server. A lightweight Cloudflare Worker acts solely as a CORS proxy for Yahoo Finance market data. No authentication, no backend database, no recurring cost.

**Live:** [ifolio.mrkannah.com](https://ifolio.mrkannah.com)
**Worker:** `worker.mrkannah.workers.dev`

---

## Tech Stack

| Layer           | Technology                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **Framework**   | Nuxt 4 SPA (Vue 3, TypeScript 6)                                                                     |
| **State**       | Pinia 3 with persisted state                                                                         |
| **UI**          | Tailwind CSS 4, Nuxt UI 4, Nuxt Color Mode                                                           |
| **Charts**      | ApexCharts + vue3-apexcharts (area, donut, line, stacked bar)                                        |
| **Backend**     | Cloudflare Worker (TypeScript) — Yahoo Finance proxy                                                 |
| **Crypto**      | Web Crypto API — PBKDF2-HMAC-SHA256 (600K iterations), AES-256-GCM                                   |
| **Persistence** | File System Access API (primary), download fallback (Firefox/Safari), IndexedDB (handle store)       |
| **PWA**         | `@vite-pwa/nuxt` — installable, offline-capable with Service Worker caching                          |
| **Icons**       | Lucide + Simple Icons                                                                                |
| **Table**       | TanStack Table v8 (virtualized for large datasets)                                                   |
| **Testing**     | Vitest, `@nuxt/test-utils`, `@cloudflare/vitest-pool-workers`, happy-dom                             |
| **Linting**     | ESLint 10 (flat config), Prettier 3, Husky, lint-staged                                              |
| **CI/CD**       | GitHub Actions — lint → format check → typecheck → test → deploy (GitHub Pages + Cloudflare Workers) |

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pages     │────▶│   Pinia Stores   │────▶│ Chart Components│
│ (6 views)   │     │ (vault/data/mkt) │     │ (presentational)│
└─────────────┘     └───────┬──────────┘     └─────────────────┘
                            │
                     ┌──────▼──────┐
                     │ Ledger Engine│  Pure function: recalculateDerivedDataFromTransactions()
                     │ (utils/)    │  → positions, tax lots (FIFO), closed lots, income
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │ Vault Store │  Encrypt/decrypt via Web Crypto API
                     └──────┬──────┘
                            │
              ┌─────────────▼─────────────┐
              │  Encrypted .iFolio file   │  Binary: magic bytes + salt + IV + ciphertext
              │  (local filesystem)       │  AES-256-GCM at rest
              └───────────────────────────┘
```

**Key design decisions:**

- Charts never import stores directly — they receive data via props (presentational only)
- All types in `app/types/` — never inlined into components
- Ledger engine is a pure function: `recalculateDerivedDataFromTransactions()` — deterministic, testable, no side effects
- Worker has zero knowledge of user data — it's a transparent Yahoo Finance proxy

---

## Features

### 🔐 Encrypted Vault

- Binary vault format with `FOLI` magic bytes, version byte, KDF parameters
- PBKDF2-HMAC-SHA256 at 600,000 iterations (300–800ms unlock time with spinner)
- AES-256-GCM encryption (Web Crypto API, 12-byte IV, 16-byte auth tag)
- CryptoKey marked non-extractable; zeroed on lock
- Supports create vault → set passphrase → unlock → lock flow
- `beforeunload` handler for unsaved change detection

### 📊 Dashboard

- Summary metric cards: total value, daily G/L, unrealized G/L, realized G/L YTD, income YTD, cash
- Portfolio value line chart from daily balance snapshots
- Asset allocation donut: US Equity, International, Fixed Income, HSA, Cash
- Monthly income bar chart with dividend/interest toggle (multi-year, type-grouped)
- Portfolio performance chart
- Account filter pills (per-account + All) and time range selector (1D, 1W, 1M, 3M, YTD, 1Y, All)

### 📈 Positions & Tax Lots

- Open positions table: symbol, quantity, avg cost, current price, market value, unrealized G/L, day G/L, holding period
- Expandable row with per-lot breakdown
- Tax lot table: acquired date, price, qty, cost basis, current value, unrealized G/L, wash sale flag
- Cost basis method per account: FIFO (default), LIFO, Specific ID, Average Cost
- Closed positions tab with realized G/L, short/long-term classification, tax year filter

### 💰 Transactions

- Full CRUD for manual transactions
- Type badges: Buy, Sell, Dividend, Interest, Transfers, Journals
- Tabs: All / Trades / Dividends / Interest / Transfers / Manual
- Filters: type, account, symbol, date range, import source
- Edit/delete for manual and CSV-imported transactions
- Virtualized table via TanStack Table for large datasets

### 📅 Income View

- Year-over-year table: total dividends, qualified, ordinary, interest per tax year
- Income by security: symbol, YTD total, prior year, income type breakdown
- Monthly calendar grid showing income received by month
- Account and year filters

### 📂 CSV Import

- Bank-specific parsers for Schwab, Optum, and generic CSV format
- Schema validation, type/number/date normalization
- Transaction type mapping (Buy, Sell, Dividend, etc.) per bank
- Deduplication by external ID
- Tags imported records with `importSource: CSV_IMPORT`

### 🔄 Google Sheets Sync

- OAuth 2.0 via Google Identity Services
- Automatically writes account balances to a configurable Google Sheet
- Maps 4 named accounts to spreadsheet rows by year

### 🧮 Ledger Engine (Core Logic)

- Pure function `recalculateDerivedDataFromTransactions()` in ~315 lines
- Processes all transactions sorted chronologically
- Maintains per-account cash balance
- Builds tax lots from Buy transactions (FIFO lot matching on Sell)
- Computes realized G/L per closed lot, short-term vs long-term
- Generates income records from Dividend/Interest transactions
- Calculates positions with avg cost, market value, unrealized G/L
- Updates account balances (cash + market value)
- `roundCurrency()` to avoid floating-point drift
- `backfillClosedLots()` migration for vaults without closed lot history

### 🖥️ Cloudflare Worker

- Two endpoints: `GET /api/market/quotes` and `GET /api/market/history`
- Fans out parallel Yahoo Finance requests with 250ms stagger
- Retry logic: 3 attempts on 429, exponential backoff (up to 30s)
- Dynamic CORS origin from `FRONTEND_ORIGIN` env var (comma-separated)
- Minimal — ~125 lines of service code, no auth, no KV, no database

### 📱 PWA & Responsive Design

- Installable with standalone manifest (emerald theme)
- Service worker caches market data (NetworkFirst, 100 entries, 1-day TTL)
- Desktop: collapsible sidebar (icon-only to full on hover)
- Mobile: bottom tab navigation bar
- Dark mode (light/dark/system)
- Page transitions (opacity + translateY)

### ⚙️ Settings

- Account management: add, edit, reorder, deactivate
- Market data sync: refresh prices, cached symbols count, fetch progress
- Vault management: change passphrase, export vault as JSON, delete vault data
- Display preferences: currency format, date format (3 styles), default account filter, cost basis method, theme, default time range
- Remembered vault file via IndexedDB handle store

---

## Project Structure

```
ifolio/
├── frontend/                    # Nuxt 4 SPA
│   ├── app/
│   │   ├── app.vue              # Root: locked/unlocked shell, sidebar, nav, banner
│   │   ├── pages/               # 6 views: index, dashboard, positions, transactions, income, settings
│   │   ├── components/          # 10 base + 4 chart (Apex) + 8 dashboard
│   │   ├── stores/              # 6 Pinia stores
│   │   ├── types/               # enums.ts, vault.ts, index.ts
│   │   ├── utils/               # vault.ts, ledger.ts, csv.ts, crypto.ts, format.ts, worker.ts, accounts.ts
│   │   ├── composables/         # useVaultLanding, useGoogleSheetsSync
│   │   ├── plugins/             # apexcharts.client, dark-mode
│   │   └── assets/css/          # Tailwind + Nuxt UI + custom theme vars
│   ├── test/                    # 22 test files (unit + nuxt component)
│   ├── nuxt.config.ts
│   └── package.json
├── worker/                      # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts             # Route handler
│   │   ├── controllers/         # market.controller.ts
│   │   ├── services/            # market.service.ts (Yahoo Finance)
│   │   ├── types/               # market.ts
│   │   └── utils/               # http.ts (CORS, JSON responses)
│   ├── test/                    # index.spec.ts (224 lines)
│   ├── wrangler.jsonc
│   └── package.json
├── .github/workflows/           # ci.yml, deploy-frontend.yml, deploy-worker.yml
├── docs/superpowers/            # Design specs + implementation plans
├── AGENTS.md                    # Project agent instructions
├── Roadmap.md                   # Phased development roadmap
└── prettier.config.mjs          # Shared Prettier config
```

---

## Project Evolution

### Phase 1 — Foundation (Initial commits)

- Nuxt 4 SPA scaffold with TypeScript, Tailwind, Pinia
- Encrypted vault: binary format (FOLI magic bytes), PBKDF2 + AES-256-GCM
- Vault I/O: File System Access API + download fallback
- Cloudflare Worker skeleton

### Phase 2 — Market Data (Schwab → Yahoo Finance pivot)

- Originally built Schwab OAuth integration with Worker proxy
- **Pivoted to Yahoo Finance** — eliminated OAuth friction, 60% less Worker code, no KV dependency
- Worker became a lightweight CORS proxy for Yahoo `v8/finance/chart` endpoint
- CSV import for Schwab transaction format

### Phase 3 — Dashboard & Views

- Dashboard: metric cards, portfolio/allocation/balances/income charts
- Positions: open/closed, expandable tax lot rows, cost basis methods
- Transactions: full CRUD, filters, tabs, virtualized table
- Income: year-over-year, by security, monthly grid
- Settings: accounts, sync, vault management, display prefs

### Phase 4 — Polish & Launch

- PWA: installable with Service Worker, market data caching, update prompt
- CI/CD: GitHub Actions for lint → typecheck → test → deploy (GitHub Pages + Workers)
- Google Sheets sync for portfolio value export
- Responsive: sidebar desktop + bottom tab mobile
- Dark mode with system preference

---

## Key Technical Challenges Solved

1. **Deterministic ledger engine** that rebuilds all derived data (positions, lots, income) from raw transactions every time — ensures consistency after any mutation
2. **Browser-compatible strong encryption** using Web Crypto API — PBKDF2 at 600K iterations runs entirely client-side with a visible unlock spinner
3. **File System Access API** for native file save/open on Chromium, with full download-based fallback for Firefox/Safari — persistent vault handle via IndexedDB
4. **Pivoting from Schwab OAuth to Yahoo Finance** — removed all auth infrastructure, simplified Worker to a transparent proxy, eliminated recurring token management
5. **Zero `any`** type policy — every value typed explicitly, `unknown` + narrowing required, enforced in CI

---

## CI/CD Pipeline

```
PR to develop/main ──▶ Lint ──▶ Format Check ──▶ Typecheck ──▶ Test
                                                      │
                                           Push to main ──▶ Deploy
                                                      │
                                          ┌────────────┴────────────┐
                                     Frontend (Pages)         Worker (Workers)
```

---

## Links

- **Live App:** [ifolio.mrkannah.com](https://ifolio.mrkannah.com)
- **Worker:** `worker.mrkannah.workers.dev`
- **Repository:** github.com/mrkannah/InvestmentFolio
