# iFolio — Developer Roadmap

---

## Overview

| Phase | Title              |
| ----- | ------------------ |
| 1     | Foundation         |
| 2     | Market Data & Sync |
| 3     | Dashboard & Views  |
| 4     | Manual Entry & CSV |
| 5     | Polish & Launch    |

---

## Phase 1 — Foundation · Weeks 1–4

Set up the project scaffold, encrypted vault, and Cloudflare Worker. Nothing works without these.

### Project scaffold `Setup`

- [x] Initialize Nuxt 3 with TypeScript + Nuxt UI Dashboard template
- [x] Configure Tailwind CSS, Pinia, and Unovis
- [x] Set up `src/types/` directory with all enums and interfaces (`vault.ts`, `schwab.ts`, `enums.ts`)
- [x] Configure `strict: true` in `tsconfig.json`

### Vault encrypt/decrypt `Core`

- [x] Implement binary vault file format: magic bytes + version + KDF params + IV + auth tag + ciphertext
- [x] PBKDF2-HMAC-SHA256 key derivation at 600,000 iterations
- [x] AES-256-GCM encrypt and decrypt via Web Crypto API
- [x] Show "Unlocking vault..." spinner during PBKDF2 (300–800ms expected)
- [x] Key marked non-extractable; zero key on lock/close

> **Blocks:** all data features

### Vault file I/O `Core`

- [x] File System Access API: `showOpenFilePicker` + `createWritable` for Chrome/Edge
- [x] `FileReader` API fallback download for Firefox/Safari
- [x] Create vault screen: open existing or create new + set passphrase
- [x] Show "saving..." and "saved" indicators after every write

> **Depends on:** Vault encrypt/decrypt

### Cloudflare Worker skeleton `Backend`

- [x] Create `/worker` project with Wrangler CLI + TypeScript
- [x] Implement route stubs: `GET /auth/login`, `/auth/callback`, `POST /auth/refresh`, `GET /api/*`, `GET /auth/status`
- [x] Configure Workers KV namespace `TOKENS`
- [x] Set `CLIENT_ID`, `CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` as Worker secrets

### Deploy

- [x] Deploy worker

## Phase 2 — Market Data & Sync · Weeks 5–8 (superseded)

This phase originally wired up Schwab OAuth + API integration. **Schwab has been replaced with Yahoo Finance** (free, no-key) — see [Yahoo Finance Market Data Spec](../superpowers/specs/2026-06-19-Yahoo-Finance-market-data.md) for details. The historical record is preserved below.

### Market data via Yahoo Finance (replaces Schwab)

- [x] Real-time quotes via Yahoo Finance `v8/finance/chart?range=1d`
- [x] 5-year price history via Yahoo Finance `v8/finance/chart?range={computed}`
- [x] Worker acts as CORS proxy + data transformer for Yahoo Finance
- [x] Remove all OAuth/auth infrastructure (Worker + frontend)
- [x] Frontend: remove Schwab connection UI, OAuth store
- [x] No authentication required for market data
- [x] Range auto-computed from earliest transaction date

### Account & CSV import (Schwab format) `Data`

- [x] Schwab CSV schema parser (`Date`, `Action`, `Symbol`, `Description`, `Quantity`, `Price`, `Fees & Comm`, `Amount`)
- [x] Map Schwab transaction types (Buy, Sell, Dividend, Transfer, Journal) to iFolio
- [x] Deduplication by external ID
- [x] Tag imported records with `importSource: CSV_IMPORT`

---

## Phase 3 — Dashboard & Views · Weeks 9–13

Build all user-facing views on top of vault data: dashboard, positions, transactions, income, and settings.

### Dashboard view `UI`

- [x] Summary metric cards: total value, today's G/L, unrealized G/L, realized G/L YTD, income YTD, cash
- [x] Account selector pills (All + per-account) and time range selector (1D, 1W, 1M, 3M, YTD, 1Y, All)
- [x] Portfolio value line chart from daily snapshots (Chart.js / Vue-ChartJS)
- [x] Asset allocation horizontal bar: US Equity, International, Fixed Income, HSA, Cash
- [x] Monthly income bar chart with dividend / interest toggle

> **Depends on:** Transaction sync, Market data

### Positions & tax lots `UI`

- [x] Open positions table: symbol, quantity, avg cost, price, market value, unrealized G/L, day G/L, holding period
- [x] Expandable row: tax lot breakdown per position
- [x] Tax lot table: lot ID, acquired date, acquired price, qty, cost basis, current value, unrealized G/L, wash sale flag
- [x] Cost basis method selector per account: FIFO (default), LIFO, Specific ID
- [x] Closed positions tab: sold date, proceeds, realized G/L, short/long-term, tax year filter

### Transactions view `UI`

- [x] Table: date, account, type badge, symbol, description, quantity, price, amount
- [x] Filter by: type, account, symbol, date range
- [x] Tabs: All, Trades, Dividends, Interest, Transfers, Manual
- [x] Edit / delete controls for manual and CSV-imported transactions
- [x] Virtualized table for large datasets (TanStack Table v8)

### Income view `UI`

- [x] Year-over-year table: total dividends, qualified, ordinary, interest, HSA contributions per tax year
- [x] Income by security: symbol, YTD total, prior year, income type breakdown
- [x] Monthly calendar grid showing income received by month
- [x] Filter by account and year

