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
├── frontend/                  # Nuxt 3 SPA
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
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   └── package.json
├── worker/                    # Cloudflare Worker (TypeScript)
│   ├── src/
│   │   ├── index.ts           # Route handler entry point
│   │   ├── auth.ts            # OAuth token exchange / refresh
│   │   ├── proxy.ts           # Schwab API proxy logic
│   │   └── crypto.ts          # Token encryption (AES-GCM)
│   ├── test/
│   │   └── *.test.ts          # Vitest + @cloudflare/vitest-pool-workers
│   ├── wrangler.toml
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

| File | Contents |
|---|---|
| `frontend/types/vault.ts` | `VaultFile`, `VaultPayload`, `Account`, `Transaction`, `Position`, `TaxLot`, `IncomeRecord`, `PricePoint`, `VaultMetadata` |
| `frontend/types/schwab.ts` | Schwab API response shapes for all used endpoints |
| `frontend/types/enums.ts` | `Bank`, `AccountType`, `SyncMethod`, `TransactionType`, `AssetType`, `CostBasisMethod` |
| `worker/types/worker.ts` | Worker request/response types shared across the proxy boundary |

> **Rule:** No `any`. Use `unknown` + type narrowing, or `satisfies` operator, instead. Violations fail the CI lint check.


## 3. First-Time Deployment Checklist

- [ ] Schwab Developer Portal app created and approved
- [ ] Cloudflare account created (free tier)
- [ ] KV namespace created: wrangler kv:namespace create TOKENS
- [ ] wrangler.toml updated with real KV namespace IDs
- [ ] Worker secrets set via wrangler secret put (3 secrets)
- [ ] GitHub repo created, CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets added
- [ ] Worker deployed: cd worker && npx wrangler deploy
- [ ] Worker URL noted and set as WORKER_URL GitHub Actions variable
- [ ] Frontend .env.production updated with Worker URL
- [ ] Frontend deployed: GitHub Actions workflow triggered on push to main
- [ ] GitHub Pages enabled in repo Settings → Pages → gh-pages branch
- [ ] App opened in Chrome, vault created, Schwab OAuth completed, data synced

## 4. Development Workflow

1. Create feature branch from develop
2. Write failing tests (TDD red phase)
3. Implement to make tests pass (green phase)
4. Refactor if needed (refactor phase)
5. Push branch — pre-push hook runs typecheck + unit tests
6. Open PR against develop — CI runs full lint/test/e2e suite
7. Merge to develop for staging validation
8. PR develop → main — requires approving review + green CI
9. Merge to main — GitHub Actions auto-deploys frontend and worker
