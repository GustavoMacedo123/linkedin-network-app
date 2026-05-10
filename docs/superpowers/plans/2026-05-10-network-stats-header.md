# Network Stats Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact, read-only stats bar at the top of the middle panel showing total connections, top company by count, and number of distinct companies — always reflecting the user's full non-archived network, never affected by filters.

**Architecture:** A pure selector (`computeNetworkStats`) added to `src/state/selectors.ts` does all the math; a presentational `NetworkStats` component subscribes to `persons` from the Zustand store and renders an inline dot-separated bar. The component is mounted inside `GraphCanvas` by wrapping the existing `<main>` in a flex column so the bar sits flush above the force-graph canvas. No store, DB, or other component changes.

**Tech Stack:** React 18 + TypeScript, Zustand store, Vitest + React Testing Library + jsdom, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-05-10-network-stats-header-design.md`

---

## File Structure

| Path | Responsibility | Status |
|---|---|---|
| `src/state/selectors.ts` | Add `computeNetworkStats` + `NetworkStats` interface | modify |
| `src/components/NetworkStats.tsx` | Stats bar component, subscribes to store | create |
| `src/components/GraphCanvas.tsx` | Wrap return in flex column, render `<NetworkStats />` above the force-graph | modify |
| `tests/state/networkStats.test.ts` | Unit tests for the selector | create |
| `tests/components/NetworkStats.test.tsx` | Component-level tests | create |

---

## Task 1: `computeNetworkStats` selector (TDD)

**Files:**
- Create: `tests/state/networkStats.test.ts`
- Modify: `src/state/selectors.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/state/networkStats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeNetworkStats } from "@/state/selectors";
import type { PersonNode } from "@/state/store";

const make = (id: number, company: string | null, archived = false): PersonNode => ({
  id, first_name: "F", last_name: "L", company, title: null, archived, tagIds: [],
});

