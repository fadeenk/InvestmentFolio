// Chart series colors as CSS-variable references. The concrete hues live in
// main.css as --chart-0..--chart-7 with per-theme values, so ApexCharts
// series re-resolve automatically on theme toggle with no JS theme wiring.
export const CHART_SERIES_VARS = Array.from({ length: 8 }, (_, i) => `var(--chart-${i})`)

export function chartSeriesVar(index: number): string {
  return `var(--chart-${index % CHART_SERIES_VARS.length})`
}

export function chartSeriesSoftVar(index: number): string {
  return `color-mix(in srgb, var(--chart-${index % CHART_SERIES_VARS.length}) 40%, transparent)`
}
