# InvestmentFolio Frontend

Nuxt 4 single-page frontend for InvestmentFolio.

## Purpose

The frontend is responsible for:

- Local encrypted vault lifecycle (create, open, save, lock)
- Portfolio UI (dashboard cards/charts/tables)
- Auth workflow UX for Schwab OAuth (connect, status, re-authorize)
- Coordinating sync requests through the Cloudflare Worker

Portfolio data remains local to the browser vault. The worker is used only for OAuth/token relay and Schwab API proxying.

## Runtime Configuration

The frontend reads the worker base URL from Nuxt public runtime config:

- `NUXT_PUBLIC_WORKER_URL`

Configured in `nuxt.config.ts` as:

- `runtimeConfig.public.workerUrl`

Example `.env` value:

```bash
NUXT_PUBLIC_WORKER_URL=http://localhost:8787
```

## Auth UX Behavior

Auth controls are available in two places:

- Dashboard auth card
- Header settings modal

OAuth callback behavior:

- Worker redirects back with query params:
  - `auth=connected`
  - `auth=error&reason=...`
- Frontend reads the params, displays a banner, and clears callback params from the URL.

Sync behavior:

- If disconnected, sync intent auto-starts OAuth login.
- If connected, sync proceeds through the normal orchestration path.

## Development

Install dependencies from monorepo root:

```bash
npm install
```

Run frontend dev server:

```bash
npm run frontend
```

Or run directly in workspace:

```bash
npm --workspace=frontend run dev
```

## Scripts

From repository root:

- `npm run frontend` - start Nuxt dev server
- `npm run test:frontend` - frontend tests

From `frontend` workspace:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:run`

## Testing Notes

Store tests for auth workflow live under:

- `test/unit/stores/sync.test.ts`
- `test/unit/stores/ui.test.ts`

Typical targeted run:

```bash
npm --workspace=frontend run test:run -- test/unit/stores/sync.test.ts test/unit/stores/ui.test.ts
```
