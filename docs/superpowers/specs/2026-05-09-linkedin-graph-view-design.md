# LinkedIn Network Graph — Design Spec

**Date:** 2026-05-09
**Status:** Design approved; ready for implementation planning
**Project root:** `C:\Users\Gustavo\linkedin-network-app`

---

## TL;DR

A Tauri desktop app that turns your exported LinkedIn `Connections.csv` into an interactive force-directed graph. Built primarily for two jobs: **pattern discovery** (see clusters in your network) and **CRM-lite** (remember context on people via persistent notes/tags). All data stays on your machine. No accounts, no cloud, no API calls.

---

## 1. Vision

You have ~1,000+ LinkedIn connections that you mostly forget about. The product turns that flat list into a navigable map: clusters by company, color-coded communities, click-to-recall notes. Runs as a desktop app and stores everything locally in SQLite.

---

## 2. Audience and use cases

**Audience:** solo, single-user. No multi-tenancy, no auth, no billing.

**Top jobs-to-be-done (priority order):**

1. **Pattern discovery** — see clusters in the network you didn't realize existed. The graph itself is the primary product.
2. **CRM-lite** — recall context on someone before a meeting. Notes, tags, and the profile panel are the primary product.
3. (Secondary) Warm-intro discovery, opportunity hunting, exploration.

---

## 3. The LinkedIn data constraint

**LinkedIn does not expose connection data via any usable API.** The Connections API was deprecated in 2015 and is now gated behind enterprise partnerships (Marketing Developer Platform, Sales Navigator API, Talent Solutions). Public OAuth's `Sign in with LinkedIn` returns only the signed-in user's basic profile, not their network.

The only durable, legal data source is the **user's own data export** — LinkedIn lets each member download their `Connections.csv`. The export contains:

| Field | Notes |
|---|---|
| First Name, Last Name | Required, present on every row |
| URL | LinkedIn profile URL — used as the **natural key** for merge |
| Email Address | Often blank (only filled if the connection opted in to share) |
| Company | Current company at time of export |
| Position | Current title at time of export |
| Connected On | Date in `DD Mon YYYY` format (e.g., `16 Mar 2024`) |

**NOT in the export:** past companies, schools, mutual connections, skills, location, photo, profile bio.

**Implications:**

- The app is a CSV importer + visualizer; no live API calls.
- There are no real edges between connections — only YOUR connection to each. All visual person-to-person edges are **synthetic**, derived from shared attributes (default: same company).
- Filtering by school or past companies is not viable in v1; it's deferred to v2 enrichment.

---

## 4. Decisions (locked in via brainstorming)

| Topic | Choice | Reason |
|---|---|---|
| Audience | Personal tool (solo) | Skips auth, billing, multi-tenancy |
| Form factor | **Tauri** desktop app | ~10MB binary, native webview |
| Frontend | **React 18 + TypeScript + Tailwind** | Best graph-library ecosystem; type safety for solo dev |
| Graph library | **react-force-graph-2d** | Canvas-rendered, proven at 1k–10k nodes |
| Storage | **SQLite + FTS5** via `tauri-plugin-sql` | Full-text search on notes, simple file backup |
| Community detection | **graphology + community-louvain** | Algorithm Gephi/Obsidian use for cluster colors |
| Search | **Fuse.js** (fuzzy on names/companies) + FTS5 (notes) | Tiny, fast, no setup |
| State | **Zustand** | Hooks-friendly, small footprint |
| Markdown editor | `@uiw/react-md-editor` | Good DX, OOTB styling, light bundle |
| Aesthetic | **Modern data-viz** | Light canvas, photo-bearing nodes, soft cluster regions, gold "you" |
| Layout | **Three-pane** | Sidebar (filters) / graph / profile-notes panel |
| Data richness (v1) | **CSV + manual notes** | Defer enrichment to v2 |
| Default edge rule | **Same company** | Clearest visible clusters |
| Default filter mode | **Fade** (non-matches go to 15% opacity) | Preserves spatial map between filters |

---

## 5. Architecture

