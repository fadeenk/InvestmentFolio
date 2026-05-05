# Folio — Developer Roadmap
---

## Overview

| Phase | Title |
|-------|-------|
| 1 | Foundation 
| 2 | Schwab Integration
| 3 | Dashboard & Views 
| 4 | Manual Entry & CSV
| 5 | Polish & Launch

---

## Phase 1 — Foundation · Weeks 1–4

Set up the project scaffold, encrypted vault, and Cloudflare Worker. Nothing works without these.

### Project scaffold `Setup`

- [ ] Initialize Nuxt 3 with TypeScript + Nuxt UI Dashboard template
- [ ] Configure Tailwind CSS, Pinia, and Unovis
- [ ] Set up `src/types/` directory with all enums and interfaces (`vault.ts`, `schwab.ts`, `enums.ts`)
- [ ] Configure `strict: true` in `tsconfig.json`
- [ ] Set up GitHub Pages deploy pipeline via `gh-pages` branch

### Vault encrypt/decrypt `Core`

- [ ] Implement binary vault file format: magic bytes + version + KDF params + IV + auth tag + ciphertext
- [ ] PBKDF2-HMAC-SHA256 key derivation at 600,000 iterations
- [ ] AES-256-GCM encrypt and decrypt via Web Crypto API
- [ ] Show "Unlocking vault..." spinner during PBKDF2 (300–800ms expected)
- [ ] Key marked non-extractable; zero key on lock/close

> **Blocks:** all data features

### Vault file I/O `Core`

- [ ] File System Access API: `showOpenFilePicker` + `createWritable` for Chrome/Edge
- [ ] `FileReader` API fallback download for Firefox/Safari
- [ ] Create vault screen: open existing or create new + set passphrase
- [ ] Show "saving..." and "saved" indicators after every write
- [ ] Auto-save prompt on navigate-away with unsaved changes

> **Depends on:** Vault encrypt/decrypt

### Cloudflare Worker skeleton `Backend`

- [ ] Create `/worker` project with Wrangler CLI + TypeScript
- [ ] Implement route stubs: `GET /auth/login`, `/auth/callback`, `POST /auth/refresh`, `GET /api/*`, `GET /auth/status`
- [ ] Configure Workers KV namespace `TOKENS`
- [ ] Set `SCHWAB_APP_KEY`, `SCHWAB_APP_SECRET`, `TOKEN_ENCRYPTION_KEY` as Worker secrets
- [ ] Add CORS headers to all proxied responses

### ⚠️ Open question

**Q1:** Should Chrome be the officially supported browser given File System Access API support? Decide before coding the fallback heavily.

---

## Phase 2 — Schwab Integration · Weeks 5–8

Wire up OAuth 2.0, token lifecycle, and all Schwab API endpoints. This is the highest-complexity block.

### OAuth 2.0 flow `Auth`

- [ ] Register Schwab developer app, select Accounts & Trading + Market Data production *(approval takes 1–3 business days — submit at the start of this phase)*
- [ ] Implement `/auth/login` redirect to Schwab consent page
- [ ] Implement `/auth/callback`: exchange code → tokens, AES-GCM encrypt tokens, store in KV
- [ ] Implement `/auth/refresh`: swap refresh token for new access token, update KV
- [ ] Frontend: detect token expiry, call `/auth/refresh` silently before API calls

> **Depends on:** Cloudflare Worker skeleton

### Account & position sync `API`

- [ ] `GET /trader/v1/accounts/accountNumbers` → store account hashes in vault metadata
- [ ] `GET /trader/v1/accounts?fields=positions` → balances, positions, cash
- [ ] Map Schwab account shapes to internal `Account` and `Position` interfaces
- [ ] Merge new positions into vault state; track `lastUpdatedAt` per account
- [ ] Display account selector pills in dashboard

> **Depends on:** OAuth 2.0 flow

### Transaction sync & mapping `API`

- [ ] `GET /trader/v1/accounts/{hash}/transactions` for up to 1 year per account
- [ ] Map all Schwab transaction types to Folio categories (`TRADE`, `DIVIDEND`, `REINVEST_DIVIDEND`, `CASH_IN_OR_CASH_OUT`, `JOURNAL`, `RECEIVE_AND_DELIVER`, `CORPORATE_ACTION`)
- [ ] Deduplication by transaction ID before merging into vault
- [ ] Tag imported transactions with `importSource: API`
- [ ] Handle `CORPORATE_ACTION`: surface user notification, flag lots for manual review

> **Depends on:** Account & position sync

### Market data & quotes `API`

- [ ] `GET /marketdata/v1/quotes?symbols=...` for all held symbols
- [ ] Store latest prices in vault `priceHistory`; update `currentBalance` per position
- [ ] `GET /marketdata/v1/pricehistory/{symbol}` on demand for chart data
- [ ] Worker: track Schwab API call rate; return `429` with `Retry-After` if limit approaching
- [ ] Frontend: queue sync retry on `429`; show "Sync paused" indicator

> **Depends on:** Account & position sync

### Token expiry & re-auth `Auth`

