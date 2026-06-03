# InvestmentFolio

InvestmentFolio is a personal investment portfolio tracker — a secure, mobile-responsive single-page web app that gives individual investors a unified view across all their investment accounts. It supports Charles Schwab accounts via the official Schwab Trader API, Optum Health Savings Accounts via CSV import, and any other institution through manual entry. The dashboard surfaces unrealized and realized gains, cost basis, income tracking, and portfolio allocation in one place.

## 🛡️ Privacy-First Architecture

InvestmentFolio is designed with a strict privacy-first approach to ensure your financial data remains your own:

- **Local Encrypted Vault**: No portfolio data is stored in the cloud. All user data resides in an **AES-256-GCM encrypted vault file** on your own device.
- **Zero-Knowledge Sessions**: Each session begins by unlocking the vault with a passphrase, loading decrypted data into memory, and re-encrypting it upon save.
- **Thin Backend**: The only server infrastructure is a lightweight Cloudflare Worker that acts as a CORS proxy and OAuth token relay for the Schwab API. **No portfolio data ever touches a third-party server.**
- **Zero Recurring Cost**: The entire stack is designed to run for free, hosted on GitHub Pages with the Cloudflare Worker on its free tier.

## 🚀 Features

- **Unified Dashboard**: track total value, daily/unrealized/realized gains, and YTD income.
- **Schwab Integration**: Automated sync of positions and transactions via the Schwab Trader API.
- **OAuth Workflow UI**: Dashboard and settings controls for connect/re-authorize, auth status, and callback success/error banners.
- **Multi-Source Support**: Import Optum HSA data via CSV or add other accounts through manual entry.
- **Tax Intelligence**: Support for FIFO, LIFO, and Specific Identification cost basis methods, including wash sale detection.
- **Asset Allocation**: Visual breakdown of US Equity, International, Fixed Income, HSA, and Cash.

## 🛠️ Tech Stack

- **Frontend**: Nuxt 4, TypeScript, Nuxt UI, Pinia, Unovis, Tailwind CSS.
- **Backend**: Cloudflare Workers (TypeScript), Workers KV.
- **Infrastructure**: GitHub Pages (Frontend), Cloudflare (Backend).
- **Security**: Web Crypto API (AES-256-GCM, PBKDF2-HMAC-SHA256).

## 🔐 Authentication Workflow

The frontend and worker coordinate OAuth and token lifecycle with this flow:

1. Frontend sends the user to `GET /auth/login`.
2. Worker redirects to Schwab consent.
3. Schwab returns to `GET /auth/callback` on the worker.
4. Worker exchanges code, encrypts token envelope, stores it in KV, then redirects to frontend with query params:
   - success: `?auth=connected`
   - failure: `?auth=error&reason=...`
5. Frontend reads those params, shows a banner, clears the query, then polls `GET /auth/status`.
6. Frontend uses `POST /auth/refresh` as needed when token state is expired.

Notes:

- `GET /auth/status` returns `200` with a disconnected payload when no token is available.
- Worker applies CORS headers for `/auth/*` endpoints and handles `OPTIONS` preflight.
- `FRONTEND_ORIGIN` must match the frontend origin for cross-origin auth calls.

## ⚙️ Local Auth Setup

Required worker secrets:

- `CLIENT_ID`
- `CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`

Required worker vars (see `worker/wrangler.jsonc`):

- `SCHWAB_REDIRECT_URI`
- `SCHWAB_AUTH_URL`
- `SCHWAB_TOKEN_URL`
- `SCHWAB_SCOPE`
- `FRONTEND_ORIGIN`

Required frontend env var:

- `NUXT_PUBLIC_WORKER_URL` (used by `frontend/nuxt.config.ts` runtime config)

Example local values:

- frontend: `http://localhost:3000`
- worker: `http://localhost:8787`

## 🗺️ Roadmap

For a detailed breakdown of the development phases, feature milestones, and planned improvements, please refer to the [Roadmap.md](./Roadmap.md).

## ⚙️ Getting Started

Refer to [notes.md](./notes.md) for the full developer environment setup guide, including:

- Repository configuration
- Type conventions
- First-time deployment checklist
- Development workflow
