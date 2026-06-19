# InvestmentFolio Terminal Redesign

**Date:** 2026-06-18
**Status:** Design approved, pending implementation

## Overview

Layout + navigation redesign with an institutional-terminal visual identity for the InvestmentFolio privacy-first portfolio tracker. All existing pages, routes, and data flows remain intact — this is a visual and structural refresh only.

## Scope

- Layout: sidebar navigation replaces top header nav
- Navigation: new sidebar + thin top strip architecture
- Visual identity: dark, dense, data-first "terminal" aesthetic
- Landing page: redesigned vault lock/unlock with terminal-prompt styling
- Dashboard: horizontal metric strip, stripped chart panels, compact tables
- Charts: ApexCharts restyled with terminal color palette
- Settings/forms: consistent terminal-styled controls, two-column layout
- Micro-interactions: page transitions, sidebar animation, terminal-style states

## Color System

### Dark Theme (primary)

- Background: `#0f1117` (deep charcoal)
- Elevated surface: `#1a1d27`
- Text primary: `#e8eaed`
- Text muted: `#9aa0a6`
- Text disabled: `#5f6368`
- Accent green: `#00c853` primary, `#00e676` hover, `#009624` active
- Signal red (losses/errors): `#ff5252`
- Signal amber (warnings): `#ffd740`
- Signal blue (info/links): `#40c4ff`
- Borders: `#2d3140` subtle, `#3a3f52` visible
- Chart bg: `#1a1d27`, grid lines: `#2d3140`

### Light Theme (secondary)

- Background: `#f5f5f7`
- Elevated surface: `#ffffff`
- Text primary: `#1a1a2e`
- Text muted: `#6b7280`
- Accent green: `#059669`
- Same signal colors, slightly desaturated
- Borders: `#e5e7eb`

### Key Changes from Current

- Remove custom green palette in `main.css`; use NuxtUI built-in theming with custom dark-toned neutral
- Drop slate neutral for a charcoal-based palette

## Layout Architecture

```
┌──────────┬────────────────────────────────────┐
│ SIDEBAR  │  Top strip (~40px)                 │
│ 56px     │  [save status] [connection] [mode] │
│ icon-only├────────────────────────────────────┤
│ expands  │  CONTENT AREA                      │
│ to 200px │  (scrollable, max-w-7xl)           │
│ on hover │                                    │
│          │                                    │
│ Logo top │                                    │
└──────────┴────────────────────────────────────┘
```

### Sidebar (left, fixed)

- Icons only by default (56px) — maximizes horizontal space
- Hover/click expands to ~200px showing icon + label
- Items: Dashboard, Positions, Transactions, Income, Settings
- Active item: green accent bar on left edge
- Vault lock/unlock indicator as colored dot at top
- Compact logo at top

### Top Strip (~40px)

- Only visible when vault is unlocked
- Vault save status (Saved/Saving/Unsaved) with compact save button
- Connection status indicator (Schwab)
- Color mode toggle
- Much more compact than current header

### Content Area

- Full-width max-w-7xl; data pages can optionally use full viewport
- Page headers become thin breadcrumb-style labels

### Mobile

- Sidebar becomes bottom tab bar (5 tabs)
- Top strip collapses to minimal status bar
- Full-width content

## Landing Page (Vault Experience)

### Locked State

- Centered dark pane with subtle border glow
- Monospaced prompt: `ifolio@vault:~$` with blinking cursor
- Single passphrase input styled as terminal command line
- Quick Open hint below if vault remembered
- Bottom-left: `[Create new vault]` `[Open existing vault]` as muted actions
- Errors as red terminal output lines

### Unlocking State

- Spinning cursor with `Decrypting key...` and animated dots

### Unlocked State

- Transition animation from prompt line
- Compact summary: account count, last saved, last import
- Prominent "Enter dashboard" button or auto-navigate

## Dashboard

### Overview Bar

- Single horizontal strip (replaces 7-card grid)
- Compact metric blocks separated by thin vertical rules
- Each block: label (muted, small), value (bold, monospaced), optional delta (colored)
- Blocks: Total Value, Day G/L, Unrealized G/L, Cost Basis, Realized YTD, Income YTD, Cash
- Horizontal scroll if needed

### Filters Bar

- Thin row below overview
- Account filter: compact pill buttons
- Time range: segmented control, smaller labels
- Refresh: icon-only compact button

### Charts

- Portfolio Value + Allocation side by side in panel containers (no UCard wrappers)
- Balances + Income below
- Thin border, dark bg, no extra padding
- Chart titles as small text labels top-left

### Accounts Table

- Full-width, no wrapping card
- Column headers: muted, monospaced, uppercase
- Rows: 36px height, alternating subtle stripe
- Gains: colored green/red with delta arrows
- Hover highlight

## Settings & Forms

### Layout

- Two-column grid (label | control) rather than stacked cards
- Settings groups get thin uppercase section headers instead of UCards
- Consistent terminal-styled inputs: dark bg, thin border, monospaced values

### Form Controls

- Replace all native `<select>`/`<input>` with NuxtUI `USelect`/`UInput`
- Square corners (rounded-sm), dark input bg, light text, green focus ring
- Buttons: flat, compact (xs/sm), outlined for secondary

## Data Pages (Positions, Transactions, Income)

- Compact headers, stripped card wrappers
- Consistent table styling across all data pages
- Terminal-styled filters and controls

## Charts (ApexCharts)

- Dark panel backgrounds
- `#2d3140` grid lines
- Muted series colors matching terminal palette
- No extra card wrappers — charts render directly in panel containers

## Micro-interactions & Polish

### Transitions

- Page transitions: fade + slide-up (~80ms)
- Sidebar expand/collapse: smooth width animation

### Loading States

- Terminal-style "processing..." with animated dots
- Compact spinners where appropriate

### Error States

- Red terminal-output-style messages (monospaced, red text on lighter red bg)

### Save Indicator

- Small green dot + "Saved" / amber dot + "Unsaved" in top strip
- No full labels needed

### Scrollbar

- Custom thin scrollbars matching theme

## Files to Modify

- `frontend/app/assets/css/main.css` — new theme variables, remove old green palette
- `frontend/app/app.config.ts` — update NuxtUI primary/neutral colors
- `frontend/app/app.vue` — sidebar + top strip replaces current header/footer
- `frontend/app/components/AppLogo.vue` — updated compact logo
- `frontend/app/components/` — new `AppSidebar.vue`, `AppTopStrip.vue`
- `frontend/app/pages/index.vue` — landing page redesigned
- `frontend/app/pages/dashboard.vue` — horizontal metric strip, restyled
- `frontend/app/pages/settings.vue` — two-column layout, terminal controls
- `frontend/app/pages/positions.vue` — compact table styling
- `frontend/app/pages/transactions.vue` — compact table styling
- `frontend/app/pages/income.vue` — compact layout
- `frontend/app/components/dashboard/*.vue` — restyled components
- `frontend/app/components/charts/*.vue` — new theme options

## Non-Goals

- No new pages or routes
- No changes to data flow or stores
- No changes to vault encryption or security model
- No changes to the Cloudflare Worker