### Settings view `UI`

- [x] Account management: add, edit, reorder, deactivate accounts
- [x] Market data sync: refresh prices, cached symbols count, fetch progress
- [x] Vault management: change passphrase, export vault as JSON, delete vault data
- [x] Display preferences: currency/date format, default account filter, cost basis method, theme (light/dark/system)
- [x] Mobile bottom navigation: collapses sidebar on small screens

> **Depends on:** Vault I/O, OAuth flow

### ⚠️ Open question

**Q7:** Validate Nuxt UI Dashboard template on iOS Safari before launch — the sidebar-to-bottom-nav collapse is untested on that browser.

---

## Phase 4 — Manual Entry & CSV · Weeks 14–16

Add manual account entry (Other/CASH accounts) and Optum CSV import.

### Manual entry (Other accounts) `Data`

- [ ] Add/edit account form: bank = `OTHER`, account types `CASH` + all others
- [ ] Balance editor for CASH/manual accounts: update `currentBalance` directly
- [ ] Transaction entry form: date, type, symbol (optional), qty, price, amount, notes
- [ ] Tag all manual entries with `importSource: MANUAL`
- [ ] Edit and delete support for all manual transactions
- [ ] Inline validation: amount and date required; qty/price optional for CASH accounts

> **Depends on:** Vault I/O, Account data model

### CSV import (Optum) `Data`

- [ ] Drag-and-drop + file picker for CSV exports
- [ ] **TBD:** obtain Optum export sample and map columns to `Transaction` model
- [ ] Validate first 10 rows; show "Unrecognized CSV format" with instructions if headers missing
- [ ] Deduplication: flag matches on date + amount + type before import
- [ ] Tag imported records `importSource: CSV_IMPORT` with import timestamp
- [ ] Fallback: allow manual entry for Optum accounts until parser is confirmed

### Tax lot computation `Logic`

- [ ] FIFO, LIFO, and Specific Identification lot assignment on each sell transaction
- [ ] Compute realized G/L per closed lot: proceeds − cost basis, short vs long-term classification
- [ ] Wash sale detection: flag sells with a repurchase within 30-day window
- [ ] Adjust disallowed loss and cost basis on replacement lots
- [ ] Tax year summary: short-term G/L, long-term G/L, dividends, interest per year
- [ ] Display disclaimer: _"This is not tax advice. Consult a CPA for accurate tax filing."_

### ⚠️ Open questions

**Q4:** Decide if iFolio computes cost basis independently of Schwab or mirrors their method — independent computation enables what-if analysis but may diverge from official records.

**Q5:** Optum CSV format is TBD pending access to an export sample. Resolve this before building the parser — allow manual entry as a fallback in the interim.

---

## Phase 5 — Polish & Launch · Weeks 17–20

Error handling, edge cases, mobile QA, performance, and final deployment.

### FE Deployment

- [ ] Set up GitHub Pages deploy pipeline via `gh-pages` branch
- [ ] Worker URL noted and set as WORKER_URL GitHub Actions variable
- [ ] Frontend env updated with NUXT_PUBLIC_WORKER_URL
- [ ] Frontend deployed: GitHub Actions workflow triggered on push to main
- [ ] GitHub Pages enabled in repo Settings → Pages → gh-pages branch
- [ ] Worker allowed origin update to include production `worker\vitest.config.mts`

### Error handling & edge cases `Reliability`

- [ ] Wrong passphrase: show error, progressive delay after 3 attempts (1s / 2s / 4s), no data leak
- [ ] Corrupted vault: AES-GCM auth tag failure → "Vault appears corrupted or tampered" + backup suggestion
- [ ] Offline mode: all vault data read-only, sync button disabled with tooltip
- [ ] Large vault > 10 MB: progress indicator for JSON parse
- [ ] `CORPORATE_ACTION` notification: "Please review tax lots manually for {symbol}"

### Mobile QA `QA`

- [ ] Test sidebar → bottom-nav collapse on iOS Safari and Android Chrome
- [ ] Verify touch-optimized navigation across all views
- [ ] File picker behavior on mobile (File System Access API unavailable — test download fallback)
- [ ] Show "Manual save required" banner on Firefox and Safari
- [ ] Validate passphrase input and vault unlock UX on small screens

### Deployment & docs `Deploy`

- [ ] Final `wrangler deploy` for Cloudflare Worker; verify `FRONTEND_ORIGIN` var
- [ ] Nuxt static build: `npm run generate` → push `.output/public` to `gh-pages`
- [ ] Enable GitHub Pages in repo settings, confirm HTTPS
- [ ] Write first-time setup guide covering vault creation and CSV import
- [ ] Document manual vault backup steps

> **Depends on:** All phases complete

### Open questions resolution `Decision`

Resolve all remaining PRD open questions before locking the v1 scope:

| #   | Question                                                                           | Can decide independently? |
| --- | ---------------------------------------------------------------------------------- | ------------------------- |
| Q1  | Official browser support policy (Chrome-first vs equal Firefox/Safari fallback)    | Yes — ideally in Phase 1  |
| Q3  | Vault file naming convention (`.foli` enforcement vs free naming with magic bytes) | Yes                       |
| Q6  | CASH account sub-categorization (checking / savings / money market) for v1         | Yes                       |
| Q8  | Single-user assumption or multi-vault support on shared machines                   | Yes                       |