- [ ] Worker tracks refresh token expiry; return warning in `/auth/status` response
- [ ] Show banner 24 hours before refresh token expiry
- [ ] `GET /auth/status`: token expiry timestamps + connected account count
- [ ] Settings view: Schwab connection status, re-authorize button, token expiry timer
- [ ] On `401` mid-session: silently refresh; on refresh failure show non-blocking banner

> **Depends on:** OAuth 2.0 flow

### ⚠️ Open question

**Q2:** Schwab re-auth every 7 days is the biggest UX friction point. Decide whether to add browser notification reminders before building the settings UI.

---

## Phase 3 — Dashboard & Views · Weeks 9–13

Build all user-facing views on top of vault data: dashboard, positions, transactions, income, and settings.

### Dashboard view `UI`

- [ ] Summary metric cards: total value, today's G/L, unrealized G/L, realized G/L YTD, income YTD, cash
- [ ] Account selector pills (All + per-account) and time range selector (1D, 1W, 1M, 3M, YTD, 1Y, All)
- [ ] Portfolio value line chart from daily snapshots (Chart.js / Vue-ChartJS)
- [ ] Asset allocation horizontal bar: US Equity, International, Fixed Income, HSA, Cash
- [ ] Monthly income bar chart with dividend / interest toggle

> **Depends on:** Transaction sync, Market data

### Positions & tax lots `UI`

- [ ] Open positions table: symbol, quantity, avg cost, price, market value, unrealized G/L, day G/L, holding period
- [ ] Expandable row: tax lot breakdown per position
- [ ] Tax lot table: lot ID, acquired date, acquired price, qty, cost basis, current value, unrealized G/L, wash sale flag
- [ ] Cost basis method selector per account: FIFO (default), LIFO, Specific ID
- [ ] Closed positions tab: sold date, proceeds, realized G/L, short/long-term, tax year filter

> **Depends on:** Tax lot computation (Phase 4) — stub this view early and revisit

### Transactions view `UI`

- [ ] Table: date, account, type badge, symbol, description, quantity, price, amount
- [ ] Filter by: type, account, symbol, date range
- [ ] Tabs: All, Trades, Dividends, Interest, Transfers, Manual
- [ ] Edit / delete controls for manual and CSV-imported transactions
- [ ] Virtualized table for large datasets (TanStack Table v8)

> **Depends on:** Transaction sync

### Income view `UI`

- [ ] Year-over-year table: total dividends, qualified, ordinary, interest, HSA contributions per tax year
- [ ] Income by security: symbol, YTD total, prior year, income type breakdown
- [ ] Monthly calendar grid showing income received by month
- [ ] Filter by account and year

> **Depends on:** Transaction sync

### Settings view `UI`

- [ ] Schwab connection: status badge, re-authorize button, token expiry countdown
- [ ] Account management: add, edit, reorder, deactivate accounts
- [ ] Vault management: change passphrase, export vault as JSON, delete vault data
- [ ] Display preferences: currency/date format, default account filter, cost basis method, theme (light/dark/system)
- [ ] Mobile bottom navigation: collapses sidebar on small screens

> **Depends on:** Vault I/O, OAuth flow

### ⚠️ Open question

**Q7:** Validate Nuxt UI Dashboard template on iOS Safari before launch — the sidebar-to-bottom-nav collapse is untested on that browser.

---

## Phase 4 — Manual Entry & CSV · Weeks 14–16

Add manual account entry (Other/CASH accounts) and Optum CSV import. Unblocks non-Schwab users.

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
- [ ] Display disclaimer: *"This is not tax advice. Consult a CPA for accurate tax filing."*

### ⚠️ Open questions

**Q4:** Decide if Folio computes cost basis independently of Schwab or mirrors their method — independent computation enables what-if analysis but may diverge from official records.

**Q5:** Optum CSV format is TBD pending access to an export sample. Resolve this before building the parser — allow manual entry as a fallback in the interim.

---

## Phase 5 — Polish & Launch · Weeks 17–20

Error handling, edge cases, mobile QA, performance, and final deployment.

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

- [ ] Final `wrangler deploy` for Cloudflare Worker; verify KV namespace binding
- [ ] Nuxt static build: `npm run generate` → push `.output/public` to `gh-pages`
- [ ] Enable GitHub Pages in repo settings, confirm HTTPS
- [ ] Write first-time setup guide covering vault creation, Schwab OAuth, and first sync
- [ ] Document 7-day re-auth flow and manual vault backup steps

> **Depends on:** All phases complete

### Open questions resolution `Decision`

Resolve all remaining PRD open questions before locking the v1 scope:

| # | Question | Can decide independently? |
|---|----------|--------------------------|
| Q1 | Official browser support policy (Chrome-first vs equal Firefox/Safari fallback) | Yes — ideally in Phase 1 |
| Q3 | Vault file naming convention (`.foli` enforcement vs free naming with magic bytes) | Yes |
| Q6 | CASH account sub-categorization (checking / savings / money market) for v1 | Yes |
| Q8 | Single-user assumption or multi-vault support on shared machines | Yes |