```
┌────────────────────────────────────────────────────────────┐
│ Tauri Desktop App (Rust core, ~10MB binary)                │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Webview: React 18 + TypeScript SPA                     │ │
│ │  • Three-pane UI (Tailwind CSS)                        │ │
│ │  • react-force-graph-2d (d3-force + canvas)            │ │
│ │  • graphology + community-louvain                      │ │
│ │  • Fuse.js fuzzy search                                │ │
│ │  • Zustand state store                                 │ │
│ └────────────────────────────────────────────────────────┘ │
│                      ↕ Tauri IPC                           │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Rust backend (minimal)                                 │ │
│ │  • Native file-picker for CSV import                   │ │
│ │  • SQLite (FTS5 enabled) via tauri-plugin-sql          │ │
│ │  • App-data dir for DB + import snapshots              │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
   Storage paths (Windows):
     %APPDATA%\com.you.linkedin-network\data.sqlite
     %APPDATA%\com.you.linkedin-network\backup\import-<ts>.sqlite
   (Tauri resolves equivalents on macOS / Linux automatically.)
```

**Explicitly out of v1:**

- No backend, no auth, no cloud sync
- No telemetry, no analytics
- No enrichment APIs (Apollo, People Data Labs, Clay)
- No browser extension
- No multi-user CSV merge

---

## 6. Data model

```sql
-- Each row of LinkedIn Connections.csv becomes one Person.
CREATE TABLE person (
  id            INTEGER PRIMARY KEY,
  linkedin_url  TEXT UNIQUE NOT NULL,    -- natural key, used for merge-on-reimport
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT,                    -- often blank
  company       TEXT,                    -- current at last import
  title         TEXT,
  connected_on  DATE,                    -- ISO YYYY-MM-DD
  notes_md      TEXT NOT NULL DEFAULT '',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_person_company  ON person(company);
CREATE INDEX idx_person_archived ON person(archived);

CREATE TABLE tag (
  id    INTEGER PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL                    -- hex, e.g., "#fef3c7"
);

CREATE TABLE person_tag (
  person_id INTEGER NOT NULL,
  tag_id    INTEGER NOT NULL,
  PRIMARY KEY (person_id, tag_id),
  FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)    REFERENCES tag(id)    ON DELETE CASCADE
);

CREATE TABLE saved_view (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  filter_json TEXT NOT NULL,             -- JSON-serialized filter state
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE import_session (
  id            INTEGER PRIMARY KEY,
  imported_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file_name     TEXT,
  rows_total    INTEGER NOT NULL,
  rows_added    INTEGER NOT NULL,
  rows_updated  INTEGER NOT NULL,
  rows_archived INTEGER NOT NULL,
  snapshot_path TEXT                     -- path to pre-import DB snapshot
);

CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Full-text search across name + company + title + notes
CREATE VIRTUAL TABLE person_fts USING fts5(
  first_name, last_name, company, title, notes_md,
  content='person', content_rowid='id'
);

-- FTS triggers (keep person_fts in sync with person)
CREATE TRIGGER person_ai AFTER INSERT ON person BEGIN
  INSERT INTO person_fts(rowid, first_name, last_name, company, title, notes_md)
  VALUES (new.id, new.first_name, new.last_name, new.company, new.title, new.notes_md);
END;

CREATE TRIGGER person_ad AFTER DELETE ON person BEGIN
  INSERT INTO person_fts(person_fts, rowid, first_name, last_name, company, title, notes_md)
  VALUES ('delete', old.id, old.first_name, old.last_name, old.company, old.title, old.notes_md);
END;

CREATE TRIGGER person_au AFTER UPDATE ON person BEGIN
  INSERT INTO person_fts(person_fts, rowid, first_name, last_name, company, title, notes_md)
  VALUES ('delete', old.id, old.first_name, old.last_name, old.company, old.title, old.notes_md);
  INSERT INTO person_fts(rowid, first_name, last_name, company, title, notes_md)
  VALUES (new.id, new.first_name, new.last_name, new.company, new.title, new.notes_md);
END;
```

### Key design decisions

