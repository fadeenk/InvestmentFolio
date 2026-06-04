# Folio — Developer Environment & Project Setup Guide

## 1. Repository Structure

The Folio monorepo uses a simple two-workspace layout — one directory for the Nuxt frontend and one for the Cloudflare Worker. A root-level `package.json` coordinates shared tooling (linting, formatting, git hooks).

```
folio/
├── .github/
│   └── workflows/
│       ├── ci.yml             # Lint + test on every PR
│       ├── deploy-frontend.yml # Build + publish to GitHub Pages on main
│       └── deploy-worker.yml  # Deploy Cloudflare Worker on main
├── frontend/                  # Nuxt 4 SPA
│   ├── assets/
│   ├── components/
│   ├── composables/           # useVault, useSync, useCrypto, etc.
│   ├── pages/
│   ├── stores/                # Pinia stores
│   ├── types/                 # vault.ts, schwab.ts, enums.ts
│   ├── utils/                 # Pure utility functions (crypto, csv, formatting)
│   ├── test/
│   │   ├── unit/              # Pure function & composable tests (Node env)
│   │   ├── nuxt/              # Component & page tests (Nuxt env)
│   │   └── e2e/               # End-to-end flows with Playwright
│   ├── nuxt.config.ts
│   ├── vitest.config.mts
│   ├── tsconfig.json
│   └── package.json
├── worker/                    # Cloudflare Worker (TypeScript)
│   ├── src/
│   │   ├── index.ts                 # Route handler entry point
│   │   ├── controllers/             # Auth route handlers
│   │   ├── services/                # OAuth, KV, crypto services
│   │   ├── types/                   # Worker auth contracts
│   │   └── utils/                   # HTTP helpers
│   ├── test/
│   │   └── *.test.ts          # Vitest + @cloudflare/vitest-pool-workers
│   ├── wrangler.jsonc
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   └── package.json
├── .husky/
│   ├── pre-commit             # lint-staged
│   └── pre-push               # run tests
├── .editorconfig
├── .gitignore
├── eslint.config.mjs          # Shared flat ESLint config (root)
├── prettier.config.mjs        # Shared Prettier config (root)
└── package.json               # Root workspace + husky/lint-staged
```

## 2. Type Conventions

All data models live under `frontend/types/`, `worker/types/`, and are **never** inlined into components:

| File                       | Contents                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `frontend/types/vault.ts`  | `VaultFile`, `VaultPayload`, `Account`, `Transaction`, `Position`, `TaxLot`, `IncomeRecord`, `PricePoint`, `VaultMetadata` |
| `frontend/types/schwab.ts` | Schwab API response shapes for all used endpoints                                                                          |
| `frontend/types/enums.ts`  | `Bank`, `AccountType`, `SyncMethod`, `TransactionType`, `AssetType`, `CostBasisMethod`                                     |
| `worker/types/worker.ts`   | Worker request/response types shared across the proxy boundary                                                             |

> **Rule:** No `any`. Use `unknown` + type narrowing, or `satisfies` operator, instead. Violations fail the CI lint check.

## 3. Development Workflow

1. Create feature branch from develop
2. Write failing tests (TDD red phase)
3. Implement to make tests pass (green phase)
4. Refactor if needed (refactor phase)
5. Push branch — pre-push hook runs typecheck + unit tests
6. Open PR against develop — CI runs full lint/test/e2e suite
7. Merge to develop for staging validation
8. PR develop → main — requires approving review + green CI
9. Merge to main — GitHub Actions auto-deploys frontend and worker
