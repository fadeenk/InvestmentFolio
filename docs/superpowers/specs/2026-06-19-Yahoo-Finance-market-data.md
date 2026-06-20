# Replace Schwab API with Yahoo Finance (no-key market data)

**Date:** 2026-06-19
**Status:** Approved design

## Overview

Replace the Schwab API (OAuth + market data proxy) with the free, no-key Yahoo Finance
unofficial API. The Cloudflare Worker stays but is stripped down to a lightweight CORS
proxy and data transformer for Yahoo Finance. All OAuth/auth infrastructure is removed.

## Motivation

- Schwab API requires users to log in via OAuth (friction)
- Schwab API requires developer registration, client ID/secret, and token management
- Yahoo Finance provides the same market data (quotes + price history) freely with no
  authentication required
- Eliminates ~60% of Worker code and all KV-dependent infrastructure

## Data Sources

| Data                                  | Old Source                   | New Source                                     |
| ------------------------------------- | ---------------------------- | ---------------------------------------------- |
| Current quotes (price, previousClose) | `marketdata/v1/quotes`       | `v8/finance/chart?range=1d&interval=1d`        |
| Price history (OHLCV)                 | `marketdata/v1/pricehistory` | `v8/finance/chart?range={derived}&interval=1d` |

Both use the same Yahoo endpoint — only the `range` parameter differs.

## Yahoo Finance API Mapping

### Quote (current price)

```
GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1d&interval=1d
```

Response mapping:

```
chart.result[0].meta.regularMarketPrice → price
chart.result[0].meta.previousClose      → previousClose
```

Batch quotes: Worker receives `?symbols=AAPL,MSFT,GOOGL`, fans out to 3 parallel
Yahoo fetches, merges into `{ symbol: { price, previousClose } }`.

### Price History

```
GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval=1d
```

The `range` value is derived from the earliest transaction date in the vault,
mapped to the closest Yahoo range value (`1mo|3mo|6mo|1y|2y|5y|10y|max`).

Response mapping (OHLCV arrays indexed by timestamp position):

```
timestamp[i]                        → date (Unix → YYYY-MM-DD)
indicators.quote[0].open[i]         → open
indicators.quote[0].high[i]         → high
indicators.quote[0].low[i]          → low
indicators.quote[0].close[i]        → close
indicators.quote[0].volume[i]       → volume
indicators.adjclose[0].adjclose[i]  → adjClose
```

## Files to Delete

### Worker (5 files)

- `worker/src/services/schwab-oauth.service.ts`
- `worker/src/services/token-crypto.service.ts`
- `worker/src/services/auth-kv.service.ts`
- `worker/src/types/auth.ts`
- Related test files

### Frontend (1 file + 1 type)

- `frontend/app/stores/oauth.store.ts`
- `frontend/app/types/schwab.ts`

## Files to Rewrite

### Worker

- `services/schwab-market.service.ts` → `services/market.service.ts` (Yahoo Finance calls)
- `controllers/market.controller.ts` (Yahoo response parsing)
- `index.ts` (strip auth routes, keep only 2 market routes)
- `wrangler.jsonc` (remove KV binding, 3 secrets)
- `worker/src/types/market.ts` (keep, update types if needed)

### Frontend

- `market.store.ts` (pass computed `range` param for history)
- `settings.vue` (remove Schwab connection card)
- `types/vault.ts` (remove `SchwabTokenMeta` from metadata)

## No-Change Files

- `data.store.ts` — all computed properties still work identically
- All UI chart components — they consume stores not Schwab directly
- `types/enums.ts` — `Bank.SCHWAB` stays (used by CSV import schema)

## Frontend→Worker API Contract (unchanged)

| Endpoint              | Method | Params              | Response                                                                  |
| --------------------- | ------ | ------------------- | ------------------------------------------------------------------------- |
| `/api/market/quotes`  | GET    | `symbols=AAPL,MSFT` | `{ AAPL: { price, previousClose }, MSFT: {...} }`                         |
| `/api/market/history` | GET    | `symbol=AAPL`       | `{ symbol: "AAPL", candles: [{ date, open, high, low, close, volume }] }` |

The frontend's `market.store.ts` needs zero changes to how it receives or processes
this data. Only the history request gains a computed `range` parameter.

## Configuration Changes

### Worker (wrangler.jsonc)

**Remove:**

- `TOKENS` KV namespace binding
- `CLIENT_ID` secret
- `CLIENT_SECRET` secret
- `TOKEN_ENCRYPTION_KEY` secret
- `SCHWAB_REDIRECT_URI`, `SCHWAB_AUTH_URL`, `SCHWAB_TOKEN_URL`, `SCHWAB_SCOPE` vars

**Keep:**

- `FRONTEND_ORIGIN` var (CORS still needed)

## Data Flow (after change)

```
Frontend → Worker → Yahoo Finance
              │
          (CORS proxy +
           data transformer)

No OAuth. No tokens. No KV storage.
```

## Error Handling

- Yahoo Finance returns HTTP 404 for unknown symbols → Worker returns `{ symbol: null }`
- Yahoo transient failures → Worker returns 502 with error message
- Frontend `market.store.ts` already has `try/catch` with fallback to cached data