| Decision | Rationale |
|---|---|
| `linkedin_url` as natural key | Names and companies change; URLs don't. Re-imports merge correctly. |
| `notes_md` as a column on `person` (not a separate table) | Single-user, no history needed for v1. A `note_history` table can be added later for diff tracking. |
| `archived` flag instead of DELETE on re-import | Preserves notes/tags when someone disconnects; keeps the option to undo via re-import. |
| **No `edge` table** | The CSV gives no real connection-between-connections data. Edges are computed at query time from shared attributes. |
| FTS5 virtual table with triggers | Full-text search across notes for free. |

### Edges in the graph

Since the CSV provides **no real edges between your connections**, every line drawn between two non-you nodes is *synthetic*, derived from shared attributes. Default rules:

- **You ↔ everyone** — radial backbone, ensures the graph is connected
- **Person ↔ Person** when they share the active edge attribute (default: `company`)
- Toggleable: `tag`, `title-keyword`, `connection-year`, or `radial-only` (no synthetic person-to-person edges)

Louvain community detection then runs over the resulting edge set; communities are color-coded.

This synthesis is exposed honestly in the UI: a small "Why these clusters?" tooltip explains the active edge rule.

---

## 7. CSV import & merge flow

```
[ File picker (Tauri native) ]
        ↓
[ Read file; detect encoding (UTF-8, UTF-8-BOM) ]
        ↓
[ Skip LinkedIn's preamble lines until header row found ]
        ↓
[ Parse with PapaParse (streaming, handles quoted commas) ]
        ↓
[ Validate row: linkedin_url required ]
   - missing → skip + warn
        ↓
[ Snapshot DB to backup/import-<timestamp>.sqlite ]
        ↓
[ BEGIN TRANSACTION ]
   for each parsed row:
     - URL exists in DB:
         UPDATE company, title, connected_on, first_name, last_name, email
         (only if changed); PRESERVE notes_md, tags, archived
         → rows_updated++
     - URL not in DB:
         INSERT new person
         → rows_added++
   for each URL in DB but not in CSV:
     SET archived = 1   (preserves notes/tags; hides from default view)
     → rows_archived++
[ COMMIT ]
        ↓
[ INSERT into import_session (counts + snapshot_path) ]
        ↓
[ Re-run Louvain community detection over current visible graph ]
        ↓
[ Show summary toast with [Undo] button ]
   "Imported 1,247 connections — 287 added, 53 updated, 12 archived"
   Undo restores the pre-import snapshot for the duration of the session.
```

### Concerns & handling

| Concern | Handling |
|---|---|
| Notes/tags must never be lost | Match on `linkedin_url`, never DELETE on re-import — archive instead. Snapshot before every import. |
| LinkedIn CSV format drift | Detect columns by header name, not position. Hard-fail with a clear error if a required header (`URL`, `First Name`, `Last Name`) is missing. |
| Date parsing (`DD Mon YYYY`) | Single normalizer function; store as ISO `YYYY-MM-DD`. |
| Email column mostly empty | Best-effort metadata; never treated as a key. |
| Duplicate URLs in same CSV | Last row wins; warn in import summary. |
| Snapshot pruning | Auto-delete snapshots older than 7 days at app startup. |

### Re-import frequency

Suggested rhythm: monthly. Settings panel shows "Last imported: <date> · [Re-import]".

### Deferred from v1

