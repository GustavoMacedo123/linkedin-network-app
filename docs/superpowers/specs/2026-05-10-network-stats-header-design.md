# Network stats header

A compact stats bar at the top of the middle panel (above the force-graph canvas) showing three at-a-glance numbers about the user's full LinkedIn network: total connections, the company that employs the most of them, and how many distinct companies appear across the network.

## Why

The graph visualises shape and clusters but does not surface absolute scale. A user looking at the canvas cannot answer "how big is my network?" or "who am I most connected to?" without scrolling the sidebar's company list. The stats header puts those answers above the canvas where the eye lands first.

## Behaviour

The bar always reflects **full-network totals**, ignoring any active filters (search, selected companies, selected tags, note search). Filtering changes which nodes the graph renders, but the stats stay constant — they describe the network as a whole.

The bar is **read-only**. The top-company name is plain text, not a clickable filter shortcut. Clicking the company in the sidebar's company list remains the way to filter to a cohort.

### Counting rules

- **Archived people are excluded from all three stats.** An archived person is one no longer present in the latest imported CSV; they are not part of the user's current network.
- **Total connections** = number of non-archived persons (excluding the synthetic "You" node).
- **Top company** = the company string with the highest count of non-archived persons. Ties are broken alphabetically (case-insensitive). People with `null` or empty-string company are excluded from this calculation.
- **Number of different companies** = the count of distinct company groups across non-archived persons, where two persons belong to the same group if their `company` strings are equal after `.trim().toLowerCase()`. The displayed name for a group (used when the group is the top company) is whichever original casing appears most frequently within that group; ties on frequency are broken by picking the variant that sorts first alphabetically (case-sensitive).

### Edge cases

- **Zero non-archived persons**: the bar is hidden entirely. (In practice the App-level routing already shows the import dialog in this case, but the stats component is defensive.)
- **No one has a company set**: render only `N connections` — top-company and company-count segments are omitted.
- **Single connection at a single company**: render all three (`1 connection · Top: Foo (1) · 1 company`). Singular/plural forms are correct (`1 connection`, `2 connections`; `1 company`, `2 companies`).

## Visual

A single horizontal bar at the top of the middle column, sitting flush at the top with a 1px bottom border separating it from the canvas. Compact (~32px tall), neutral grey text matching the app's existing density. Stats are dot-separated inline:

```
612 connections  ·  Top: Google (89)  ·  247 companies
```

No icons, no large numbers, no card backgrounds — the rest of the app uses dense text, the stats bar follows suit.

## Architecture

A pure selector and a presentational component. No store changes, no DB changes.

### `computeNetworkStats(persons)` — pure function in `src/state/selectors.ts`

Signature:

```ts
type NetworkStats = {
  total: number;
  topCompany: { name: string; count: number } | null;
  companyCount: number;
};

function computeNetworkStats(persons: PersonNode[]): NetworkStats;
```

Filters `persons` to non-archived, then computes the three numbers per the rules above. Returns the value for the component to render. No React, no DOM, trivially unit-testable.

### `NetworkStats` — component in `src/components/NetworkStats.tsx`

Subscribes to `persons` from the Zustand store. Calls `computeNetworkStats` inside a `useMemo` keyed on `persons` so it only re-runs when the imported set changes. Renders the inline dot-separated bar, or `null` if `total === 0`.

### `GraphCanvas` — modified

The current `GraphCanvas` returns a single `<ForceGraph2D>` filling its grid cell. Wrap that return in a flex column so the stats bar sits above and the canvas takes the remaining space:

```tsx
<div className="h-full flex flex-col">
  <NetworkStats />
  <div className="flex-1 min-h-0">
    <ForceGraph2D ... />
  </div>
</div>
```

The Layout grid (`grid-cols-[240px_1fr_280px]`) does not change. The stats bar lives entirely inside the middle column.

## Testing

Unit tests for `computeNetworkStats` in `tests/state/networkStats.test.ts`:

- Typical case: a mix of companies, expected total/top/count
- All persons archived: returns `{ total: 0, topCompany: null, companyCount: 0 }`
- No persons have a company set: returns `{ total: N, topCompany: null, companyCount: 0 }`
- Tie at the top: alphabetical winner (case-insensitive)
- Empty-string company treated the same as `null` (excluded from top + count, included in total)
- Whitespace + case differences in company names are merged
- Empty input array returns zero stats

A lightweight component test for `NetworkStats` (jsdom + RTL):
- Renders the dot-separated bar when there are connections
- Renders `null` (no DOM output) when total is zero
- Drops the company segments when nobody has a company set
- Singular vs plural copy is correct (`1 connection` vs `2 connections`)

No new tests for `GraphCanvas` — its existing tests already cover graph rendering, and the wrapping div change is structural, not behavioural.

## Files touched

- `src/state/selectors.ts` — add `computeNetworkStats`
- `src/components/NetworkStats.tsx` — new component
- `src/components/GraphCanvas.tsx` — wrap return in flex column, render `<NetworkStats />` above the force-graph
- `tests/state/networkStats.test.ts` — new
- `tests/components/NetworkStats.test.tsx` — new

## Out of scope

- Filter-aware stats (the user explicitly chose full-network totals; filter-aware would require a different signature taking the filter state).
- Click-through interactions (the bar is read-only by design).
- Additional stats (median connections per company, growth over time, recency, etc.) — not requested.
- Customising which stats appear or their order — fixed three.
