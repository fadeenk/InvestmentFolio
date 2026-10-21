---
name: iFolio
description: Private portfolio tracker — all data encrypted at rest
colors:
  bg: '#f5f5f7'
  bg-elevated: '#ffffff'
  text: '#1a1a2e'
  text-muted: '#6b7280'
  text-disabled: '#9ca3af'
  border: '#e5e7eb'
  border-strong: '#d1d5db'
  accent: '#059669'
  accent-hover: '#047857'
  accent-active: '#065f46'
  signal-red: '#dc2626'
  signal-amber: '#d97706'
  signal-blue: '#2563eb'
  chart-0: '#059669'
  chart-1: '#2563eb'
  chart-2: '#d97706'
  chart-3: '#dc2626'
  chart-4: '#7c3aed'
  chart-5: '#0d9488'
  chart-6: '#ea580c'
  chart-7: '#9333ea'
typography:
  headline:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: '1.125rem'
    fontWeight: 700
    lineHeight: 1.4
  title:
    fontFamily: "'Public Sans', sans-serif"
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "'Public Sans', sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.05em'
  microlabel:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: '0.625rem'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.05em'
rounded:
  sm: '2px'
  scroll: '3px'
  full: '9999px'
spacing:
  sm: '8px'
  md: '12px'
  lg: '16px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
  button-primary-hover:
    backgroundColor: '{colors.accent-hover}'
  card:
    backgroundColor: '{colors.bg-elevated}'
    textColor: '{colors.text}'
    rounded: '{rounded.sm}'
    padding: '12px 16px'
  input-mono:
    backgroundColor: 'transparent'
    textColor: '{colors.text}'
    typography: '{typography.label}'
  nav-item-active:
    textColor: '{colors.accent}'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
---

# Design System: iFolio

## Overview

**Creative North Star: "The Vault Ledger"**

iFolio is an operate-surface: a dense, task-focused private portfolio tracker where privacy is the product. The aesthetic is utilitarian and custodial — small sharp-edged cards, hairline borders, mono numerals, and a single emerald voice that only speaks when state changes. A terminal-inspired vault lock screen sets the tone; everything inside is quiet, precise, and auditable.

There is no marketing layer and no decorative imagery. Layout is a centered ledger (max-w-7xl) of bordered panels, data tables, and ApexCharts, framed by a slim icon sidebar, a 40px breadcrumb strip, and a status footer. Dark mode is a full citizen, not an afterthought, swapping the same tokens to ink-on-slate.

**Key Characteristics:**

- Dense operate density: text-xs / text-sm, 12–16px card padding, 16px grid rhythm.
- Terminal-finance voice: Public Sans for prose, JetBrains Mono for numerals, labels, and vault flows.
- One-accent discipline: emerald for active, saved, and primary; red / amber / blue reserved for signals.
- Flat-by-default surfaces with tonal layering; shadow only for the vault modal.

## Colors

Ledger neutrals with a single vault-emerald accent; signals carry all semantic color.

### Primary