- Diff-preview screen ("Here's what will change before you commit") — v1.1
- Multi-CSV merge (importing a friend's CSV alongside yours) — v2 feature for connections-of-connections
- Folder-watch auto-import — overkill for monthly cadence

---

## 8. Graph rendering & filtering

### Pipeline

1. **Selector layer** (memoized) reads filter state + DB → returns `{ visibleNodes, syntheticEdges }`
2. **Community detection** (`graphology` + `community-louvain`) runs over the visible subgraph; each node gets a `communityId`
3. **Cluster colors** assigned by `communityId` from a fixed 12-color palette; tiny communities (size < 3) fall back to neutral gray
4. **Cluster regions** drawn under the graph as alpha-blended convex hulls over each community's node positions, recomputed on simulation tick
5. **Node sizing** by `0.5 * degree + 0.5 * betweenness_centrality`; the "you" node is always largest and gold
6. **Edges** synthetic-only, derived from active edge rule (Section 6)

### Interactions

| Interaction | Behavior |
|---|---|
| Click node | Selects person; right panel shows profile + notes |
| Drag node | Pins position (Shift+drag = unpin) |
| Hover node | Tooltip with name + company + title (300ms delay) |
| Scroll | Zoom (cursor-anchored) |
| Drag empty space | Pan |
| `Cmd/Ctrl + F` | Focus sidebar search input |
| Click cluster region | Filter sidebar to that community's dominant company |
| `Cmd/Ctrl + 0` | Reset zoom + unpin all nodes |

### Filter modes

- **Fade (default)**: non-matching nodes drop to 15% opacity but stay on canvas — preserves spatial context
- **Isolate**: hide non-matches and re-run simulation on the filtered subgraph — useful for "show only AI engineers"

Toggle is one click apart in the sidebar.

### Performance budget

| Dataset size | Strategy |
|---|---|
| < 1,500 nodes | All nodes rendered, full force simulation |
| 1,500–5,000 | Same, but throttle simulation alpha decay |
| > 5,000 | Auto-prompt: "Apply default filter to reduce visible nodes?" |

For typical personal networks (1k–3k connections), no perf concerns.

### Cluster labels

Auto-derived: each community gets a label = the most-common `company` value among its members, or "Mixed" if no value dominates. Labels render at the centroid and fade out at high zoom.

### Out of v1

- 3D / WebGL graph
- Custom force-tuning UI (sliders for repulsion, link distance)
- Edge bundling
- Animated transitions on filter change beyond opacity tween

---

## 9. UI panels

### Left sidebar (~240px)

```
┌─────────────────────────────────┐
│ ⌕ Search…                       │  Cmd/Ctrl+F focuses
├─────────────────────────────────┤
│ COMPANIES                       │
│  ● Google           42  ☐       │  color = community color
│  ● Stripe           18  ☐       │  count = visible (filtered)
│  ● Atlassian        12  ☐       │
│  + 23 more…                     │  virtualized scroll
├─────────────────────────────────┤
│ TAGS              [+ new]       │
│  [infra]  [advisor]  [to-meet]  │  click toggles filter
├─────────────────────────────────┤
│ SAVED VIEWS       [+ save view] │
│  ★ Q2 reach-outs                │
│  ★ AI engineers                 │
├─────────────────────────────────┤
│ ⚙ Settings    📥 Import CSV    │
└─────────────────────────────────┘
```

- Companies sorted by visible count, descending; top 8 shown by default with a "more" expander
- Tag chips: click toggles filter; right-click → rename / change color / delete
- Saved views: any filter combo can be saved with a name; click loads, right-click rename/delete

### Right panel — profile / notes / tags

```
┌───────────────────────────────────┐
│         [photo placeholder]       │  initials in v1
│         Sarah Chen                │
│         Senior Engineer @ Stripe  │
│         Connected: Mar 16, 2024   │
│  [↗ Open LinkedIn]                │
├───────────────────────────────────┤
│ TAGS                              │
│  [infra ✕]  [advisor ✕]  [+ add]  │
├───────────────────────────────────┤
│ NOTES                             │
│ ┌───────────────────────────────┐ │
│ │ <markdown editor>             │ │
│ └───────────────────────────────┘ │
│  ✓ Saved 2s ago                   │  500ms autosave
├───────────────────────────────────┤
│ NEIGHBORS IN GRAPH                │
│  • John Park (Stripe)             │
│  • Rohan Sharma (Stripe)          │
│  + 7 more…                        │
└───────────────────────────────────┘
```

- Markdown editor: `@uiw/react-md-editor`; 500ms debounced autosave; FTS5 reindex on save
- Tags: autocomplete combobox; new tags get a randomly-assigned palette color (changeable via right-click in sidebar)
- Neighbors: derived from current edge rule
- Empty state (no person selected): network summary — total connections, top 5 companies, last import date

### Search behavior

- Sidebar search is **fuzzy** (Fuse.js) over `first_name + last_name + company + title`, 150ms debounce
- `note:` prefix triggers **full-text search** through FTS5 over notes (e.g., `note: SXSW`)

### Settings panel (modal)

| Section | Content |
|---|---|
| Data | Last import timestamp · Import CSV · Export DB backup · Restore from backup |
| Graph | Edge rule selector · Filter mode (fade / isolate) · Reset layout |
| Tags | List of all tags with rename / recolor / delete |
| Display | Theme: light only in v1 (dark deferred to v1.1) |
| About | Version · Open data folder |

---

## 10. First-run experience

```
┌─────────────────────────────────────────┐
│  Welcome.                               │
│                                         │
│  This app reads a LinkedIn CSV export   │
│  and gives you a network-graph view of  │
│  your connections.                      │
│                                         │
│  Step 1 — Get your data from LinkedIn:  │
│  Settings → Data Privacy → Get a copy → │
│  Connections (fast export, ~10 min)     │
│                                         │
│  Step 2 — Import the file:              │
│       [ Choose Connections.csv ]        │
│                                         │
│  Your data stays on this machine.       │
└─────────────────────────────────────────┘
```

After import: drop into the three-pane view with the graph already laid out, and a dismissible "Click any node to start adding notes" hint.

---

## 11. Out of scope (deferred)

| Version | Item |
|---|---|
| v1.1 | Dark theme, command palette (`Cmd/Ctrl+K`), diff-preview before import, edge bundling, animated filter transitions |
| v2 | Enrichment APIs (schools, past companies, skills) — Apollo / PDL / Clay |
| v2 | Browser extension for incremental data harvest from logged-in LinkedIn (legal-gray, ToS-risk) |
| v2 | Multi-user CSV merge — load a friend's CSV alongside yours to enable connections-of-connections |
| v2 | Cloud sync between machines |
| v2+ | LLM-assisted note suggestions, auto-tagging by title text, embedding-based similarity edges |

---

## 12. Risks & open questions

| Risk | Likelihood | Mitigation |
|---|---|---|
| LinkedIn changes CSV format again | High | Header-name parsing; clear error on missing required column |
| User misreads synthetic edges as a real social graph | Medium | "Why these clusters?" tooltip; explicit copy in settings |
| Graph perf at 5k+ nodes | Low for personal use | Auto-prompt to filter; canvas (not SVG) renderer |
| User wants schools/past-companies and is disappointed by v1 | Medium | Spec is explicit about deferral; v2 path is clear |
| Cross-device sync requested | Medium | Document SQLite file location; user can manually sync via Dropbox/iCloud Drive if desperate |

---

## 13. Success criteria for v1

The v1 is successful if all of the following are true:

1. Importing a CSV completes in under 1 minute for a 1,500-row file with no manual editing.
2. The graph loads and is interactive within 2 seconds of import completion (1.5k nodes).
3. Fuzzy search returns results in under 150ms (typical hardware).
4. Adding a note to a person persists across re-imports of the CSV.
5. Re-importing a CSV never deletes notes or tags.
6. The graph reveals at least one cluster the user did not consciously know about (subjective; this is the central pattern-discovery test).

---

## 14. High-level implementation phases

To be expanded into a phased plan via `superpowers:writing-plans`. Phases:

1. **Skeleton** — Tauri project init, React + Tailwind shell, three-pane layout placeholders, SQLite plugin wired and migrating.
2. **Import** — First-run dialog, CSV parser (PapaParse), merge logic, snapshot/restore.
3. **Graph** — `react-force-graph-2d` rendering DB-backed nodes, force layout, basic node styling.
4. **Communities & clusters** — Louvain detection, cluster coloring, soft cluster regions, centrality-based node sizing.
5. **Filters & sidebar** — Companies / tags / saved-views chips, fade vs. isolate filter modes.
6. **Profile panel** — Markdown notes editor with FTS5-indexed autosave, tag combobox, neighbors list.
7. **Polish** — Search bar with `note:` prefix, settings modal, first-run flow, undo, error states, snapshot pruning.

---

*End of spec.*
