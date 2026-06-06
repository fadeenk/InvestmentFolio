# iFolio

Monorepo (`npm workspaces`): `frontend/` (Nuxt 4 SPA).

## Commands

| Command                 | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `npm run frontend`      | Nuxt dev server on `localhost:3000`                                 |
| `npm test`              | Frontend tests                                                      |
| `npm run test:frontend` | Frontend unit tests only                                            |
| `npm run lint`          | ESLint, Auto-fix lint violations, zero warnings allowed             |
| `npm run format`        | Prettier write (no semi, single quotes, trailing commas, 100 width) |
| `npm run typecheck`     | Frontend typecheck                                                  |

CI order (also the preferred local order): `lint -> format -> typecheck -> test`.

## Architecture

- **Privacy-first**: vault encrypts/decrypts locally (Web Crypto API: AES-256-GCM, PBKDF2-HMAC-SHA256, 600K iterations). No portfolio data touches any server.
- **Data flow**: Pages -> Pinia stores -> presentational chart components (charts never import stores).
- **Types**: All in `app/types/` (enums.ts, vault.ts) -- never inlined into components.
- **Entrypoints**: `app/app.vue` (frontend).

## Testing

- **Frontend**: Vitest + `@nuxt/test-utils`, jsdom env, globals auto-imported (`vi`, `describe`, `it`, `expect`). Tests in `test/unit/` (stores, utils) and `test/nuxt/` (components).
- Pinia tests: call `setActivePinia(createPinia())` in `beforeEach`.
- Component tests: `mount()` from `@nuxt/test-utils`, assert on SVG elements.
- Single-file run: `npm --workspace=frontend run test -- test/unit/stores/portfolio.test.ts`

## Code Conventions

- **No `any`**: use `unknown` + narrowing or `satisfies`. Violations fail CI.

## Git Workflow

1. Feature branch from `develop`
2. Pre-push: typecheck + unit tests
3. PR against `develop` -> CI runs lint, format check, typecheck, tests
4. Merge to `develop` (staging)
5. PR `develop -> main` -> needs approval + green CI
6. Merge to `main` -> auto-deploys frontend (GitHub Pages)

## CI/CD

- **CI** (`.github/workflows/ci.yml`): on PR to main/develop, push to develop. Lint -> format check -> typecheck -> test.
- **Frontend Deploy**: static generate via `npm --workspace=frontend run generate`, push `.output/public` to `gh-pages`.

## UI Components

For detailed documentation of available UI components refernce [NuxtUI Documentation](https://ui.nuxt.com/llms.txt)

## Gotchas

- The frontend `tsconfig.json` uses project references to `.nuxt/` generated configs -- these are created by `nuxt prepare` (runs automatically via `postinstall`).