- **Vault Emerald** (#059669): The only action color. Active nav, primary buttons, saved dot, chart line, terminal cursor. Hover is (#047857), active is (#065f46). Dark mode: (#00c853), hover (#00e676), active (#009624).

### Secondary (optional; omit if the project has only one accent)

Omitted — the system has one accent by design.

### Tertiary (optional)

Omitted.

### Neutral

- **Ledger Paper** (#f5f5f7): App background in light mode. Dark mode: (#0f1117).
- **Raised Paper** (#ffffff): Cards, tables, sidebar, vault modal in light mode. Dark mode: (#1a1d27).
- **Ledger Ink** (#1a1a2e): Primary text in light mode. Dark mode: (#e8eaed).
- **Muted Slate** (#6b7280): Secondary text, table headers, breadcrumbs. Dark mode: (#9aa0a6).
- **Disabled Fog** (#9ca3af): Placeholders and disabled text. Dark mode: (#5f6368).
- **Hairline** (#e5e7eb): All card, table, sidebar, and strip borders; also chart grid. Dark mode: (#2d3140).
- **Visible Hairline** (#d1d5db): Scrollbar hover, stronger dividers. Dark mode: (#3a3f52).

### Signal colors (functional, not decorative)

- **Signal Red** (#dc2626 / dark #ff5252): Losses, errors, destructive banners.
- **Signal Amber** (#d97706 / dark #ffd740): Unsaved state, warnings, expired vault.
- **Signal Blue** (#2563eb / dark #40c4ff): Informational accents in charts and links.

### Chart series

- **Series ramp** (`--chart-0` … `--chart-7`): Eight hues shared by balances, allocation, and income charts, referenced as `var(--chart-N)` so they re-resolve on theme toggle with no JS. Light values are ledger depths (emerald, blue, amber, red, violet, teal, orange, purple); dark values are the neon terminal ramp. Interest overlays use `color-mix` 40% soft variants of the same slots.

### Named Rules

**The One Voice Rule.** The emerald accent appears on ≤10% of any screen — active nav, primary action, saved state, chart line. Its rarity is the point; everything else is neutral.
**The Signal Silence Rule.** Red, amber, and blue never decorate. They only report state: gain/loss, error, unsaved, expired, or sync status.

## Typography

**Display Font:** Public Sans (with sans-serif fallback)
**Body Font:** Public Sans (with sans-serif fallback)
**Label/Mono Font:** JetBrains Mono (with monospace fallback)

**Character:** Quiet sans for structure, exact mono for evidence. Prose and nav read in Public Sans; every number that matters — totals, quantities, prices, timestamps, vault prompts — is set in JetBrains Mono.

### Hierarchy

- **Headline** (700, 1.125rem / 18px, 1.4): Portfolio totals and income totals in mono. Where it appears: dashboard total cards, income headers.
- **Title** (600, 1rem / 16px, 1.5): Card values and section values in sans semibold. Where it appears: import-status tiles, month totals.
- **Body** (400, 0.875rem / 14px, 1.5): Default reading size in Public Sans. Where it appears: card copy, nav labels, empty states.
- **Label** (500, 0.75rem / 12px, 1.4, 0.05em tracking, uppercase): Table headers, chart captions, breadcrumbs, vault terminal prompts in JetBrains Mono uppercase. Max line length is not constrained — tables scroll rather than wrap.
- **Microlabel** (500, 0.625rem / 10px, 1.4, 0.05em tracking, uppercase): Dense stat captions and footer status (`text-2xs`). Same voice as Label at a smaller step for high-density tiles.

### Named Rules

**The Mono Numerals Rule.** Any currency, quantity, percentage, or date that the user acts on is set in JetBrains Mono, never in Public Sans.

## Layout

Grid is a centered ledger: `max-w-7xl` container, `px-4 py-4`, `space-y-4` between sections. Dashboard splits charts into `grid gap-4 xl:grid-cols-2` at 1280px; cards use `p-3` (12px) for dense tiles and `px-4 py-4` (16px) for panels; tables are `min-w-full text-xs` with `px-3 py-2` cells that scroll horizontally on small screens.

Chrome: collapsed icon sidebar `w-14` (56px) expanding to `w-50` (200px) on hover on desktop, replaced by a fixed `h-14` bottom tab bar on mobile; top strip `h-10` (40px) breadcrumb with theme and lock actions; footer status bar with saved / import / sync timestamps. Content scrolls in a single `overflow-y-auto` column with `pb-14` clearance for the mobile tab bar.

Spacing rhythm is Tailwind 4px-base: `gap-1` (4px) for dot clusters, `gap-2 / p-2` (8px) for control rows, `p-3 / gap-3` (12px) for cards, `gap-4 / p-4` (16px) for section rhythm.

## Elevation & Depth

Flat by default. Depth is conveyed by tonal layering — paper (`bg`) versus raised paper (`bg-elevated`) separated by 1px hairline borders — not by shadows. The system is shadowless in normal operate flow.

### Shadow Vocabulary

- **Modal lift** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`, Tailwind `shadow-lg`): Vault lock card and update prompt only. When to use it: floating layers that interrupt the ledger.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadow appears only as a response to layering (vault modal, update prompt), never on cards, tables, or nav.

## Shapes

Form language is sharply utilitarian: small squared corners, hairline borders, and round status dots.

Corners use `rounded-sm` (2px) on every card, table wrapper, banner, button, and input. The thin scrollbar thumb uses `rounded-scroll` (3px). The only curves are functional: `rounded-full` (9999px) for saved / unsaved / valid status dots, and `rounded-r` (2px right) for the 2×16px active-nav indicator bar. Borders are 1px solid hairline throughout; the vault terminal card adds a bottom divider under its `vault@iFolio:~$` header. No clipping, no large radii, no organic geometry.

## Components

Each component leads with its feel — restrained and precise, with confident solid primary actions — then its exact construction.

### Buttons

- **Character:** Small, squared, confident solid primary; quiet ghost and outline seconds.
- **Shape:** Squared corners (rounded-sm, 2px).
- **Primary:** Emerald fill (`accent`), white text, `px-3 py-2` at `size="sm"`, `size="xs"` for inline table actions. UButton `color="primary"`.
- **Hover / Focus:** Fill shifts to `accent-hover`; active to `accent-active`. No shadow, no lift.
- **Secondary / Ghost / Tertiary:** `color="neutral"` ghost for Cancel / Forget / theme toggle; outline for Different file / Sync to Sheets. Muted text, hairline border on outline only.

### Chips (if used)

Not a distinct chip system. Status is conveyed by 4–8px round dots: emerald (saved / valid), amber (unsaved / expired), plus mono parentheticals like `(valid)` and `(expired)`.

### Cards / Containers

- **Corner Style:** Squared (rounded-sm, 2px).
- **Background:** Raised paper (`bg-elevated`) on paper (`bg`).
- **Shadow Strategy:** None — see Elevation & Depth. Only the vault modal carries `shadow-lg`.
- **Border:** 1px hairline (`border`) on all sides.
- **Internal Padding:** Dense tiles `p-3` (12px); panels `px-4 py-4` (16px); modal `p-6` (24px).

### Inputs / Fields

- **Style:** Borderless terminal line. Transparent background, mono 14px text, disabled-gray placeholder, no radius, no border; label is a mono `> passphrase:` prefix.
- **Focus:** No glow or border shift — `focus:outline-none`; the caret and entered mono text are the focus signal.
- **Error / Disabled:** Error is a bordered red banner (`signal-red` border at 30%, fill at 10%, mono 12px text prefixed with `>`); disabled dims to fog gray.

### Navigation

Sidebar on desktop: fixed left, `w-14` icon rail expanding to `w-50` on hover, 14px Lucide icons, 14px sans labels revealed on hover, active item in emerald with a 2×16px left indicator bar. Mobile: fixed bottom `h-14` tab bar with five destinations, icon over 12px label, active in emerald. Top strip: `h-10` raised bar with `~/page` mono breadcrumb and ghost icon buttons for theme and lock.

### Tables

Dense ledger tables: `min-w-full text-xs`, mono uppercase 10–12px muted headers with wide tracking, `px-3 py-2` cells, hairline row dividers, right-aligned numerals. Nested lot tables compress to `px-2 py-1`.

### Banner

Full-width status strip below the top strip: 12px text, hairline border tinted 30% of its signal color with 10% fill — emerald for success, amber for warning, red for error — with a ghost Dismiss action.

### Signature Component

**Vault terminal card.** A `max-w-md` centered `rounded-sm` bordered raised card with `shadow-lg` and `p-6`, headed by a `vault@iFolio:~$` mono muted prompt with a pulsing emerald block cursor. All vault flows (create / open / unlock / re-select) render as `$` and `>` command lines inside this shell — the single most distinctive pattern in the system and the source of its voice.

## Do's and Don'ts

Concrete guardrails grounded in the implemented ledger.

### Do:

- **Do** keep every operate surface on paper versus raised-paper with a 1px hairline — flat, bordered, squared (rounded-sm).
- **Do** set every actionable number in JetBrains Mono: currency, quantity, price, percentage, timestamp.
- **Do** reserve emerald for active / primary / saved, and red / amber / blue strictly for gain-loss-error-warn state.
- **Do** support both themes by swapping the same tokens (light paper #f5f5f7 ↔ dark ink #0f1117) — never hard-code a hex in a component.
- **Do** use the vault terminal pattern (`$` / `>` mono lines, block cursor) for any future credential or destructive flow.

### Don't:

- **Don't** introduce a second accent, gradient, or decorative color — the ledger has one voice.
- **Don't** add shadows to cards, tables, or nav — `shadow-lg` belongs only to floating layers.
- **Don't** round to `rounded-lg` / `rounded-xl` or remove borders for a softer look — squareness is the identity.
- **Don't** set numerals in Public Sans or prose in mono — the pairing direction is fixed.
- **Don't** invent new radius, spacing, or elevation tokens — reuse `rounded-sm`, 8/12/16px rhythm, and hairline borders.
