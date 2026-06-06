# iFolio

iFolio is a personal investment portfolio tracker — a secure, mobile-responsive single-page web app that gives individual investors a unified view across all their investment accounts. It supports transaction imports and manual account management, with portfolio metrics computed from your local transaction ledger.

## 🛡️ Privacy-First Architecture

iFolio is designed with a strict privacy-first approach to ensure your financial data remains your own:

- **Local Encrypted Vault**: No portfolio data is stored in the cloud. All user data resides in an **AES-256-GCM encrypted vault file** on your own device.
- **Zero-Knowledge Sessions**: Each session begins by unlocking the vault with a passphrase, loading decrypted data into memory, and re-encrypting it upon save.
- **No Required Backend**: Portfolio management runs locally in the browser with no API dependency.
- **Zero Recurring Cost**: The stack is designed to run for free, hosted on GitHub Pages.

## 🚀 Features

- **Unified Dashboard**: track total value, daily/unrealized/realized gains, and YTD income.
- **Manual Import Workflow**: Import transaction files and manage account mappings locally.
- **Multi-Source Support**: Start with generic CSV templates and extend with bank-specific parsers.
- **Transaction-Ledger Calculations**: Account balances, positions, tax lots, and income are recalculated from imported/manual transactions.
- **Tax Intelligence**: Support for FIFO, LIFO, and Specific Identification cost basis methods, including wash sale detection.
- **Asset Allocation**: Visual breakdown of US Equity, International, Fixed Income, HSA, and Cash.

## 🛠️ Tech Stack

- **Frontend**: Nuxt 4, TypeScript, Nuxt UI, Pinia, Unovis, Tailwind CSS.
- **Infrastructure**: GitHub Pages (Frontend).
- **Security**: Web Crypto API (AES-256-GCM, PBKDF2-HMAC-SHA256).

## ⚙️ Local Setup

Run the frontend workspace only:

- `npm run frontend`
- `npm run lint`
- `npm run typecheck`
- `npm test`

## 🗺️ Roadmap

For a detailed breakdown of the development phases, feature milestones, and planned improvements, please refer to the [Roadmap.md](./Roadmap.md).

## ⚙️ Getting Started

Refer to [notes.md](./notes.md) for the full developer environment setup guide, including:

- Repository configuration
- Type conventions
- First-time deployment checklist
- Development workflow
