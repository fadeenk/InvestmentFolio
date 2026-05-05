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
- **Multi-Source Support**: Import Optum HSA data via CSV or add other accounts through manual entry.
- **Tax Intelligence**: Support for FIFO, LIFO, and Specific Identification cost basis methods, including wash sale detection.
- **Asset Allocation**: Visual breakdown of US Equity, International, Fixed Income, HSA, and Cash.

## 🛠️ Tech Stack

- **Frontend**: Nuxt 3, TypeScript, Nuxt UI Dashboard, Pinia, Unovis, Tailwind CSS.
- **Backend**: Cloudflare Workers (TypeScript), Workers KV.
- **Infrastructure**: GitHub Pages (Frontend), Cloudflare (Backend).
- **Security**: Web Crypto API (AES-256-GCM, PBKDF2-HMAC-SHA256).

## 🗺️ Roadmap

For a detailed breakdown of the development phases, feature milestones, and planned improvements, please refer to the [Roadmap.md](./Roadmap.md).

## ⚙️ Getting Started

Refer to [notes.md](./notes.md) for the full developer environment setup guide, including:
- Repository configuration
- Type conventions
- First-time deployment checklist
- Development workflow
