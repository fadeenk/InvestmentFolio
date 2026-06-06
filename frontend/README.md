# iFolio Frontend

Nuxt 4 single-page frontend for iFolio.

## Purpose

The frontend is responsible for:

- Local encrypted vault lifecycle (create, open, save, lock)
- Portfolio UI (dashboard cards/charts/tables)
- Manual transaction imports (CSV) into the local vault
- Shared local calculations for balances, positions, tax lots, and income

Portfolio data remains local to the browser vault. No backend service is required.

## Runtime Configuration

No required runtime environment variables.

## Import Workflow

Import controls are available in settings:

- Select account
- Upload CSV file
- Run import

Import behavior:

- File parsing and validation run locally in-browser.
- Accepted rows are deduplicated and inserted into transactions.
- Account balances, positions, tax lots, and income are recalculated from the transaction ledger.

Supported CSV columns by account bank:

- `OTHER`: `Date`, `type`, `action`, `symbol`, `amount`, `price`, `fees`, `total`
- `OPTUM`: `Date`, `Transaction type`, `Requested action`, `Amount`, `Fund name`, `Shares`, `Share price`
- `SCHWAB`: `Date`, `Action`, `Symbol`, `Description`, `Quantity`, `Price`, `Fees & Comm`, `Amount`

Optional passthrough columns (all formats): `assetType`, `externalId`, `notes`

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

Core store tests live under:

- `test/unit/stores/vault.test.ts`
- `test/unit/stores/positions.test.ts`
- `test/unit/stores/ui.test.ts`

Typical targeted run:

```bash
npm --workspace=frontend exec vitest run test/unit/stores/vault.test.ts test/unit/stores/positions.test.ts
```