describe("computeNetworkStats", () => {
  it("counts non-archived persons and finds top company", () => {
    const persons = [make(1, "Google"), make(2, "Google"), make(3, "Stripe")];
    expect(computeNetworkStats(persons)).toEqual({
      total: 3,
      topCompany: { name: "Google", count: 2 },
      companyCount: 2,
    });
  });

  it("excludes archived from all three stats", () => {
    const persons = [make(1, "Google"), make(2, "Stripe"), make(3, "Stripe", true)];
    expect(computeNetworkStats(persons)).toEqual({
      total: 2,
      topCompany: { name: "Google", count: 1 },
      companyCount: 2,
    });
  });

  it("returns zero stats for empty input or all-archived", () => {
    expect(computeNetworkStats([])).toEqual({
      total: 0, topCompany: null, companyCount: 0,
    });
    expect(computeNetworkStats([make(1, "Google", true)])).toEqual({
      total: 0, topCompany: null, companyCount: 0,
    });
  });

  it("treats null, empty, and whitespace-only company as missing", () => {
    const persons = [make(1, null), make(2, ""), make(3, "   "), make(4, "Stripe")];
    expect(computeNetworkStats(persons)).toEqual({
      total: 4,
      topCompany: { name: "Stripe", count: 1 },
      companyCount: 1,
    });
  });

  it("returns null topCompany and zero companyCount when nobody has a company set", () => {
    const persons = [make(1, null), make(2, "")];
    expect(computeNetworkStats(persons)).toEqual({
      total: 2, topCompany: null, companyCount: 0,
    });
  });

  it("groups companies case-insensitively and merges leading/trailing whitespace", () => {
    const persons = [make(1, "Google"), make(2, "google"), make(3, " GOOGLE ")];
    const stats = computeNetworkStats(persons);
    expect(stats.total).toBe(3);
    expect(stats.companyCount).toBe(1);
    expect(stats.topCompany?.count).toBe(3);
  });

  it("uses most-common original casing as the display name for the top company", () => {
    const persons = [make(1, "Google"), make(2, "Google"), make(3, "google")];
    expect(computeNetworkStats(persons).topCompany?.name).toBe("Google");
  });

  it("breaks display-casing ties by case-sensitive alphabetical first", () => {
    // Both casings appear once. ASCII: 'G' (71) < 'g' (103), so "Google" wins.
    const persons = [make(1, "Google"), make(2, "google")];
    expect(computeNetworkStats(persons).topCompany?.name).toBe("Google");
  });

  it("breaks top-company ties alphabetically (case-insensitive)", () => {
    const persons = [make(1, "Stripe"), make(2, "apple")];
    expect(computeNetworkStats(persons).topCompany).toEqual({ name: "apple", count: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/state/networkStats.test.ts`
Expected: All tests fail with `computeNetworkStats is not exported` or similar — the function doesn't exist yet.

- [ ] **Step 3: Implement the selector**

Append to `src/state/selectors.ts` (keep the existing `matchesFilter` and `FilterState` exports untouched):

```ts
export interface NetworkStats {
  total: number;
  topCompany: { name: string; count: number } | null;
  companyCount: number;
}

export function computeNetworkStats(persons: PersonNode[]): NetworkStats {
  const active = persons.filter(p => !p.archived);
  const total = active.length;

  // Group by normalised company key. Each group tracks how many people use each
  // original casing, so the top company can render with its most common spelling.
  const groups = new Map<string, { displayCounts: Map<string, number>; total: number }>();
  for (const p of active) {
    const raw = (p.company ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { displayCounts: new Map(), total: 0 };
      groups.set(key, g);
    }
    g.total += 1;
    g.displayCounts.set(raw, (g.displayCounts.get(raw) ?? 0) + 1);
  }

  const companyCount = groups.size;

  let top: { name: string; count: number } | null = null;
  for (const g of groups.values()) {
    const variants = [...g.displayCounts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
    const displayName = variants[0][0];
    const isBetter =
      top === null ||
      g.total > top.count ||
      (g.total === top.count && displayName.toLowerCase() < top.name.toLowerCase());
    if (isBetter) top = { name: displayName, count: g.total };
  }

  return { total, topCompany: top, companyCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/state/networkStats.test.ts`
Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/selectors.ts tests/state/networkStats.test.ts
git commit -m "feat(stats): computeNetworkStats selector with case-insensitive company grouping"
```

---

## Task 2: `NetworkStats` component (TDD)

**Files:**
- Create: `tests/components/NetworkStats.test.tsx`
- Create: `src/components/NetworkStats.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/NetworkStats.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NetworkStats } from "@/components/NetworkStats";
import { useStore } from "@/state/store";
import type { PersonNode } from "@/state/store";

const make = (id: number, company: string | null, archived = false): PersonNode => ({
  id, first_name: "F", last_name: "L", company, title: null, archived, tagIds: [],
});

describe("NetworkStats", () => {
  beforeEach(() => {
    useStore.setState({ persons: [] });
  });

  it("renders nothing when there are no non-archived connections", () => {
    const { container } = render(<NetworkStats />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when every person is archived", () => {
    useStore.setState({ persons: [make(1, "Google", true)] });
    const { container } = render(<NetworkStats />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders all three stats when at least one connection has a company", () => {
    useStore.setState({
      persons: [make(1, "Google"), make(2, "Google"), make(3, "Stripe")],
    });
    render(<NetworkStats />);
    expect(screen.getByText(/3 connections/)).toBeInTheDocument();
    expect(screen.getByText(/Top: Google \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/2 companies/)).toBeInTheDocument();
  });

  it("omits the top + company-count segments when nobody has a company set", () => {
    useStore.setState({ persons: [make(1, null), make(2, "")] });
    render(<NetworkStats />);
    expect(screen.getByText(/2 connections/)).toBeInTheDocument();
    expect(screen.queryByText(/Top:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/compan(y|ies)/)).not.toBeInTheDocument();
  });

  it("uses singular forms for counts of 1", () => {
    useStore.setState({ persons: [make(1, "Google")] });
    render(<NetworkStats />);
    // The whole bar is one element with all text. Match it as a regex over the
    // full text content to assert no plural 's' appears in either copy.
    expect(screen.getByText(/^1 connection\b.*\b1 company$/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/NetworkStats.test.tsx`
Expected: All tests fail with `Cannot find module '@/components/NetworkStats'`.

- [ ] **Step 3: Implement the component**

Create `src/components/NetworkStats.tsx`:

```tsx
import { useMemo } from "react";
import { useStore } from "@/state/store";
import { computeNetworkStats } from "@/state/selectors";

export function NetworkStats() {
  const persons = useStore(s => s.persons);
  const stats = useMemo(() => computeNetworkStats(persons), [persons]);

  if (stats.total === 0) return null;

  const parts: string[] = [];
  parts.push(`${stats.total} ${stats.total === 1 ? "connection" : "connections"}`);
  if (stats.topCompany) {
    parts.push(`Top: ${stats.topCompany.name} (${stats.topCompany.count})`);
    parts.push(`${stats.companyCount} ${stats.companyCount === 1 ? "company" : "companies"}`);
  }

  return (
    <div className="px-3 py-1.5 border-b border-neutral-200 bg-white text-xs text-neutral-600">
      {parts.join("  ·  ")}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/NetworkStats.test.tsx`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/NetworkStats.tsx tests/components/NetworkStats.test.tsx
git commit -m "feat(stats): NetworkStats component renders inline dot-separated stats bar"
```

---

## Task 3: Mount `NetworkStats` inside `GraphCanvas`

**Files:**
- Modify: `src/components/GraphCanvas.tsx`

This task has no automated test — it's a structural wrap-in-a-div change. Verification is visual via `npm run tauri dev`.

- [ ] **Step 1: Add the import**

In `src/components/GraphCanvas.tsx`, add this line below the other component imports (currently the imports run from `react-force-graph-2d` down through the graph helpers; add this just after the `convexHull, expandHull` line):

```tsx
import { NetworkStats } from "./NetworkStats";
```

- [ ] **Step 2: Wrap the existing `<main>` return in a flex column**

In `src/components/GraphCanvas.tsx`, locate the `return (` block. The current opening is:

```tsx
return (
  <main className="bg-neutral-50 relative overflow-hidden">
    <ForceGraph2D
      ref={fgRef}
```

Replace the opening `<main>` and add an inner wrapper that holds the force-graph. The new opening becomes:

```tsx
return (
  <main className="bg-neutral-50 flex flex-col overflow-hidden">
    <NetworkStats />
    <div className="flex-1 min-h-0 relative">
      <ForceGraph2D
        ref={fgRef}
```

Find the matching closing `</main>` at the bottom of the return. There is one self-closing `<ForceGraph2D ... />` tag closing the graph. Immediately after that closing `/>`, add a closing `</div>` for the new wrapper, leaving the existing `</main>` after it. The closing block becomes:

```tsx
        ...all the existing ForceGraph2D props...
      />
    </div>
  </main>
);
```

(The `relative` class moves from `<main>` to the inner wrapper because the force-graph relies on its parent's `relative` positioning context for absolute-positioned canvas overlays; `<main>` is now the flex container.)

- [ ] **Step 3: Typecheck and run the existing test suite**

Run: `npx tsc --noEmit && npm test`
Expected: TypeScript clean. All existing tests still pass. The two new test files (from Tasks 1 and 2) also pass.

- [ ] **Step 4: Visual smoke test**

Run: `npm run tauri dev`

Verify in the live app:
1. The stats bar appears at the top of the middle panel (above the force-graph), spanning the full width of the middle column.
2. The numbers match expectations for your imported network (e.g., total connections matches what you remember importing).
3. Toggle a sidebar filter (click a company chip) — the graph fades/isolates as before, but **the stats bar's numbers do not change** (full-network totals, filter-independent).
4. The force-graph still fills the rest of the panel and is interactive (zoom, pan, click a node).

If the canvas looks zero-sized after the change, the inner wrapper is missing `min-h-0` — re-check Step 2.

- [ ] **Step 5: Commit**

```bash
git add src/components/GraphCanvas.tsx
git commit -m "feat(stats): mount NetworkStats above the force-graph in GraphCanvas"
```

---

## Self-Review

**Spec coverage check (`docs/superpowers/specs/2026-05-10-network-stats-header-design.md`):**

| Spec requirement | Task |
|---|---|
| Full-network totals, filter-independent | Task 2 (component reads `persons` directly, not `matchesFilter` output) |
| Read-only display, top-company name not clickable | Task 2 (renders plain text, no `onClick`) |
| Archived excluded from all three stats | Task 1 (test: "excludes archived from all three stats") |
| Total = count of non-archived | Task 1 |
| Top company tie-break alphabetical (case-insensitive) | Task 1 (test: "breaks top-company ties alphabetically") |
| Null/empty/whitespace company excluded from top + count, included in total | Task 1 (test: "treats null, empty, and whitespace-only company as missing") |
| Companies grouped by trimmed lowercase | Task 1 (test: "groups companies case-insensitively and merges leading/trailing whitespace") |
| Display name = most-common casing, ties by case-sensitive alphabetical | Task 1 (tests: "uses most-common original casing", "breaks display-casing ties by case-sensitive alphabetical first") |
| Hide bar when total === 0 | Task 2 (test: "renders nothing when there are no non-archived connections", "renders nothing when every person is archived") |
| Drop top + companyCount segments when no one has a company | Task 2 (test: "omits the top + company-count segments when nobody has a company set") |
| Singular/plural copy correct | Task 2 (test: "uses singular forms for counts of 1") |
| Inline dot-separated visual format | Task 2 (component renders `parts.join(" · ")`) |
| ~32px tall, white bg, neutral grey text, 1px bottom border | Task 2 (Tailwind: `px-3 py-1.5 border-b border-neutral-200 bg-white text-xs text-neutral-600`) |
| Mounted inside `GraphCanvas`, not `Layout` | Task 3 |
| `useMemo` keyed on `persons` | Task 2 |
| No new store fields, no DB changes | Confirmed — none of the three tasks touch `src/state/store.ts` or `src/db/` |

All requirements covered.

**Type consistency check:** `NetworkStats` interface defined in Task 1 matches the shape destructured/displayed in Task 2 (`stats.total`, `stats.topCompany?.name`, `stats.topCompany?.count`, `stats.companyCount`). Function name `computeNetworkStats` is identical in both places. `PersonNode` is imported from `@/state/store` consistently.

**Placeholder scan:** No TBDs, TODOs, "add error handling", or "similar to". Every code step shows the actual code.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-10-network-stats-header.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, with a code-review pass between tasks. Best when you want quality gates without staying in the loop.

**2. Inline Execution** — Run all three tasks in this session sequentially. Faster, no per-task context resets.

Which approach?
