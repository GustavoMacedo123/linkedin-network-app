# LinkedIn Network Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tauri desktop app that imports a LinkedIn `Connections.csv` and shows it as an interactive force-directed graph with persistent notes/tags, per the spec at `docs/superpowers/specs/2026-05-09-linkedin-graph-view-design.md`.

**Architecture:** Tauri 2 shell (Rust) wrapping a React 18 + TypeScript SPA. SQLite (FTS5 enabled) via `tauri-plugin-sql` for storage. `react-force-graph-2d` for the canvas-rendered graph; `graphology` + Louvain for community detection; Fuse.js for fuzzy search. Zustand for state. Tailwind for styling. All data local — no network calls.

**Tech Stack:** Tauri 2, Rust, React 18, TypeScript, Vite, Tailwind CSS, SQLite + FTS5, react-force-graph-2d, graphology, graphology-communities-louvain, Fuse.js, Zustand, @uiw/react-md-editor, PapaParse, Vitest, React Testing Library, better-sqlite3 (test-only).

---

## File Structure

```
linkedin-network-app/
├── docs/superpowers/
│   ├── specs/2026-05-09-linkedin-graph-view-design.md   (already exists)
│   └── plans/2026-05-09-linkedin-network-graph.md       (this file)
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                  # Tauri app entry
│   │   ├── commands.rs              # IPC commands (snapshot, restore, open_data_dir)
│   │   └── snapshot.rs              # DB snapshot/restore by file copy
│   ├── migrations/0001_initial.sql  # Schema migration (run by tauri-plugin-sql)
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── build.rs
├── src/
│   ├── main.tsx                     # React root
│   ├── App.tsx                      # Top-level shell
│   ├── index.css                    # Tailwind directives
│   ├── db/
│   │   ├── client.ts                # Db interface + tauri-plugin-sql impl
│   │   ├── migrate.ts               # Apply 0001_initial.sql on first run
│   │   ├── persons.ts               # Person CRUD
│   │   ├── tags.ts                  # Tag CRUD
│   │   ├── savedViews.ts            # SavedView CRUD
│   │   ├── importSession.ts         # Import session log
│   │   └── settings.ts              # KV settings
│   ├── csv/
│   │   ├── parse.ts                 # PapaParse + header detection
│   │   ├── merge.ts                 # Upsert/archive logic
│   │   └── dateFormat.ts            # "DD Mon YYYY" → ISO date
│   ├── graph/
│   │   ├── synthEdges.ts            # Synthetic edge derivation
│   │   ├── community.ts             # Louvain wrapper
│   │   ├── centrality.ts            # Degree + betweenness scores
│   │   ├── clusterRegions.ts        # Convex hull computation
│   │   └── colors.ts                # 12-color palette + assignment
│   ├── search/
│   │   ├── fuzzy.ts                 # Fuse.js wrapper
│   │   └── notes.ts                 # FTS5 query helpers
│   ├── state/
│   │   ├── store.ts                 # Zustand root store
│   │   └── selectors.ts             # Derived selectors (visibleNodes, edges)
│   ├── components/
│   │   ├── Layout.tsx               # Three-pane shell
│   │   ├── Sidebar.tsx              # Left sidebar (search/companies/tags/views)
│   │   ├── GraphCanvas.tsx          # react-force-graph wrapper
│   │   ├── ProfilePanel.tsx         # Right panel
│   │   ├── NotesEditor.tsx          # Markdown editor with autosave
│   │   ├── TagCombobox.tsx          # Tag autocomplete combobox
│   │   ├── ImportDialog.tsx         # First-run / re-import flow
│   │   ├── SettingsModal.tsx        # Settings panel
│   │   ├── SearchBar.tsx            # Sidebar search input
│   │   └── EmptyState.tsx           # Welcome / no-selection states
│   └── lib/
│       ├── debounce.ts
│       └── format.ts                # Date/number formatters
├── tests/
│   ├── setup.ts                     # Vitest setup (jsdom, RTL matchers)
│   ├── helpers/
│   │   └── testDb.ts                # better-sqlite3 in-memory DB matching schema
│   ├── csv/
│   │   ├── parse.test.ts
│   │   ├── merge.test.ts
│   │   └── dateFormat.test.ts
│   ├── graph/
│   │   ├── synthEdges.test.ts
│   │   ├── community.test.ts
│   │   ├── centrality.test.ts
│   │   └── colors.test.ts
│   └── components/
│       ├── ImportDialog.test.tsx
│       ├── Sidebar.test.tsx
│       ├── ProfilePanel.test.tsx
│       └── NotesEditor.test.tsx
├── .gitignore                       (already exists)
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
└── vitest.config.ts
```

**Boundaries:**
- `csv/`, `graph/`, `search/` — pure functions, no DB or React. Easy to unit-test.
- `db/` — wraps the SQL plugin behind an interface so tests can swap in better-sqlite3.
- `state/` — Zustand store, owns filter state and selected person.
- `components/` — React components; depend on `state/` and `db/` via hooks.
- `src-tauri/` — minimal Rust; just file picker, snapshot, and "open data folder" command.

---

## Phase 1 — Skeleton

Goal: A Tauri app that opens, shows a three-pane layout with placeholders, and has a working SQLite database with the full schema migrated. No CSV import or graph yet.

### Task 1.1: Initialize npm package + Vite + React + TypeScript

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [x] **Step 1: Create package.json**

```json
{
  "name": "linkedin-network-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [x] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [x] **Step 3: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [x] **Step 4: Create vite.config.ts**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
});
```

- [x] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Network</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [x] **Step 6: Create src/main.tsx + App.tsx + index.css**

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div>Network — coming soon</div>;
}
```

`src/index.css`:
```css
html, body, #root { height: 100%; margin: 0; }
body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
```

- [x] **Step 7: Install and verify dev server**

Run: `npm install && npm run dev`
Expected: Vite dev server starts on `http://localhost:1420`; opening it shows "Network — coming soon".
Press Ctrl+C to stop.

- [x] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 1.2: Add Tailwind CSS

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`
- Modify: `src/index.css`, `src/App.tsx`, `package.json` (devDependencies)

- [x] **Step 1: Install Tailwind**

Run: `npm install -D tailwindcss@^3.4 postcss@^8.4 autoprefixer@^10.4`

- [x] **Step 2: Create tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 12-color community palette (also used by src/graph/colors.ts)
        community: {
          1: "#a78bfa", 2: "#34d399", 3: "#fb923c", 4: "#60a5fa",
          5: "#f472b6", 6: "#fbbf24", 7: "#22d3ee", 8: "#a3e635",
          9: "#f87171", 10: "#c084fc", 11: "#2dd4bf", 12: "#fdba74",
        },
        you: "#fbbf24", // gold for the "you" node
      },
    },
  },
  plugins: [],
};
```

- [x] **Step 3: Create postcss.config.js**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [x] **Step 4: Update src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; margin: 0; }
body { @apply font-sans bg-neutral-50 text-neutral-900; }
```

- [x] **Step 5: Update src/App.tsx to use Tailwind classes**

```tsx
export default function App() {
  return (
    <div className="h-full flex items-center justify-center text-neutral-500">
      Network — coming soon
    </div>
  );
}
```

- [x] **Step 6: Verify**

Run: `npm run dev`
Expected: Page renders with light gray background and centered text. Press Ctrl+C.

- [x] **Step 7: Commit**

```bash
git add tailwind.config.js postcss.config.js src/index.css src/App.tsx package.json package-lock.json
git commit -m "chore: add Tailwind CSS with community color palette"
```

---

### Task 1.3: Initialize Tauri 2 backend

**Files:**
- Create: `src-tauri/` (via Tauri CLI), then customize `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`

- [x] **Step 1: Install Tauri CLI as dev dependency and run init**

Run:
```
npm install -D @tauri-apps/cli@^2
npx tauri init --ci --app-name "linkedin-network-app" --window-title "Network" --frontend-dist "../dist" --dev-url "http://localhost:1420"
```
Expected: Creates `src-tauri/` with Cargo project. May prompt for confirmations — `--ci` should skip them.

- [x] **Step 2: Edit src-tauri/tauri.conf.json — set identifier, window size**

Replace `identifier` with `com.you.linkedin-network`. Set the main window:
```json
{
  "productName": "Network",
  "version": "0.1.0",
  "identifier": "com.you.linkedin-network",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420"
  },
  "app": {
    "windows": [{
      "title": "Network",
      "width": 1400,
      "height": 900,
      "minWidth": 1000,
      "minHeight": 700
    }],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.png"]
  }
}
```

- [x] **Step 3: Verify Tauri dev build runs**

Run: `npm run tauri dev`
Expected: Tauri compiles Rust (first run takes 1-3 minutes); a desktop window titled "Network" opens showing the React app. Close window or Ctrl+C.

- [x] **Step 4: Commit**

```bash
git add src-tauri/ package.json package-lock.json
git commit -m "chore: initialize Tauri 2 backend"
```

---

### Task 1.4: Add Tauri SQL plugin + initial migration

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` (if exists)
- Create: `src-tauri/migrations/0001_initial.sql`, `src/db/client.ts`, `src/db/migrate.ts`
- Modify: `package.json`

- [x] **Step 1: Add Rust dependency**

Edit `src-tauri/Cargo.toml`, add under `[dependencies]`:
```toml
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

- [x] **Step 2: Register plugin in src-tauri/src/main.rs (or lib.rs)**

Replace the contents of `src-tauri/src/main.rs` (preserve any auto-generated `#![cfg_attr(...)]` line at the top):
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

fn main() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial schema",
        sql: include_str!("../migrations/0001_initial.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:data.sqlite", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [x] **Step 3: Create src-tauri/migrations/0001_initial.sql**

(The full schema verbatim from the spec, Section 6. See spec for source of truth.)
```sql
CREATE TABLE person (
  id            INTEGER PRIMARY KEY,
  linkedin_url  TEXT UNIQUE NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT,
  company       TEXT,
  title         TEXT,
  connected_on  DATE,
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
  color TEXT NOT NULL
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
  filter_json TEXT NOT NULL,
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
  snapshot_path TEXT
);

CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE VIRTUAL TABLE person_fts USING fts5(
  first_name, last_name, company, title, notes_md,
  content='person', content_rowid='id'
);

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

- [x] **Step 4: Install JS plugin**

Run: `npm install @tauri-apps/plugin-sql@^2`

- [x] **Step 5: Create src/db/client.ts (DB interface + Tauri impl)**

```ts
import Database from "@tauri-apps/plugin-sql";

export interface Db {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

let _db: Database | null = null;

export async function getDb(): Promise<Db> {
  if (!_db) _db = await Database.load("sqlite:data.sqlite");
  const db = _db;
  return {
    async execute(sql, params = []) {
      const r = await db.execute(sql, params);
      return { rowsAffected: r.rowsAffected, lastInsertId: r.lastInsertId };
    },
    async select<T>(sql: string, params: unknown[] = []) {
      return db.select<T[]>(sql, params);
    },
  };
}
```

- [x] **Step 6: Smoke-test from App.tsx that DB is reachable**

Replace `src/App.tsx`:
```tsx
import { useEffect, useState } from "react";
import { getDb } from "./db/client";

export default function App() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(db => db.select<{ n: number }>("SELECT count(*) AS n FROM person"))
      .then(rows => setCount(rows[0]?.n ?? 0))
      .catch(e => setError(String(e)));
  }, []);

  return (
    <div className="h-full flex items-center justify-center text-neutral-700">
      {error && <span className="text-red-600">DB error: {error}</span>}
      {!error && count !== null && <span>DB ready · {count} persons</span>}
      {!error && count === null && <span>Loading…</span>}
    </div>
  );
}
```

- [x] **Step 7: Verify**

Run: `npm run tauri dev`
Expected: Window shows "DB ready · 0 persons" — confirms migration ran and SELECT works.

- [x] **Step 8: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/main.rs src-tauri/migrations/ src/db/ src/App.tsx package.json package-lock.json
git commit -m "feat(db): wire tauri-plugin-sql with full schema migration"
```

---

### Task 1.5: Three-pane Layout component (placeholders)

**Files:**
- Create: `src/components/Layout.tsx`, `src/components/Sidebar.tsx`, `src/components/GraphCanvas.tsx`, `src/components/ProfilePanel.tsx`
- Modify: `src/App.tsx`

- [x] **Step 1: Create Layout.tsx**

```tsx
import { Sidebar } from "./Sidebar";
import { GraphCanvas } from "./GraphCanvas";
import { ProfilePanel } from "./ProfilePanel";

export function Layout() {
  return (
    <div className="h-full grid grid-cols-[240px_1fr_280px] divide-x divide-neutral-200 bg-neutral-50">
      <Sidebar />
      <GraphCanvas />
      <ProfilePanel />
    </div>
  );
}
```

- [x] **Step 2: Create placeholder Sidebar.tsx, GraphCanvas.tsx, ProfilePanel.tsx**

`src/components/Sidebar.tsx`:
```tsx
export function Sidebar() {
  return (
    <aside className="bg-white p-3 overflow-y-auto">
      <div className="text-xs font-bold text-neutral-400 mb-2">SEARCH</div>
      <input
        type="text"
        placeholder="Find someone…"
        className="w-full px-2 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded"
      />
      <div className="mt-6 text-xs font-bold text-neutral-400">COMPANIES</div>
      <div className="mt-1 text-xs text-neutral-400 italic">No data yet</div>
    </aside>
  );
}
```

`src/components/GraphCanvas.tsx`:
```tsx
export function GraphCanvas() {
  return (
    <main className="bg-neutral-50 flex items-center justify-center text-neutral-400 text-sm">
      Graph will render here
    </main>
  );
}
```

`src/components/ProfilePanel.tsx`:
```tsx
export function ProfilePanel() {
  return (
    <aside className="bg-white p-4 overflow-y-auto text-sm text-neutral-500">
      <div className="text-center italic text-neutral-400">
        Click a node to see details
      </div>
    </aside>
  );
}
```

- [x] **Step 3: Update App.tsx to render Layout**

```tsx
import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { getDb } from "./db/client";

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(db => db.select("SELECT 1"))
      .then(() => setReady(true))
      .catch(e => setError(String(e)));
  }, []);

  if (error) return <div className="p-8 text-red-600">DB error: {error}</div>;
  if (!ready) return <div className="p-8 text-neutral-500">Loading…</div>;
  return <Layout />;
}
```

- [x] **Step 4: Verify**

Run: `npm run tauri dev`
Expected: A three-column layout — sidebar on left with search box and "No data yet", center area with "Graph will render here", right panel with "Click a node to see details".

- [x] **Step 5: Commit**

```bash
git add src/components/ src/App.tsx
git commit -m "feat(ui): three-pane layout with placeholders"
```

---

### Task 1.6: Set up Vitest + RTL test infrastructure

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`, `tests/helpers/testDb.ts`, `tests/components/Layout.test.tsx`
- Modify: `package.json`

- [x] **Step 1: Install test dependencies**

Run:
```
npm install -D vitest@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^24 better-sqlite3@^11 @types/better-sqlite3@^7
```

- [x] **Step 2: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
```

- [x] **Step 3: Create tests/setup.ts**

```ts
import "@testing-library/jest-dom/vitest";
```

- [x] **Step 4: Create tests/helpers/testDb.ts (in-memory SQLite matching schema)**

```ts
import BetterSqlite3 from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "@/db/client";

const SCHEMA = readFileSync(
  path.resolve(__dirname, "../../src-tauri/migrations/0001_initial.sql"),
  "utf-8"
);

export function makeTestDb(): Db {
  const sqlite = new BetterSqlite3(":memory:");
  sqlite.exec(SCHEMA);

  return {
    async execute(sql, params = []) {
      const stmt = sqlite.prepare(sql);
      const info = stmt.run(...(params as unknown[]));
      return {
        rowsAffected: Number(info.changes),
        lastInsertId: Number(info.lastInsertRowid),
      };
    },
    async select<T>(sql: string, params: unknown[] = []) {
      const stmt = sqlite.prepare(sql);
      return stmt.all(...(params as unknown[])) as T[];
    },
  };
}
```

- [x] **Step 5: Write a smoke test that the schema loads**

`tests/db/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";

describe("schema", () => {
  it("creates all tables and FTS5 virtual table", async () => {
    const db = makeTestDb();
    const tables = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type IN ('table','virtual') ORDER BY name"
    );
    const names = tables.map(t => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "person", "person_fts", "tag", "person_tag",
        "saved_view", "import_session", "setting",
      ])
    );
  });

  it("FTS triggers index inserted persons", async () => {
    const db = makeTestDb();
    await db.execute(
      "INSERT INTO person (linkedin_url, first_name, last_name, company) VALUES (?,?,?,?)",
      ["https://www.linkedin.com/in/sarah", "Sarah", "Chen", "Stripe"]
    );
    const hits = await db.select<{ rowid: number }>(
      "SELECT rowid FROM person_fts WHERE person_fts MATCH 'Stripe'"
    );
    expect(hits.length).toBe(1);
  });
});
```

- [x] **Step 6: Run tests**

Run: `npm test`
Expected: 2 tests pass.

- [x] **Step 7: Commit**

```bash
git add vitest.config.ts tests/ package.json package-lock.json
git commit -m "test: add Vitest + RTL infra and DB schema smoke tests"
```

---

**End of Phase 1.** At this point: Tauri app launches, three-pane shell renders, SQLite migration runs, and the test harness is verified end-to-end (in-memory DB matches the production schema).

---

## Phase 2 — Import

Goal: User can pick a `Connections.csv` and import it. New persons are inserted, existing persons are updated (notes/tags preserved), and persons no longer in the file are archived. A pre-import snapshot is taken for undo.

### Task 2.1: Date format normalizer (TDD)

**Files:**
- Create: `src/csv/dateFormat.ts`, `tests/csv/dateFormat.test.ts`

- [x] **Step 1: Write failing tests**

`tests/csv/dateFormat.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseLinkedInDate } from "@/csv/dateFormat";

describe("parseLinkedInDate", () => {
  it("parses 'DD Mon YYYY' to ISO YYYY-MM-DD", () => {
    expect(parseLinkedInDate("16 Mar 2024")).toBe("2024-03-16");
    expect(parseLinkedInDate("01 Jan 2020")).toBe("2020-01-01");
    expect(parseLinkedInDate("31 Dec 2025")).toBe("2025-12-31");
  });

  it("trims whitespace", () => {
    expect(parseLinkedInDate("  04 Aug 2022  ")).toBe("2022-08-04");
  });

  it("returns null for empty or unparseable input", () => {
    expect(parseLinkedInDate("")).toBeNull();
    expect(parseLinkedInDate("not a date")).toBeNull();
    expect(parseLinkedInDate("2024-03-16")).toBeNull(); // wrong format
  });

  it("returns null for invalid month abbreviation", () => {
    expect(parseLinkedInDate("16 Foo 2024")).toBeNull();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- dateFormat`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

`src/csv/dateFormat.ts`:
```ts
const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

export function parseLinkedInDate(input: string): string | null {
  const trimmed = input.trim();
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(trimmed);
  if (!m) return null;
  const [, day, mon, year] = m;
  const monthNum = MONTHS[mon[0].toUpperCase() + mon.slice(1).toLowerCase()];
  if (!monthNum) return null;
  return `${year}-${monthNum}-${day.padStart(2, "0")}`;
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- dateFormat`
Expected: 4 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/csv/dateFormat.ts tests/csv/dateFormat.test.ts
git commit -m "feat(csv): parseLinkedInDate handles 'DD Mon YYYY' format"
```

---

### Task 2.2: CSV header detection (TDD)

LinkedIn's CSV starts with a 3-line preamble before the header row. We must locate the header row by name, not by line number.

**Files:**
- Create: `src/csv/parse.ts` (header detection helper), `tests/csv/parse.test.ts`

- [x] **Step 1: Write failing test**

`tests/csv/parse.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { findHeaderLine } from "@/csv/parse";

describe("findHeaderLine", () => {
  it("returns line index of header row in a typical LinkedIn export", () => {
    const csv =
      `"Notes:"\n` +
      `"When exporting your connection data..."\n` +
      `\n` +
      `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
      `Sarah,Chen,https://www.linkedin.com/in/sarah,,Stripe,Engineer,16 Mar 2024\n`;
    expect(findHeaderLine(csv)).toBe(3);
  });

  it("returns 0 if file has no preamble", () => {
    const csv =
      `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
      `Sarah,Chen,https://www.linkedin.com/in/sarah,,Stripe,Engineer,16 Mar 2024\n`;
    expect(findHeaderLine(csv)).toBe(0);
  });

  it("throws if no header row is found in first 10 lines", () => {
    const csv = Array(15).fill('"Notes:"').join("\n");
    expect(() => findHeaderLine(csv)).toThrow(/header row/i);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- parse`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

`src/csv/parse.ts`:
```ts
const REQUIRED_HEADERS = ["First Name", "Last Name", "URL"];

export function findHeaderLine(csv: string): number {
  const lines = csv.split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (REQUIRED_HEADERS.every(h => line.includes(h))) return i;
  }
  throw new Error(
    `No header row found in first 10 lines (looking for ${REQUIRED_HEADERS.join(", ")})`
  );
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- parse`
Expected: 3 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/csv/parse.ts tests/csv/parse.test.ts
git commit -m "feat(csv): findHeaderLine skips LinkedIn preamble"
```

---

### Task 2.3: Full CSV parsing with PapaParse (TDD)

**Files:**
- Modify: `src/csv/parse.ts`, `tests/csv/parse.test.ts`
- Modify: `package.json`

- [x] **Step 1: Install PapaParse**

Run: `npm install papaparse@^5 && npm install -D @types/papaparse@^5`

- [x] **Step 2: Add tests for parseConnectionsCsv**

Append to `tests/csv/parse.test.ts`:
```ts
import { parseConnectionsCsv } from "@/csv/parse";

describe("parseConnectionsCsv", () => {
  const goodCsv =
    `"Notes:"\n` +
    `\n` +
    `\n` +
    `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
    `Sarah,Chen,https://www.linkedin.com/in/sarah,sarah@stripe.com,Stripe,Senior Engineer,16 Mar 2024\n` +
    `John,Park,https://www.linkedin.com/in/john,,Google,PM,03 Jan 2023\n`;

  it("returns parsed rows after skipping preamble", () => {
    const result = parseConnectionsCsv(goodCsv);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toEqual({
      first_name: "Sarah",
      last_name: "Chen",
      linkedin_url: "https://www.linkedin.com/in/sarah",
      email: "sarah@stripe.com",
      company: "Stripe",
      title: "Senior Engineer",
      connected_on: "2024-03-16",
    });
    expect(result.rows[1].connected_on).toBe("2023-01-03");
    expect(result.rows[1].email).toBeNull();
  });

  it("collects warnings for rows missing URL", () => {
    const csv =
      `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
      `Sarah,Chen,,,Stripe,Engineer,16 Mar 2024\n` +
      `John,Park,https://www.linkedin.com/in/john,,Google,PM,03 Jan 2023\n`;
    const result = parseConnectionsCsv(csv);
    expect(result.rows.length).toBe(1);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/missing URL/i);
  });

  it("dedupes rows with the same URL (last wins)", () => {
    const csv =
      `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
      `Sarah,Chen,https://www.linkedin.com/in/sarah,,Stripe,Engineer,16 Mar 2024\n` +
      `Sarah,Chen,https://www.linkedin.com/in/sarah,,Notion,Staff Eng,01 Apr 2024\n`;
    const result = parseConnectionsCsv(csv);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].company).toBe("Notion");
    expect(result.warnings.some(w => /duplicate/i.test(w))).toBe(true);
  });

  it("throws when required header missing", () => {
    const csv = `First Name,Last Name,Foo\nSarah,Chen,Bar`;
    expect(() => parseConnectionsCsv(csv)).toThrow(/header row/i);
  });
});
```

- [x] **Step 3: Run to verify failure**

Run: `npm test -- parse`
Expected: New tests fail — `parseConnectionsCsv` not exported.

- [x] **Step 4: Implement**

Append to `src/csv/parse.ts`:
```ts
import Papa from "papaparse";
import { parseLinkedInDate } from "./dateFormat";

export interface ParsedRow {
  first_name: string;
  last_name: string;
  linkedin_url: string;
  email: string | null;
  company: string | null;
  title: string | null;
  connected_on: string | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  warnings: string[];
}

export function parseConnectionsCsv(csv: string): ParseResult {
  const headerLine = findHeaderLine(csv);
  const trimmedCsv = csv.split(/\r?\n/).slice(headerLine).join("\n");
  const parsed = Papa.parse<Record<string, string>>(trimmedCsv, {
    header: true,
    skipEmptyLines: true,
  });

  const warnings: string[] = [];
  const seen = new Map<string, ParsedRow>();

  for (const r of parsed.data) {
    const url = (r["URL"] || "").trim();
    if (!url) {
      warnings.push(`Skipped row with missing URL: ${JSON.stringify(r)}`);
      continue;
    }
    const row: ParsedRow = {
      first_name: (r["First Name"] || "").trim(),
      last_name: (r["Last Name"] || "").trim(),
      linkedin_url: url,
      email: (r["Email Address"] || "").trim() || null,
      company: (r["Company"] || "").trim() || null,
      title: (r["Position"] || "").trim() || null,
      connected_on: parseLinkedInDate(r["Connected On"] || ""),
    };
    if (seen.has(url)) {
      warnings.push(`Duplicate URL in CSV (last wins): ${url}`);
    }
    seen.set(url, row);
  }

  return { rows: Array.from(seen.values()), warnings };
}
```

- [x] **Step 5: Run tests to verify pass**

Run: `npm test -- parse`
Expected: All parse tests pass.

- [x] **Step 6: Commit**

```bash
git add src/csv/parse.ts tests/csv/parse.test.ts package.json package-lock.json
git commit -m "feat(csv): parseConnectionsCsv with PapaParse and dedupe"
```

---

### Task 2.4: Merge logic — upsert/archive (TDD)

**Files:**
- Create: `src/csv/merge.ts`, `tests/csv/merge.test.ts`

- [x] **Step 1: Write failing tests**

`tests/csv/merge.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";
import { mergeConnections } from "@/csv/merge";
import type { ParsedRow } from "@/csv/parse";

const sarah: ParsedRow = {
  first_name: "Sarah", last_name: "Chen",
  linkedin_url: "https://www.linkedin.com/in/sarah",
  email: null, company: "Stripe", title: "Engineer",
  connected_on: "2024-03-16",
};
const john: ParsedRow = {
  first_name: "John", last_name: "Park",
  linkedin_url: "https://www.linkedin.com/in/john",
  email: null, company: "Google", title: "PM",
  connected_on: "2023-01-03",
};

describe("mergeConnections", () => {
  it("inserts new persons on first run", async () => {
    const db = makeTestDb();
    const result = await mergeConnections(db, [sarah, john]);
    expect(result).toEqual({ added: 2, updated: 0, archived: 0 });
    const rows = await db.select<{ count: number }>("SELECT COUNT(*) AS count FROM person");
    expect(rows[0].count).toBe(2);
  });

  it("updates company/title on re-import but preserves notes", async () => {
    const db = makeTestDb();
    await mergeConnections(db, [sarah]);
    await db.execute(
      "UPDATE person SET notes_md = ? WHERE linkedin_url = ?",
      ["Met at SXSW", sarah.linkedin_url]
    );
    const updated = { ...sarah, company: "Notion", title: "Staff Engineer" };
    const result = await mergeConnections(db, [updated]);
    expect(result).toEqual({ added: 0, updated: 1, archived: 0 });
    const rows = await db.select<{ company: string; notes_md: string }>(
      "SELECT company, notes_md FROM person WHERE linkedin_url = ?",
      [sarah.linkedin_url]
    );
    expect(rows[0].company).toBe("Notion");
    expect(rows[0].notes_md).toBe("Met at SXSW");
  });

  it("archives persons no longer in CSV (preserves notes/tags)", async () => {
    const db = makeTestDb();
    await mergeConnections(db, [sarah, john]);
    await db.execute(
      "UPDATE person SET notes_md = 'keep me' WHERE linkedin_url = ?",
      [john.linkedin_url]
    );
    const result = await mergeConnections(db, [sarah]);
    expect(result).toEqual({ added: 0, updated: 0, archived: 1 });
    const rows = await db.select<{ archived: number; notes_md: string }>(
      "SELECT archived, notes_md FROM person WHERE linkedin_url = ?",
      [john.linkedin_url]
    );
    expect(rows[0].archived).toBe(1);
    expect(rows[0].notes_md).toBe("keep me");
  });

  it("re-activates an archived person if they reappear in CSV", async () => {
    const db = makeTestDb();
    await mergeConnections(db, [sarah, john]);
    await mergeConnections(db, [sarah]); // archives john
    const result = await mergeConnections(db, [sarah, john]);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    const rows = await db.select<{ archived: number }>(
      "SELECT archived FROM person WHERE linkedin_url = ?",
      [john.linkedin_url]
    );
    expect(rows[0].archived).toBe(0);
  });

  it("does not double-count: same row in CSV twice with no DB change is updated:0", async () => {
    const db = makeTestDb();
    await mergeConnections(db, [sarah]);
    const result = await mergeConnections(db, [sarah]);
    expect(result).toEqual({ added: 0, updated: 0, archived: 0 });
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- merge`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

`src/csv/merge.ts`:
```ts
import type { Db } from "@/db/client";
import type { ParsedRow } from "./parse";

export interface MergeResult {
  added: number;
  updated: number;
  archived: number;
}

export async function mergeConnections(
  db: Db,
  rows: ParsedRow[]
): Promise<MergeResult> {
  const result: MergeResult = { added: 0, updated: 0, archived: 0 };

  const incomingUrls = new Set(rows.map(r => r.linkedin_url));

  // Existing persons by URL
  const existing = await db.select<{
    id: number; linkedin_url: string;
    first_name: string; last_name: string;
    email: string | null; company: string | null;
    title: string | null; connected_on: string | null;
    archived: number;
  }>("SELECT id, linkedin_url, first_name, last_name, email, company, title, connected_on, archived FROM person");

  const byUrl = new Map(existing.map(p => [p.linkedin_url, p]));

  for (const r of rows) {
    const e = byUrl.get(r.linkedin_url);
    if (!e) {
      await db.execute(
        `INSERT INTO person (linkedin_url, first_name, last_name, email, company, title, connected_on)
         VALUES (?,?,?,?,?,?,?)`,
        [r.linkedin_url, r.first_name, r.last_name, r.email, r.company, r.title, r.connected_on]
      );
      result.added++;
    } else {
      const changed =
        e.first_name !== r.first_name ||
        e.last_name !== r.last_name ||
        (e.email ?? null) !== r.email ||
        (e.company ?? null) !== r.company ||
        (e.title ?? null) !== r.title ||
        (e.connected_on ?? null) !== r.connected_on ||
        e.archived === 1;
      if (changed) {
        await db.execute(
          `UPDATE person
           SET first_name=?, last_name=?, email=?, company=?, title=?, connected_on=?,
               archived=0, updated_at=CURRENT_TIMESTAMP
           WHERE id=?`,
          [r.first_name, r.last_name, r.email, r.company, r.title, r.connected_on, e.id]
        );
        result.updated++;
      }
    }
  }

  // Archive persons in DB but not in incoming CSV (and not already archived)
  for (const e of existing) {
    if (!incomingUrls.has(e.linkedin_url) && e.archived === 0) {
      await db.execute(
        "UPDATE person SET archived=1, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [e.id]
      );
      result.archived++;
    }
  }

  return result;
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- merge`
Expected: 5 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/csv/merge.ts tests/csv/merge.test.ts
git commit -m "feat(csv): mergeConnections with upsert/archive and notes preservation"
```

---

### Task 2.5: Tauri commands for snapshot + open data folder

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`

- [x] **Step 1: Add Rust deps for fs / path**

In `src-tauri/Cargo.toml`, add under `[dependencies]`:
```toml
chrono = "0.4"
```
(`tauri::api::path` provides app data dir resolution out of the box; no extra dep.)

- [x] **Step 2: Create src-tauri/src/commands.rs**

```rust
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn data_sqlite_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("data.sqlite"))
}

fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup = dir.join("backup");
    fs::create_dir_all(&backup).map_err(|e| e.to_string())?;
    Ok(backup)
}

#[tauri::command]
pub fn snapshot_db(app: tauri::AppHandle) -> Result<String, String> {
    let src = data_sqlite_path(&app)?;
    let dest_dir = backup_dir(&app)?;
    let ts = chrono::Utc::now().format("%Y%m%dT%H%M%S").to_string();
    let dest = dest_dir.join(format!("import-{ts}.sqlite"));
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn restore_snapshot(app: tauri::AppHandle, snapshot_path: String) -> Result<(), String> {
    let src = PathBuf::from(snapshot_path);
    let dest = data_sqlite_path(&app)?;
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_data_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(dir).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(dir).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(dir).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn prune_old_snapshots(app: tauri::AppHandle, max_age_days: u64) -> Result<u64, String> {
    let dir = backup_dir(&app)?;
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(max_age_days * 86400))
        .ok_or("time arithmetic underflow")?;
    let mut removed = 0u64;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let modified = entry.metadata().and_then(|m| m.modified()).map_err(|e| e.to_string())?;
        if modified < cutoff {
            fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
            removed += 1;
        }
    }
    Ok(removed)
}
```

- [x] **Step 3: Wire commands in main.rs**

Replace `src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

fn main() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial schema",
        sql: include_str!("../migrations/0001_initial.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:data.sqlite", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::snapshot_db,
            commands::restore_snapshot,
            commands::open_data_dir,
            commands::prune_old_snapshots,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Add `tauri-plugin-dialog = "2"` to `[dependencies]` in `src-tauri/Cargo.toml`.

- [x] **Step 4: Verify build**

Run: `npm run tauri build -- --debug` (or `npm run tauri dev` and verify no panic)
Expected: Build completes; window opens; no startup errors.

- [x] **Step 5: Commit**

```bash
git add src-tauri/
git commit -m "feat(tauri): snapshot, restore, open_data_dir, prune commands"
```

---

### Task 2.6: ImportDialog component

**Files:**
- Create: `src/components/ImportDialog.tsx`, `tests/components/ImportDialog.test.tsx`
- Modify: `package.json`

- [x] **Step 1: Install dialog plugin JS bindings**

Run: `npm install @tauri-apps/plugin-dialog@^2 @tauri-apps/api@^2`

- [x] **Step 2: Write component test (uses RTL + mocked Tauri APIs)**

`tests/components/ImportDialog.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportDialog } from "@/components/ImportDialog";
import { makeTestDb } from "../helpers/testDb";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue("/fake/snapshot.sqlite"),
}));

const SAMPLE_CSV =
  `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
  `Sarah,Chen,https://www.linkedin.com/in/sarah,,Stripe,Engineer,16 Mar 2024\n` +
  `John,Park,https://www.linkedin.com/in/john,,Google,PM,03 Jan 2023\n`;

describe("ImportDialog", () => {
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const fs = await import("@tauri-apps/plugin-fs");
    vi.mocked(dialog.open).mockResolvedValue("/fake/Connections.csv");
    vi.mocked(fs.readTextFile).mockResolvedValue(SAMPLE_CSV);
    onComplete = vi.fn();
  });

  it("imports a CSV and reports counts", async () => {
    const db = makeTestDb();
    render(<ImportDialog db={db} onComplete={onComplete} />);
    await userEvent.click(screen.getByRole("button", { name: /choose connections\.csv/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ added: 2, updated: 0, archived: 0 })
    );
  });
});
```

- [x] **Step 3: Run to verify failure**

Run: `npm test -- ImportDialog`
Expected: FAIL — component not found.

- [x] **Step 4: Implement**

`src/components/ImportDialog.tsx`:
```tsx
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import type { Db } from "@/db/client";
import { parseConnectionsCsv } from "@/csv/parse";
import { mergeConnections, type MergeResult } from "@/csv/merge";

interface Props {
  db: Db;
  onComplete: (result: MergeResult & { warnings: string[]; snapshotPath: string }) => void;
}

export function ImportDialog({ db, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setError(null);
    setBusy(true);
    try {
      const file = await open({ multiple: false, filters: [{ name: "CSV", extensions: ["csv"] }] });
      if (!file) { setBusy(false); return; }
      const path = typeof file === "string" ? file : file.path;

      const csv = await readTextFile(path);
      const parsed = parseConnectionsCsv(csv);

      const snapshotPath = await invoke<string>("snapshot_db");
      const result = await mergeConnections(db, parsed.rows);

      await db.execute(
        `INSERT INTO import_session
          (file_name, rows_total, rows_added, rows_updated, rows_archived, snapshot_path)
         VALUES (?,?,?,?,?,?)`,
        [path.split(/[\\/]/).pop() ?? path, parsed.rows.length,
         result.added, result.updated, result.archived, snapshotPath]
      );

      onComplete({ ...result, warnings: parsed.warnings, snapshotPath });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow border border-neutral-200">
      <h2 className="text-lg font-semibold mb-2">Import LinkedIn connections</h2>
      <p className="text-sm text-neutral-600 mb-4">
        On LinkedIn: Settings → Data Privacy → Get a copy → <em>Connections</em> (fast export, ~10 min).
      </p>
      <button
        onClick={handleImport}
        disabled={busy}
        className="w-full px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded disabled:opacity-50"
      >
        {busy ? "Importing…" : "Choose Connections.csv"}
      </button>
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
    </div>
  );
}
```

- [x] **Step 5: Run tests to verify pass**

Run: `npm test -- ImportDialog`
Expected: 1 test passes.

- [x] **Step 6: Install fs plugin in Rust + JS**

Add `tauri-plugin-fs = "2"` to `src-tauri/Cargo.toml` `[dependencies]`. In `main.rs`, register plugin: `.plugin(tauri_plugin_fs::init())`.

Run: `npm install @tauri-apps/plugin-fs@^2`

- [x] **Step 7: Commit**

```bash
git add src/components/ImportDialog.tsx tests/components/ImportDialog.test.tsx src-tauri/ package.json package-lock.json
git commit -m "feat(import): ImportDialog with file picker, parse, merge, snapshot, and import-session log"
```

---

### Task 2.7: Wire first-run flow in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [x] **Step 1: Add a query for person count and conditionally render ImportDialog**

Replace `src/App.tsx`:
```tsx
import { useEffect, useState, useCallback } from "react";
import { Layout } from "./components/Layout";
import { ImportDialog } from "./components/ImportDialog";
import { getDb, type Db } from "./db/client";

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [personCount, setPersonCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(async d => {
        setDb(d);
        const rows = await d.select<{ n: number }>("SELECT count(*) AS n FROM person");
        setPersonCount(rows[0].n);
      })
      .catch(e => setError(String(e)));
  }, []);

  const handleImportComplete = useCallback(async () => {
    if (!db) return;
    const rows = await db.select<{ n: number }>("SELECT count(*) AS n FROM person");
    setPersonCount(rows[0].n);
  }, [db]);

  if (error) return <div className="p-8 text-red-600">DB error: {error}</div>;
  if (!db || personCount === null) return <div className="p-8 text-neutral-500">Loading…</div>;

  if (personCount === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <ImportDialog db={db} onComplete={handleImportComplete} />
      </div>
    );
  }

  return <Layout />;
}
```

- [ ] **Step 2: Verify (in Tauri dev) — first run shows ImportDialog**

Run: `npm run tauri dev`
Expected: With an empty DB, the import dialog renders centered.

(Optional manual test: pick a real `Connections.csv`. After import, the layout should appear. Note: graph still shows the placeholder until Phase 3.)

- [x] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): show ImportDialog on first run, Layout otherwise"
```

---

**End of Phase 2.** At this point: full CSV import works end-to-end. Importing a real `Connections.csv` populates the DB; re-importing preserves notes and tags; archived persons are flagged but their data is retained; a snapshot is captured before each import; the import is logged in `import_session`.

---

## Phase 3 — Graph

Goal: Render the imported persons as a force-directed graph with `react-force-graph-2d`. Nodes laid out from synthetic edges (default: same-company links + radial backbone to "you"). Click selects a node.

### Task 3.1: Synthetic edge derivation (TDD)

**Files:**
- Create: `src/graph/synthEdges.ts`, `tests/graph/synthEdges.test.ts`

- [x] **Step 1: Write failing tests**

`tests/graph/synthEdges.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeSyntheticEdges, type GraphPerson } from "@/graph/synthEdges";

const sarah: GraphPerson = { id: 1, company: "Stripe", title: "Eng", tagIds: [10] };
const john:  GraphPerson = { id: 2, company: "Stripe", title: "PM",  tagIds: [11] };
const lisa:  GraphPerson = { id: 3, company: "Google", title: "Eng", tagIds: [10] };
const max:   GraphPerson = { id: 4, company: null,     title: "Founder", tagIds: [] };

describe("computeSyntheticEdges (rule = company)", () => {
  it("creates radial 'you' edges to every person", () => {
    const edges = computeSyntheticEdges([sarah, john, lisa, max], { rule: "company", youId: 0 });
    const radial = edges.filter(e => e.source === 0);
    expect(radial.length).toBe(4);
  });

  it("links persons sharing a non-null company", () => {
    const edges = computeSyntheticEdges([sarah, john, lisa], { rule: "company", youId: 0 });
    const cross = edges.filter(e => e.source !== 0);
    expect(cross).toContainEqual(expect.objectContaining({ source: 1, target: 2 }));
    expect(cross.find(e => (e.source === 1 && e.target === 3) || (e.source === 3 && e.target === 1))).toBeUndefined();
  });

  it("ignores persons with null company", () => {
    const edges = computeSyntheticEdges([sarah, max], { rule: "company", youId: 0 });
    const cross = edges.filter(e => e.source !== 0);
    expect(cross.length).toBe(0);
  });

  it("rule = tag links persons sharing any tag", () => {
    const edges = computeSyntheticEdges([sarah, lisa, john], { rule: "tag", youId: 0 });
    const cross = edges.filter(e => e.source !== 0);
    expect(cross).toContainEqual(expect.objectContaining({ source: 1, target: 3 })); // both have tag 10
    expect(cross.find(e => (e.source === 1 && e.target === 2))).toBeUndefined();
  });

  it("rule = radial-only produces only 'you' edges", () => {
    const edges = computeSyntheticEdges([sarah, john], { rule: "radial-only", youId: 0 });
    expect(edges.every(e => e.source === 0)).toBe(true);
  });

  it("does not produce duplicate edges", () => {
    const edges = computeSyntheticEdges([sarah, john], { rule: "company", youId: 0 });
    const ids = edges.map(e => `${e.source}-${e.target}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- synthEdges`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

`src/graph/synthEdges.ts`:
```ts
export interface GraphPerson {
  id: number;
  company: string | null;
  title: string | null;
  tagIds: number[];
}

export type EdgeRule = "company" | "tag" | "title-keyword" | "radial-only";

export interface SyntheticEdge {
  source: number;
  target: number;
}

export interface Options {
  rule: EdgeRule;
  youId: number;
}

export function computeSyntheticEdges(
  persons: GraphPerson[],
  opts: Options
): SyntheticEdge[] {
  const edges: SyntheticEdge[] = persons.map(p => ({ source: opts.youId, target: p.id }));
  if (opts.rule === "radial-only") return edges;

  const groups = new Map<string, number[]>();

  for (const p of persons) {
    const keys = keyFor(p, opts.rule);
    for (const k of keys) {
      const arr = groups.get(k);
      if (arr) arr.push(p.id);
      else groups.set(k, [p.id]);
    }
  }

  const seen = new Set<string>();
  for (const ids of groups.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = Math.min(ids[i], ids[j]);
        const b = Math.max(ids[i], ids[j]);
        const key = `${a}-${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ source: a, target: b });
      }
    }
  }

  return edges;
}

function keyFor(p: GraphPerson, rule: EdgeRule): string[] {
  switch (rule) {
    case "company":
      return p.company ? [`co:${p.company.toLowerCase()}`] : [];
    case "tag":
      return p.tagIds.map(t => `tag:${t}`);
    case "title-keyword":
      return tokenize(p.title ?? "").map(w => `kw:${w}`);
    case "radial-only":
      return [];
  }
}

const STOPWORDS = new Set(["the", "of", "and", "at", "in", "for", "to", "a", "an"]);
function tokenize(s: string): string[] {
  return s.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- synthEdges`
Expected: 6 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/graph/synthEdges.ts tests/graph/synthEdges.test.ts
git commit -m "feat(graph): computeSyntheticEdges with company/tag/title-keyword/radial rules"
```

---

### Task 3.2: Install react-force-graph-2d + state store skeleton

**Files:**
- Create: `src/state/store.ts`
- Modify: `package.json`

- [x] **Step 1: Install graph library + Zustand**

Run: `npm install react-force-graph-2d@^1 zustand@^5`

- [x] **Step 2: Create state store**

`src/state/store.ts`:
```ts
import { create } from "zustand";
import type { EdgeRule } from "@/graph/synthEdges";

export interface PersonNode {
  id: number;
  first_name: string;
  last_name: string;
  company: string | null;
  title: string | null;
  archived: boolean;
  tagIds: number[];
}

export interface GraphState {
  persons: PersonNode[];
  setPersons: (p: PersonNode[]) => void;

  selectedId: number | null;
  setSelected: (id: number | null) => void;

  edgeRule: EdgeRule;
  setEdgeRule: (r: EdgeRule) => void;

  filterMode: "fade" | "isolate";
  setFilterMode: (m: "fade" | "isolate") => void;

  search: string;
  setSearch: (s: string) => void;

  selectedCompanies: Set<string>;
  toggleCompany: (c: string) => void;

  selectedTagIds: Set<number>;
  toggleTagId: (id: number) => void;

  showArchived: boolean;
  setShowArchived: (b: boolean) => void;
}

export const useStore = create<GraphState>(set => ({
  persons: [],
  setPersons: (p) => set({ persons: p }),

  selectedId: null,
  setSelected: (id) => set({ selectedId: id }),

  edgeRule: "company",
  setEdgeRule: (r) => set({ edgeRule: r }),

  filterMode: "fade",
  setFilterMode: (m) => set({ filterMode: m }),

  search: "",
  setSearch: (s) => set({ search: s }),

  selectedCompanies: new Set<string>(),
  toggleCompany: (c) => set(s => {
    const next = new Set(s.selectedCompanies);
    next.has(c) ? next.delete(c) : next.add(c);
    return { selectedCompanies: next };
  }),

  selectedTagIds: new Set<number>(),
  toggleTagId: (id) => set(s => {
    const next = new Set(s.selectedTagIds);
    next.has(id) ? next.delete(id) : next.add(id);
    return { selectedTagIds: next };
  }),

  showArchived: false,
  setShowArchived: (b) => set({ showArchived: b }),
}));
```

- [x] **Step 3: Commit**

```bash
git add src/state/ package.json package-lock.json
git commit -m "feat(state): Zustand store for graph + filter state"
```

---

### Task 3.3: GraphCanvas with react-force-graph-2d

**Files:**
- Modify: `src/components/GraphCanvas.tsx`
- Create: `src/db/persons.ts`

- [x] **Step 1: Create db/persons.ts loader**

`src/db/persons.ts`:
```ts
import type { Db } from "./client";
import type { PersonNode } from "@/state/store";

export async function loadAllPersons(db: Db): Promise<PersonNode[]> {
  const rows = await db.select<{
    id: number; first_name: string; last_name: string;
    company: string | null; title: string | null; archived: number;
  }>(`SELECT id, first_name, last_name, company, title, archived FROM person`);

  const tagRows = await db.select<{ person_id: number; tag_id: number }>(
    `SELECT person_id, tag_id FROM person_tag`
  );
  const byPerson = new Map<number, number[]>();
  for (const t of tagRows) {
    const arr = byPerson.get(t.person_id);
    if (arr) arr.push(t.tag_id);
    else byPerson.set(t.person_id, [t.tag_id]);
  }

  return rows.map(r => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    company: r.company,
    title: r.title,
    archived: r.archived === 1,
    tagIds: byPerson.get(r.id) ?? [],
  }));
}
```

- [x] **Step 2: Replace GraphCanvas**

`src/components/GraphCanvas.tsx`:
```tsx
import { useMemo, useRef, useEffect } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useStore } from "@/state/store";
import { computeSyntheticEdges } from "@/graph/synthEdges";

const YOU_ID = 0;

export function GraphCanvas() {
  const persons = useStore(s => s.persons);
  const edgeRule = useStore(s => s.edgeRule);
  const setSelected = useStore(s => s.setSelected);
  const fgRef = useRef<ForceGraphMethods>();

  const data = useMemo(() => {
    const visible = persons.filter(p => !p.archived);
    const youNode = { id: YOU_ID, name: "You", isYou: true };
    const personNodes = visible.map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      company: p.company,
      isYou: false,
    }));
    const edges = computeSyntheticEdges(
      visible.map(p => ({ id: p.id, company: p.company, title: p.title, tagIds: p.tagIds })),
      { rule: edgeRule, youId: YOU_ID }
    );
    return { nodes: [youNode, ...personNodes], links: edges };
  }, [persons, edgeRule]);

  useEffect(() => {
    fgRef.current?.zoomToFit(400, 60);
  }, [data]);

  return (
    <main className="bg-neutral-50 relative overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeRelSize={5}
        backgroundColor="#fafafa"
        linkColor={() => "rgba(100,116,139,0.4)"}
        linkWidth={0.8}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const r = node.isYou ? 8 : 5;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fillStyle = node.isYou ? "#fbbf24" : "#cbd5e1";
          ctx.fill();
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
        }}
        onNodeClick={(node) => {
          if (typeof node.id === "number" && node.id !== YOU_ID) setSelected(node.id);
        }}
        cooldownTicks={120}
      />
    </main>
  );
}
```

- [x] **Step 3: Update App.tsx to load persons into store after import**

Replace `src/App.tsx`:
```tsx
import { useEffect, useState, useCallback } from "react";
import { Layout } from "./components/Layout";
import { ImportDialog } from "./components/ImportDialog";
import { getDb, type Db } from "./db/client";
import { loadAllPersons } from "./db/persons";
import { useStore } from "./state/store";

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [personCount, setPersonCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setPersons = useStore(s => s.setPersons);

  const refresh = useCallback(async (d: Db) => {
    const persons = await loadAllPersons(d);
    setPersons(persons);
    setPersonCount(persons.filter(p => !p.archived).length);
  }, [setPersons]);

  useEffect(() => {
    getDb().then(async d => {
      setDb(d);
      await refresh(d);
    }).catch(e => setError(String(e)));
  }, [refresh]);

  if (error) return <div className="p-8 text-red-600">DB error: {error}</div>;
  if (!db || personCount === null) return <div className="p-8 text-neutral-500">Loading…</div>;

  if (personCount === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <ImportDialog db={db} onComplete={() => refresh(db)} />
      </div>
    );
  }

  return <Layout />;
}
```

- [ ] **Step 4: Verify**

Run: `npm run tauri dev`
Expected: After importing a CSV, the central pane shows a force-directed graph; clicking a node selects it (sidebar/profile still placeholder).

- [x] **Step 5: Commit**

```bash
git add src/components/GraphCanvas.tsx src/db/persons.ts src/App.tsx
git commit -m "feat(graph): render persons with react-force-graph-2d, click to select"
```

---

**End of Phase 3.** Graph renders, nodes are clickable, force layout settles, edges follow the active rule.

---

## Phase 4 — Communities & cluster styling

Goal: Color-code nodes by Louvain community, size them by combined degree+betweenness, and draw soft cluster regions under each community.

### Task 4.1: Color palette + community assignment (TDD)

**Files:**
- Create: `src/graph/colors.ts`, `tests/graph/colors.test.ts`

- [x] **Step 1: Write failing tests**

`tests/graph/colors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { COMMUNITY_PALETTE, assignColors } from "@/graph/colors";

describe("assignColors", () => {
  it("assigns palette colors to communities by descending size", () => {
    const map = assignColors([10, 10, 10, 20, 20, 30]);
    // 30 = biggest → palette[0]; 20s → palette[1]; 10s → palette[2]
    expect(map.get(30)).toBe(COMMUNITY_PALETTE[0]);
    expect(map.get(20)).toBe(COMMUNITY_PALETTE[1]);
    expect(map.get(10)).toBe(COMMUNITY_PALETTE[2]);
  });

  it("falls back to gray for communities with fewer than 3 members", () => {
    const map = assignColors([1, 1, 2, 3, 3, 3]);
    expect(map.get(1)).toBe("#cbd5e1");
    expect(map.get(2)).toBe("#cbd5e1");
    expect(map.get(3)).toBe(COMMUNITY_PALETTE[0]);
  });

  it("wraps around when community count exceeds palette", () => {
    const ids = Array(20).fill(0).map((_, i) => i);
    const sized = ids.flatMap(i => Array(5).fill(i)); // 5 members each, all big
    const map = assignColors(sized);
    expect(map.size).toBe(20);
    expect(map.get(0)).toBeDefined();
    expect(map.get(19)).toBeDefined();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- colors`
Expected: FAIL.

- [x] **Step 3: Implement**

`src/graph/colors.ts`:
```ts
export const COMMUNITY_PALETTE = [
  "#a78bfa", "#34d399", "#fb923c", "#60a5fa",
  "#f472b6", "#fbbf24", "#22d3ee", "#a3e635",
  "#f87171", "#c084fc", "#2dd4bf", "#fdba74",
];
const FALLBACK_GRAY = "#cbd5e1";
const MIN_SIZE = 3;

export function assignColors(communityIds: number[]): Map<number, string> {
  const sizes = new Map<number, number>();
  for (const id of communityIds) sizes.set(id, (sizes.get(id) ?? 0) + 1);

  const sorted = [...sizes.entries()].sort((a, b) => b[1] - a[1]);
  const map = new Map<number, string>();
  let paletteIdx = 0;
  for (const [id, size] of sorted) {
    if (size < MIN_SIZE) {
      map.set(id, FALLBACK_GRAY);
    } else {
      map.set(id, COMMUNITY_PALETTE[paletteIdx % COMMUNITY_PALETTE.length]);
      paletteIdx++;
    }
  }
  return map;
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- colors`
Expected: 3 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/graph/colors.ts tests/graph/colors.test.ts
git commit -m "feat(graph): community color palette + size-based assignment"
```

---

### Task 4.2: Louvain community detection wrapper (TDD)

**Files:**
- Create: `src/graph/community.ts`, `tests/graph/community.test.ts`
- Modify: `package.json`

- [x] **Step 1: Install graphology**

Run: `npm install graphology@^0.25 graphology-communities-louvain@^2`

- [x] **Step 2: Write failing tests**

`tests/graph/community.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectCommunities } from "@/graph/community";

describe("detectCommunities", () => {
  it("identifies two communities in a barbell-style graph", () => {
    const nodes = [1, 2, 3, 4, 5, 6];
    const edges = [
      { source: 1, target: 2 }, { source: 2, target: 3 }, { source: 1, target: 3 }, // clique A
      { source: 4, target: 5 }, { source: 5, target: 6 }, { source: 4, target: 6 }, // clique B
      { source: 3, target: 4 }, // weak bridge
    ];
    const communities = detectCommunities(nodes, edges);
    expect(communities.get(1)).toBe(communities.get(2));
    expect(communities.get(2)).toBe(communities.get(3));
    expect(communities.get(4)).toBe(communities.get(5));
    expect(communities.get(5)).toBe(communities.get(6));
    expect(communities.get(1)).not.toBe(communities.get(4));
  });

  it("returns single community for fully connected graph", () => {
    const nodes = [1, 2, 3];
    const edges = [
      { source: 1, target: 2 }, { source: 2, target: 3 }, { source: 1, target: 3 },
    ];
    const communities = detectCommunities(nodes, edges);
    const ids = new Set(communities.values());
    expect(ids.size).toBe(1);
  });

  it("each isolated node ends up in its own community", () => {
    const communities = detectCommunities([1, 2, 3], []);
    const ids = new Set(communities.values());
    expect(ids.size).toBe(3);
  });
});
```

- [x] **Step 3: Run to verify failure**

Run: `npm test -- community`
Expected: FAIL.

- [x] **Step 4: Implement**

`src/graph/community.ts`:
```ts
import Graph from "graphology";
import louvain from "graphology-communities-louvain";

interface Edge { source: number; target: number; }

export function detectCommunities(
  nodeIds: number[],
  edges: Edge[]
): Map<number, number> {
  const g = new Graph({ type: "undirected", multi: false, allowSelfLoops: false });
  for (const id of nodeIds) g.addNode(String(id));
  for (const e of edges) {
    if (e.source === e.target) continue;
    if (!g.hasEdge(String(e.source), String(e.target))) {
      g.addEdge(String(e.source), String(e.target));
    }
  }
  const result = louvain(g);
  const map = new Map<number, number>();
  for (const [k, v] of Object.entries(result)) map.set(Number(k), v as number);
  return map;
}
```

- [x] **Step 5: Run tests to verify pass**

Run: `npm test -- community`
Expected: 3 tests pass.

- [x] **Step 6: Commit**

```bash
git add src/graph/community.ts tests/graph/community.test.ts package.json package-lock.json
git commit -m "feat(graph): Louvain community detection via graphology"
```

---

### Task 4.3: Centrality scoring (TDD)

**Files:**
- Create: `src/graph/centrality.ts`, `tests/graph/centrality.test.ts`

- [x] **Step 1: Write failing test**

`tests/graph/centrality.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeCentrality } from "@/graph/centrality";

describe("computeCentrality", () => {
  it("returns scores in 0..1 range", () => {
    const scores = computeCentrality(
      [1, 2, 3, 4],
      [
        { source: 1, target: 2 }, { source: 2, target: 3 },
        { source: 3, target: 4 }, { source: 1, target: 3 },
      ]
    );
    for (const v of scores.values()) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("hub node has highest score in a star graph", () => {
    const scores = computeCentrality(
      [1, 2, 3, 4, 5],
      [
        { source: 1, target: 2 }, { source: 1, target: 3 },
        { source: 1, target: 4 }, { source: 1, target: 5 },
      ]
    );
    expect(scores.get(1)).toBeGreaterThan(scores.get(2)!);
    expect(scores.get(1)).toBeGreaterThan(scores.get(5)!);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- centrality`
Expected: FAIL.

- [x] **Step 3: Implement**

`src/graph/centrality.ts`:
```ts
interface Edge { source: number; target: number; }

export function computeCentrality(
  nodeIds: number[],
  edges: Edge[]
): Map<number, number> {
  const adj = new Map<number, Set<number>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const degree = new Map<number, number>();
  let maxDeg = 0;
  for (const [id, neighbors] of adj) {
    const d = neighbors.size;
    degree.set(id, d);
    if (d > maxDeg) maxDeg = d;
  }

  const scores = new Map<number, number>();
  for (const id of nodeIds) {
    const d = degree.get(id) ?? 0;
    scores.set(id, maxDeg === 0 ? 0 : d / maxDeg);
  }
  return scores;
}
```

(v1 uses normalized degree; full betweenness deferred to v1.1 — `graphology-metrics` can drop in later.)

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- centrality`
Expected: 2 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/graph/centrality.ts tests/graph/centrality.test.ts
git commit -m "feat(graph): degree-based centrality scoring"
```

---

### Task 4.4: Wire community + centrality into GraphCanvas rendering

**Files:**
- Modify: `src/components/GraphCanvas.tsx`

- [x] **Step 1: Update GraphCanvas to color by community and size by centrality**

Replace `src/components/GraphCanvas.tsx`:
```tsx
import { useMemo, useRef, useEffect } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useStore } from "@/state/store";
import { computeSyntheticEdges } from "@/graph/synthEdges";
import { detectCommunities } from "@/graph/community";
import { computeCentrality } from "@/graph/centrality";
import { assignColors } from "@/graph/colors";

const YOU_ID = 0;

interface NodeDatum {
  id: number;
  name: string;
  isYou: boolean;
  color: string;
  size: number;
}

export function GraphCanvas() {
  const persons = useStore(s => s.persons);
  const edgeRule = useStore(s => s.edgeRule);
  const setSelected = useStore(s => s.setSelected);
  const fgRef = useRef<ForceGraphMethods>();

  const data = useMemo(() => {
    const visible = persons.filter(p => !p.archived);
    const ids = [YOU_ID, ...visible.map(p => p.id)];

    const edges = computeSyntheticEdges(
      visible.map(p => ({ id: p.id, company: p.company, title: p.title, tagIds: p.tagIds })),
      { rule: edgeRule, youId: YOU_ID }
    );

    const communities = detectCommunities(ids, edges);
    const colorMap = assignColors([...communities.values()]);
    const centrality = computeCentrality(ids, edges);

    const nodes: NodeDatum[] = ids.map(id => {
      if (id === YOU_ID) {
        return { id, name: "You", isYou: true, color: "#fbbf24", size: 10 };
      }
      const p = visible.find(pp => pp.id === id)!;
      const cId = communities.get(id) ?? -1;
      const color = colorMap.get(cId) ?? "#cbd5e1";
      const c = centrality.get(id) ?? 0;
      return {
        id,
        name: `${p.first_name} ${p.last_name}`,
        isYou: false,
        color,
        size: 4 + c * 6,
      };
    });

    return { nodes, links: edges };
  }, [persons, edgeRule]);

  useEffect(() => {
    fgRef.current?.zoomToFit(400, 60);
  }, [data]);

  return (
    <main className="bg-neutral-50 relative overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        backgroundColor="#fafafa"
        linkColor={() => "rgba(100,116,139,0.4)"}
        linkWidth={0.8}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const r = node.size;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fillStyle = node.color;
          ctx.fill();
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
        }}
        nodeLabel={(node: any) => node.name}
        onNodeClick={(node: any) => {
          if (typeof node.id === "number" && node.id !== YOU_ID) setSelected(node.id);
        }}
        cooldownTicks={150}
      />
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run tauri dev`
Expected: Nodes are color-coded by community (multiple distinct hues), bigger nodes for hubs, gold "you" node in the middle.

- [x] **Step 3: Commit**

```bash
git add src/components/GraphCanvas.tsx
git commit -m "feat(graph): color nodes by Louvain community, size by centrality"
```

---

### Task 4.5: Soft cluster regions (convex hulls)

**Files:**
- Create: `src/graph/clusterRegions.ts`, `tests/graph/clusterRegions.test.ts`
- Modify: `src/components/GraphCanvas.tsx`

- [x] **Step 1: Write failing test for convex hull**

`tests/graph/clusterRegions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { convexHull } from "@/graph/clusterRegions";

describe("convexHull", () => {
  it("returns the four corners for a square of points (with one interior)", () => {
    const pts = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
      { x: 5, y: 5 },
    ];
    const hull = convexHull(pts);
    expect(hull.length).toBe(4);
    for (const corner of [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]) {
      expect(hull).toContainEqual(corner);
    }
  });

  it("handles collinear points by returning extremes", () => {
    const hull = convexHull([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
    expect(hull.length).toBeLessThanOrEqual(3);
  });

  it("returns input unchanged for fewer than 3 points", () => {
    expect(convexHull([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
    expect(convexHull([{ x: 0, y: 0 }, { x: 1, y: 1 }]).length).toBe(2);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- clusterRegions`
Expected: FAIL.

- [x] **Step 3: Implement convex hull (Andrew's monotone chain)**

`src/graph/clusterRegions.ts`:
```ts
export interface Point { x: number; y: number; }

export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function expandHull(hull: Point[], padding: number): Point[] {
  if (hull.length === 0) return hull;
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / d) * padding, y: p.y + (dy / d) * padding };
  });
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- clusterRegions`
Expected: 3 tests pass.

- [x] **Step 5: Add cluster-region painting to GraphCanvas**

In `src/components/GraphCanvas.tsx`, add an `onRenderFramePre` callback to paint hulls under nodes. Replace the `<ForceGraph2D ... />` element with this version (keep the rest of the file the same):

```tsx
<ForceGraph2D
  ref={fgRef}
  graphData={data}
  backgroundColor="#fafafa"
  linkColor={() => "rgba(100,116,139,0.4)"}
  linkWidth={0.8}
  onRenderFramePre={(ctx) => {
    // group node positions by community color
    const groups = new Map<string, { x: number; y: number }[]>();
    for (const n of (data.nodes as any[])) {
      if (n.isYou || n.color === "#cbd5e1") continue;
      if (typeof n.x !== "number" || typeof n.y !== "number") continue;
      const arr = groups.get(n.color);
      if (arr) arr.push({ x: n.x, y: n.y });
      else groups.set(n.color, [{ x: n.x, y: n.y }]);
    }
    for (const [color, pts] of groups) {
      if (pts.length < 3) continue;
      const hull = expandHull(convexHull(pts), 14);
      ctx.beginPath();
      ctx.moveTo(hull[0].x, hull[0].y);
      for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
      ctx.closePath();
      ctx.fillStyle = color + "26"; // 15% alpha
      ctx.fill();
    }
  }}
  nodeCanvasObject={(node: any, ctx, globalScale) => {
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, node.size, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();
  }}
  nodeLabel={(node: any) => node.name}
  onNodeClick={(node: any) => {
    if (typeof node.id === "number" && node.id !== YOU_ID) setSelected(node.id);
  }}
  cooldownTicks={150}
/>
```

Add the import at the top: `import { convexHull, expandHull } from "@/graph/clusterRegions";`

- [ ] **Step 6: Verify**

Run: `npm run tauri dev`
Expected: Soft colored regions visible behind groups of same-color nodes.

- [x] **Step 7: Commit**

```bash
git add src/graph/clusterRegions.ts tests/graph/clusterRegions.test.ts src/components/GraphCanvas.tsx
git commit -m "feat(graph): soft cluster regions via convex hulls"
```

---

**End of Phase 4.** Graph is visually polished — communities color-coded, hubs sized larger, soft cluster blobs visible.

---

## Phase 5 — Filters & sidebar

Goal: Sidebar search, company filter chips, tag filter chips, saved views. Filter state drives a derived `visibleSet`; the graph renders matched nodes at full opacity and others at 15% (fade mode) or hides them (isolate mode).

### Task 5.1: Selectors for filtered persons (TDD)

**Files:**
- Create: `src/state/selectors.ts`, `tests/state/selectors.test.ts`

- [x] **Step 1: Write failing tests**

`tests/state/selectors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { matchesFilter } from "@/state/selectors";
import type { PersonNode } from "@/state/store";

const sarah: PersonNode = { id: 1, first_name: "Sarah", last_name: "Chen", company: "Stripe", title: "Engineer", archived: false, tagIds: [10] };
const john:  PersonNode = { id: 2, first_name: "John",  last_name: "Park", company: "Google", title: "PM",       archived: false, tagIds: [11] };
const lisa:  PersonNode = { id: 3, first_name: "Lisa",  last_name: "Wu",   company: "Stripe", title: "Designer", archived: false, tagIds: []   };
const old:   PersonNode = { id: 4, first_name: "Old",   last_name: "Pal",  company: "Yahoo!", title: "VP",       archived: true,  tagIds: []   };

describe("matchesFilter", () => {
  it("empty filter shows non-archived", () => {
    expect(matchesFilter(sarah, { search: "", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(old,   { search: "", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(false);
  });

  it("showArchived = true includes archived", () => {
    expect(matchesFilter(old, { search: "", companies: new Set(), tagIds: new Set(), showArchived: true })).toBe(true);
  });

  it("company filter intersects (any-of)", () => {
    expect(matchesFilter(sarah, { search: "", companies: new Set(["Stripe"]), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(john,  { search: "", companies: new Set(["Stripe"]), tagIds: new Set(), showArchived: false })).toBe(false);
    expect(matchesFilter(lisa,  { search: "", companies: new Set(["Stripe", "Google"]), tagIds: new Set(), showArchived: false })).toBe(true);
  });

  it("tag filter intersects (any-of)", () => {
    expect(matchesFilter(sarah, { search: "", companies: new Set(), tagIds: new Set([10]), showArchived: false })).toBe(true);
    expect(matchesFilter(john,  { search: "", companies: new Set(), tagIds: new Set([10]), showArchived: false })).toBe(false);
  });

  it("search matches across name / company / title (case-insensitive substring)", () => {
    expect(matchesFilter(sarah, { search: "stripe", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(sarah, { search: "saraH",  companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(lisa,  { search: "design", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(john,  { search: "design", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(false);
  });

  it("search ignores 'note:' prefix (FTS handled elsewhere)", () => {
    expect(matchesFilter(sarah, { search: "note: anything", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- selectors`
Expected: FAIL.

- [x] **Step 3: Implement**

`src/state/selectors.ts`:
```ts
import type { PersonNode } from "./store";

export interface FilterState {
  search: string;
  companies: Set<string>;
  tagIds: Set<number>;
  showArchived: boolean;
}

export function matchesFilter(p: PersonNode, f: FilterState): boolean {
  if (p.archived && !f.showArchived) return false;

  if (f.companies.size > 0) {
    if (!p.company || !f.companies.has(p.company)) return false;
  }

  if (f.tagIds.size > 0) {
    if (!p.tagIds.some(id => f.tagIds.has(id))) return false;
  }

  const search = f.search.trim();
  if (search && !search.toLowerCase().startsWith("note:")) {
    const needle = search.toLowerCase();
    const hay = [p.first_name, p.last_name, p.company ?? "", p.title ?? ""].join(" ").toLowerCase();
    if (!hay.includes(needle)) return false;
  }

  return true;
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- selectors`
Expected: All tests pass.

- [x] **Step 5: Commit**

```bash
git add src/state/selectors.ts tests/state/selectors.test.ts
git commit -m "feat(state): matchesFilter selector for company/tag/search/archived"
```

---

### Task 5.2: Sidebar — search + companies + show-archived toggle

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [x] **Step 1: Replace Sidebar.tsx with full implementation**

```tsx
import { useMemo } from "react";
import { useStore } from "@/state/store";
import { matchesFilter } from "@/state/selectors";

export function Sidebar() {
  const persons = useStore(s => s.persons);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const selectedCompanies = useStore(s => s.selectedCompanies);
  const toggleCompany = useStore(s => s.toggleCompany);
  const showArchived = useStore(s => s.showArchived);
  const setShowArchived = useStore(s => s.setShowArchived);

  const visible = useMemo(
    () => persons.filter(p => matchesFilter(p, {
      search,
      companies: selectedCompanies,
      tagIds: useStore.getState().selectedTagIds,
      showArchived,
    })),
    [persons, search, selectedCompanies, showArchived]
  );

  const companyCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of visible) {
      if (!p.company) continue;
      m.set(p.company, (m.get(p.company) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [visible]);

  return (
    <aside className="bg-white p-3 overflow-y-auto flex flex-col gap-5">
      <div>
        <div className="text-xs font-bold text-neutral-400 mb-1.5">SEARCH</div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find someone… (note: prefix searches notes)"
          className="w-full px-2 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      </div>

      <div>
        <div className="text-xs font-bold text-neutral-400 mb-1.5">COMPANIES</div>
        <ul className="text-sm space-y-0.5">
          {companyCounts.slice(0, 12).map(([co, n]) => {
            const active = selectedCompanies.has(co);
            return (
              <li key={co}>
                <button
                  onClick={() => toggleCompany(co)}
                  className={`w-full flex items-center gap-2 px-1.5 py-0.5 rounded text-left ${active ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"}`}
                >
                  <span className="w-2 h-2 rounded-full bg-neutral-300" />
                  <span className="flex-1 truncate">{co}</span>
                  <span className="text-xs text-neutral-400 tabular-nums">{n}</span>
                </button>
              </li>
            );
          })}
          {companyCounts.length === 0 && (
            <li className="text-xs italic text-neutral-400 px-1">No companies in current view</li>
          )}
        </ul>
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived ({persons.filter(p => p.archived).length})
        </label>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify in dev**

Run: `npm run tauri dev`
Expected: Sidebar shows working search input and a sorted list of companies with counts. Clicking a company highlights it.

- [x] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(sidebar): search input, companies list with filter toggle, show-archived"
```

---

### Task 5.3: Apply filters to GraphCanvas (fade vs isolate)

**Files:**
- Modify: `src/components/GraphCanvas.tsx`

- [x] **Step 1: Replace GraphCanvas.tsx — add filter-aware visible set + opacity dimming**

```tsx
import { useMemo, useRef, useEffect } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useStore } from "@/state/store";
import { matchesFilter } from "@/state/selectors";
import { computeSyntheticEdges } from "@/graph/synthEdges";
import { detectCommunities } from "@/graph/community";
import { computeCentrality } from "@/graph/centrality";
import { assignColors } from "@/graph/colors";
import { convexHull, expandHull } from "@/graph/clusterRegions";

const YOU_ID = 0;

export function GraphCanvas() {
  const persons = useStore(s => s.persons);
  const edgeRule = useStore(s => s.edgeRule);
  const filterMode = useStore(s => s.filterMode);
  const setSelected = useStore(s => s.setSelected);
  const search = useStore(s => s.search);
  const selectedCompanies = useStore(s => s.selectedCompanies);
  const selectedTagIds = useStore(s => s.selectedTagIds);
  const showArchived = useStore(s => s.showArchived);
  const fgRef = useRef<ForceGraphMethods>();

  const data = useMemo(() => {
    const filterState = { search, companies: selectedCompanies, tagIds: selectedTagIds, showArchived };

    const inScope = persons.filter(p => showArchived || !p.archived);
    const matched = new Set(inScope.filter(p => matchesFilter(p, filterState)).map(p => p.id));
    const visible = filterMode === "isolate"
      ? inScope.filter(p => matched.has(p.id))
      : inScope;

    const ids = [YOU_ID, ...visible.map(p => p.id)];
    const edges = computeSyntheticEdges(
      visible.map(p => ({ id: p.id, company: p.company, title: p.title, tagIds: p.tagIds })),
      { rule: edgeRule, youId: YOU_ID }
    );
    const communities = detectCommunities(ids, edges);
    const colorMap = assignColors([...communities.values()]);
    const centrality = computeCentrality(ids, edges);

    const nodes = ids.map(id => {
      if (id === YOU_ID) {
        return { id, name: "You", isYou: true, color: "#fbbf24", size: 10, dim: false };
      }
      const p = visible.find(pp => pp.id === id)!;
      const cId = communities.get(id) ?? -1;
      const color = colorMap.get(cId) ?? "#cbd5e1";
      const c = centrality.get(id) ?? 0;
      const dim = filterMode === "fade" && !matched.has(id);
      return { id, name: `${p.first_name} ${p.last_name}`, isYou: false, color, size: 4 + c * 6, dim };
    });

    return { nodes, links: edges };
  }, [persons, edgeRule, filterMode, search, selectedCompanies, selectedTagIds, showArchived]);

  useEffect(() => { fgRef.current?.zoomToFit(400, 60); }, [persons.length]);

  return (
    <main className="bg-neutral-50 relative overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        backgroundColor="#fafafa"
        linkColor={() => "rgba(100,116,139,0.4)"}
        linkWidth={0.8}
        onRenderFramePre={(ctx) => {
          const groups = new Map<string, { x: number; y: number }[]>();
          for (const n of (data.nodes as any[])) {
            if (n.isYou || n.color === "#cbd5e1") continue;
            if (typeof n.x !== "number" || typeof n.y !== "number") continue;
            const arr = groups.get(n.color);
            if (arr) arr.push({ x: n.x, y: n.y });
            else groups.set(n.color, [{ x: n.x, y: n.y }]);
          }
          for (const [color, pts] of groups) {
            if (pts.length < 3) continue;
            const hull = expandHull(convexHull(pts), 14);
            ctx.beginPath();
            ctx.moveTo(hull[0].x, hull[0].y);
            for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
            ctx.closePath();
            ctx.fillStyle = color + "26";
            ctx.fill();
          }
        }}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          ctx.save();
          ctx.globalAlpha = node.dim ? 0.15 : 1;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, node.size, 0, 2 * Math.PI);
          ctx.fillStyle = node.color;
          ctx.fill();
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
          ctx.restore();
        }}
        nodeLabel={(node: any) => node.name}
        onNodeClick={(node: any) => {
          if (typeof node.id === "number" && node.id !== YOU_ID) setSelected(node.id);
        }}
        cooldownTicks={150}
      />
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run tauri dev`
Expected: After import, typing in the search box dims non-matching nodes. Clicking a company chip dims everyone outside that company.

- [x] **Step 3: Commit**

```bash
git add src/components/GraphCanvas.tsx
git commit -m "feat(graph): filter-aware rendering with fade vs isolate modes"
```

---

### Task 5.4: Tags — DB CRUD + sidebar chips

**Files:**
- Create: `src/db/tags.ts`, `tests/db/tags.test.ts`
- Modify: `src/components/Sidebar.tsx`, `src/state/store.ts`, `src/App.tsx`

- [x] **Step 1: Write failing tests for tag CRUD**

`tests/db/tags.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";
import { createTag, listTags, attachTag, detachTag, listTagsForPerson, deleteTag } from "@/db/tags";

async function seedPerson(db: any) {
  const r = await db.execute(
    "INSERT INTO person (linkedin_url, first_name, last_name) VALUES (?,?,?)",
    ["u1", "Sarah", "Chen"]
  );
  return r.lastInsertId as number;
}

describe("tags db", () => {
  it("creates and lists tags", async () => {
    const db = makeTestDb();
    const id = await createTag(db, "advisor", "#dbeafe");
    const all = await listTags(db);
    expect(all).toEqual([{ id, name: "advisor", color: "#dbeafe" }]);
  });

  it("attach + listTagsForPerson + detach", async () => {
    const db = makeTestDb();
    const pid = await seedPerson(db);
    const tagId = await createTag(db, "infra", "#fef3c7");
    await attachTag(db, pid, tagId);
    expect(await listTagsForPerson(db, pid)).toEqual([{ id: tagId, name: "infra", color: "#fef3c7" }]);
    await detachTag(db, pid, tagId);
    expect(await listTagsForPerson(db, pid)).toEqual([]);
  });

  it("deleteTag cascades to person_tag", async () => {
    const db = makeTestDb();
    const pid = await seedPerson(db);
    const tagId = await createTag(db, "infra", "#fef3c7");
    await attachTag(db, pid, tagId);
    await deleteTag(db, tagId);
    expect(await listTagsForPerson(db, pid)).toEqual([]);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- "db/tags"`
Expected: FAIL.

- [x] **Step 3: Implement**

`src/db/tags.ts`:
```ts
import type { Db } from "./client";

export interface Tag { id: number; name: string; color: string; }

export async function createTag(db: Db, name: string, color: string): Promise<number> {
  const r = await db.execute("INSERT INTO tag (name, color) VALUES (?,?)", [name, color]);
  return r.lastInsertId!;
}

export async function listTags(db: Db): Promise<Tag[]> {
  return db.select<Tag>("SELECT id, name, color FROM tag ORDER BY name");
}

export async function attachTag(db: Db, personId: number, tagId: number): Promise<void> {
  await db.execute(
    "INSERT OR IGNORE INTO person_tag (person_id, tag_id) VALUES (?,?)",
    [personId, tagId]
  );
}

export async function detachTag(db: Db, personId: number, tagId: number): Promise<void> {
  await db.execute(
    "DELETE FROM person_tag WHERE person_id = ? AND tag_id = ?",
    [personId, tagId]
  );
}

export async function listTagsForPerson(db: Db, personId: number): Promise<Tag[]> {
  return db.select<Tag>(
    `SELECT t.id, t.name, t.color
     FROM tag t JOIN person_tag pt ON pt.tag_id = t.id
     WHERE pt.person_id = ? ORDER BY t.name`,
    [personId]
  );
}

export async function deleteTag(db: Db, id: number): Promise<void> {
  await db.execute("DELETE FROM tag WHERE id = ?", [id]);
}

export async function renameTag(db: Db, id: number, name: string): Promise<void> {
  await db.execute("UPDATE tag SET name = ? WHERE id = ?", [name, id]);
}

export async function recolorTag(db: Db, id: number, color: string): Promise<void> {
  await db.execute("UPDATE tag SET color = ? WHERE id = ?", [color, id]);
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- "db/tags"`
Expected: 3 tests pass.

- [x] **Step 5: Add tags slice to store + load tags on startup**

In `src/state/store.ts`, add to the GraphState interface and store body:
```ts
// in interface GraphState:
tags: { id: number; name: string; color: string }[];
setTags: (t: { id: number; name: string; color: string }[]) => void;

// in create<GraphState>(set => ({ ... :
tags: [],
setTags: (t) => set({ tags: t }),
```

In `src/App.tsx`, in `refresh()`, load tags too:
```ts
const refresh = useCallback(async (d: Db) => {
  const persons = await loadAllPersons(d);
  setPersons(persons);
  setPersonCount(persons.filter(p => !p.archived).length);
  const tags = await import("./db/tags").then(m => m.listTags(d));
  useStore.getState().setTags(tags);
}, [setPersons]);
```

- [x] **Step 6: Add Tags section to Sidebar**

In `src/components/Sidebar.tsx`, add this block above the "Show archived" checkbox:

```tsx
{(() => {
  const tags = useStore(s => s.tags);
  const selectedTagIds = useStore(s => s.selectedTagIds);
  const toggleTagId = useStore(s => s.toggleTagId);
  return (
    <div>
      <div className="text-xs font-bold text-neutral-400 mb-1.5">TAGS</div>
      {tags.length === 0 ? (
        <div className="text-xs italic text-neutral-400">Add tags from a person's profile.</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => {
            const active = selectedTagIds.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTagId(t.id)}
                className={`px-2 py-0.5 text-xs rounded-full border ${active ? "ring-2 ring-neutral-700" : ""}`}
                style={{ backgroundColor: t.color, borderColor: t.color }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
})()}
```

(Inline IIFE keeps this file as a single component — could also be extracted to `TagFilterChips.tsx` later.)

- [ ] **Step 7: Verify**

Run: `npm run tauri dev`
Expected: Tags section shows "Add tags from a person's profile." (no tags yet — they'll be addable from Phase 6).

- [x] **Step 8: Commit**

```bash
git add src/db/tags.ts tests/db/tags.test.ts src/state/store.ts src/components/Sidebar.tsx src/App.tsx
git commit -m "feat(tags): db CRUD, sidebar chips with toggle filter"
```

---

### Task 5.5: Saved views — DB CRUD + sidebar list

**Files:**
- Create: `src/db/savedViews.ts`, `tests/db/savedViews.test.ts`
- Modify: `src/components/Sidebar.tsx`, `src/state/store.ts`, `src/App.tsx`

- [x] **Step 1: Tests**

`tests/db/savedViews.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";
import { createSavedView, listSavedViews, deleteSavedView } from "@/db/savedViews";

describe("savedViews db", () => {
  it("creates and lists saved views", async () => {
    const db = makeTestDb();
    const filter = { search: "stripe", companies: ["Stripe"], tagIds: [] };
    const id = await createSavedView(db, "Q2 reach-outs", filter);
    const all = await listSavedViews(db);
    expect(all.length).toBe(1);
    expect(all[0].name).toBe("Q2 reach-outs");
    expect(all[0].filter).toEqual(filter);
  });

  it("deletes a saved view", async () => {
    const db = makeTestDb();
    const id = await createSavedView(db, "x", {});
    await deleteSavedView(db, id);
    expect((await listSavedViews(db)).length).toBe(0);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- "db/savedViews"`
Expected: FAIL.

- [x] **Step 3: Implement**

`src/db/savedViews.ts`:
```ts
import type { Db } from "./client";

export interface SavedView<F = Record<string, unknown>> {
  id: number;
  name: string;
  filter: F;
}

export async function createSavedView(db: Db, name: string, filter: unknown): Promise<number> {
  const r = await db.execute(
    "INSERT INTO saved_view (name, filter_json) VALUES (?,?)",
    [name, JSON.stringify(filter)]
  );
  return r.lastInsertId!;
}

export async function listSavedViews<F = Record<string, unknown>>(db: Db): Promise<SavedView<F>[]> {
  const rows = await db.select<{ id: number; name: string; filter_json: string }>(
    "SELECT id, name, filter_json FROM saved_view ORDER BY created_at DESC"
  );
  return rows.map(r => ({ id: r.id, name: r.name, filter: JSON.parse(r.filter_json) as F }));
}

export async function deleteSavedView(db: Db, id: number): Promise<void> {
  await db.execute("DELETE FROM saved_view WHERE id = ?", [id]);
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- "db/savedViews"`
Expected: 2 tests pass.

- [x] **Step 5: Add savedViews slice to store and load**

In `src/state/store.ts`, add to interface + body:
```ts
savedViews: { id: number; name: string; filter: any }[];
setSavedViews: (v: { id: number; name: string; filter: any }[]) => void;

// in body:
savedViews: [],
setSavedViews: (v) => set({ savedViews: v }),
```

Also expose `applyFilter` to load a view:
```ts
applyFilter: (f: { search?: string; companies?: string[]; tagIds?: number[] }) => void;

// in body:
applyFilter: (f) => set({
  search: f.search ?? "",
  selectedCompanies: new Set(f.companies ?? []),
  selectedTagIds: new Set(f.tagIds ?? []),
}),
```

- [x] **Step 6: Wire load in App.tsx refresh**

Add to `refresh()` after tags:
```ts
const views = await import("./db/savedViews").then(m => m.listSavedViews(d));
useStore.getState().setSavedViews(views);
```

- [x] **Step 7: Add Saved Views block to Sidebar**

In Sidebar.tsx, append (above the "Show archived" checkbox):

```tsx
{(() => {
  const views = useStore(s => s.savedViews);
  const setSavedViews = useStore(s => s.setSavedViews);
  const applyFilter = useStore(s => s.applyFilter);
  const search = useStore(s => s.search);
  const selectedCompanies = useStore(s => s.selectedCompanies);
  const selectedTagIds = useStore(s => s.selectedTagIds);

  async function saveCurrent() {
    const name = prompt("Name this view:");
    if (!name) return;
    const { getDb } = await import("@/db/client");
    const { createSavedView, listSavedViews } = await import("@/db/savedViews");
    const db = await getDb();
    await createSavedView(db, name, {
      search,
      companies: [...selectedCompanies],
      tagIds: [...selectedTagIds],
    });
    setSavedViews(await listSavedViews(db));
  }

  async function removeView(id: number) {
    const { getDb } = await import("@/db/client");
    const { deleteSavedView, listSavedViews } = await import("@/db/savedViews");
    const db = await getDb();
    await deleteSavedView(db, id);
    setSavedViews(await listSavedViews(db));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-bold text-neutral-400">SAVED VIEWS</div>
        <button onClick={saveCurrent} className="text-xs text-neutral-500 hover:text-neutral-900">+ save</button>
      </div>
      {views.length === 0 ? (
        <div className="text-xs italic text-neutral-400">Save the current filter for quick access.</div>
      ) : (
        <ul className="text-sm space-y-0.5">
          {views.map(v => (
            <li key={v.id} className="flex items-center group">
              <button
                onClick={() => applyFilter(v.filter as any)}
                className="flex-1 text-left px-1.5 py-0.5 rounded hover:bg-neutral-50 truncate"
              >★ {v.name}</button>
              <button
                onClick={() => removeView(v.id)}
                className="text-xs text-neutral-300 hover:text-red-500 px-1 opacity-0 group-hover:opacity-100"
                aria-label={`Delete ${v.name}`}
              >✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
})()}
```

- [ ] **Step 8: Verify**

Run: `npm run tauri dev`
Expected: After setting a filter, clicking "+ save" prompts for a name; the view appears in the list and clicking it re-applies the filter.

- [x] **Step 9: Commit**

```bash
git add src/db/savedViews.ts tests/db/savedViews.test.ts src/state/store.ts src/components/Sidebar.tsx src/App.tsx
git commit -m "feat(saved-views): db CRUD + sidebar list with save/load/delete"
```

---

**End of Phase 5.** Filters work end-to-end: type in the search box, click company chips, toggle tag chips, save filter combos as views.

---

## Phase 6 — Profile panel (notes, tags, neighbors)

Goal: When a person is selected, the right panel shows their full profile, an editable notes box (markdown, autosave, FTS-indexed), an interactive tag combobox, and a list of graph-neighbors.

### Task 6.1: ProfilePanel header + person loader

**Files:**
- Create: `src/db/personDetail.ts`
- Modify: `src/components/ProfilePanel.tsx`

- [x] **Step 1: Create personDetail loader**

`src/db/personDetail.ts`:
```ts
import type { Db } from "./client";

export interface PersonDetail {
  id: number;
  linkedin_url: string;
  first_name: string;
  last_name: string;
  email: string | null;
  company: string | null;
  title: string | null;
  connected_on: string | null;
  notes_md: string;
  archived: number;
}

export async function loadPersonDetail(db: Db, id: number): Promise<PersonDetail | null> {
  const rows = await db.select<PersonDetail>(
    `SELECT id, linkedin_url, first_name, last_name, email, company, title,
            connected_on, notes_md, archived
     FROM person WHERE id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateNotes(db: Db, id: number, notes_md: string): Promise<void> {
  await db.execute(
    "UPDATE person SET notes_md = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [notes_md, id]
  );
}
```

- [x] **Step 2: Replace ProfilePanel.tsx (header + empty state)**

```tsx
import { useEffect, useState } from "react";
import { useStore } from "@/state/store";
import { getDb } from "@/db/client";
import { loadPersonDetail, type PersonDetail } from "@/db/personDetail";

export function ProfilePanel() {
  const selectedId = useStore(s => s.selectedId);
  const [detail, setDetail] = useState<PersonDetail | null>(null);

  useEffect(() => {
    if (selectedId === null) { setDetail(null); return; }
    let cancelled = false;
    (async () => {
      const db = await getDb();
      const d = await loadPersonDetail(db, selectedId);
      if (!cancelled) setDetail(d);
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  if (!detail) {
    return (
      <aside className="bg-white p-4 overflow-y-auto text-sm text-neutral-500">
        <div className="text-center italic text-neutral-400 mt-12">
          Click a node to see details
        </div>
      </aside>
    );
  }

  const initials = `${detail.first_name[0] ?? ""}${detail.last_name[0] ?? ""}`.toUpperCase();
  const fullName = `${detail.first_name} ${detail.last_name}`.trim();
  const subtitle = [detail.title, detail.company].filter(Boolean).join(" @ ");

  return (
    <aside className="bg-white overflow-y-auto text-sm">
      <div className="p-4 border-b border-neutral-200">
        <div className="w-16 h-16 mx-auto rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 text-xl font-medium">
          {initials || "?"}
        </div>
        <div className="text-center mt-2 font-semibold text-neutral-900">{fullName}</div>
        {subtitle && <div className="text-center text-xs text-neutral-500 mt-0.5">{subtitle}</div>}
        {detail.connected_on && (
          <div className="text-center text-xs text-neutral-400 mt-0.5">
            Connected: {detail.connected_on}
          </div>
        )}
        <a
          href={detail.linkedin_url}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs text-blue-600 mt-2 hover:underline"
        >↗ Open on LinkedIn</a>
        {detail.archived === 1 && (
          <div className="text-center text-xs text-amber-700 bg-amber-50 mt-2 py-1 rounded">
            Archived (no longer in latest CSV)
          </div>
        )}
      </div>
      <div className="p-4 text-xs text-neutral-400 italic">
        (Tags + notes coming next.)
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run tauri dev`
Expected: After import + click on a node, the right panel shows the person's name, title @ company, connection date, and "Open on LinkedIn" link.

- [x] **Step 4: Commit**

```bash
git add src/db/personDetail.ts src/components/ProfilePanel.tsx
git commit -m "feat(profile): person detail loader + header"
```

---

### Task 6.2: TagCombobox — add/remove tags on a person

**Files:**
- Create: `src/components/TagCombobox.tsx`, `tests/components/TagCombobox.test.tsx`
- Modify: `src/components/ProfilePanel.tsx`

- [x] **Step 1: Write failing test**

`tests/components/TagCombobox.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagCombobox } from "@/components/TagCombobox";
import type { Tag } from "@/db/tags";

describe("TagCombobox", () => {
  const allTags: Tag[] = [
    { id: 1, name: "infra",    color: "#fef3c7" },
    { id: 2, name: "advisor",  color: "#dbeafe" },
    { id: 3, name: "to-meet",  color: "#dcfce7" },
  ];

  it("renders existing tags as removable chips", () => {
    const onRemove = vi.fn();
    render(
      <TagCombobox personTags={[allTags[0]]} allTags={allTags} onAdd={vi.fn()} onCreate={vi.fn()} onRemove={onRemove} />
    );
    expect(screen.getByText("infra")).toBeInTheDocument();
  });

  it("shows autocomplete suggestions after typing, excluding already-attached tags", async () => {
    const user = userEvent.setup();
    render(
      <TagCombobox personTags={[allTags[0]]} allTags={allTags} onAdd={vi.fn()} onCreate={vi.fn()} onRemove={vi.fn()} />
    );
    await user.click(screen.getByPlaceholderText(/add tag/i));
    await user.keyboard("a");
    expect(screen.getByText("advisor")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "infra" })).not.toBeInTheDocument();
  });

  it("calls onAdd for an existing tag selection", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <TagCombobox personTags={[]} allTags={allTags} onAdd={onAdd} onCreate={vi.fn()} onRemove={vi.fn()} />
    );
    await user.click(screen.getByPlaceholderText(/add tag/i));
    await user.keyboard("inf");
    await user.click(screen.getByText("infra"));
    expect(onAdd).toHaveBeenCalledWith(allTags[0]);
  });

  it("calls onCreate with new name + random palette color when no match exists", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(
      <TagCombobox personTags={[]} allTags={allTags} onAdd={vi.fn()} onCreate={onCreate} onRemove={vi.fn()} />
    );
    await user.click(screen.getByPlaceholderText(/add tag/i));
    await user.keyboard("brand-new{Enter}");
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toBe("brand-new");
    expect(onCreate.mock.calls[0][1]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npm test -- TagCombobox`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

`src/components/TagCombobox.tsx`:
```tsx
import { useState, useMemo } from "react";
import type { Tag } from "@/db/tags";

const PALETTE = [
  "#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3",
  "#e0e7ff", "#fee2e2", "#cffafe", "#ecfccb",
];

interface Props {
  personTags: Tag[];
  allTags: Tag[];
  onAdd: (tag: Tag) => void;
  onCreate: (name: string, color: string) => void;
  onRemove: (tag: Tag) => void;
}

export function TagCombobox({ personTags, allTags, onAdd, onCreate, onRemove }: Props) {
  const [input, setInput] = useState("");
  const attachedIds = new Set(personTags.map(t => t.id));

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return allTags.filter(t => !attachedIds.has(t.id) && t.name.toLowerCase().includes(q));
  }, [input, allTags, attachedIds]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = input.trim();
      if (!q) return;
      const exact = allTags.find(t => t.name.toLowerCase() === q.toLowerCase());
      if (exact && !attachedIds.has(exact.id)) {
        onAdd(exact);
      } else if (!exact) {
        const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        onCreate(q, color);
      }
      setInput("");
    }
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {personTags.map(t => (
        <span
          key={t.id}
          className="px-2 py-0.5 text-xs rounded-full inline-flex items-center gap-1"
          style={{ backgroundColor: t.color }}
        >
          {t.name}
          <button
            onClick={() => onRemove(t)}
            className="text-neutral-500 hover:text-neutral-900"
            aria-label={`Remove ${t.name}`}
          >✕</button>
        </span>
      ))}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="+ add tag"
          className="px-2 py-0.5 text-xs border border-neutral-200 rounded-full focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 left-0 bg-white border border-neutral-200 rounded shadow text-xs min-w-[140px]" role="listbox">
            {suggestions.map(t => (
              <li key={t.id}>
                <button
                  onClick={() => { onAdd(t); setInput(""); }}
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                >{t.name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- TagCombobox`
Expected: 4 tests pass.

- [x] **Step 5: Wire TagCombobox into ProfilePanel**

Replace the "Tags + notes coming next" placeholder in `src/components/ProfilePanel.tsx` with:

```tsx
{/* TAGS */}
{(() => {
  const [personTags, setPersonTags] = useState<{ id: number; name: string; color: string }[]>([]);
  const allTags = useStore(s => s.tags);
  const setStoreTags = useStore(s => s.setTags);

  useEffect(() => {
    if (selectedId === null) { setPersonTags([]); return; }
    (async () => {
      const db = await getDb();
      const { listTagsForPerson } = await import("@/db/tags");
      setPersonTags(await listTagsForPerson(db, selectedId));
    })();
  }, [selectedId, allTags.length]);

  async function refresh() {
    const db = await getDb();
    const { listTagsForPerson, listTags } = await import("@/db/tags");
    setPersonTags(await listTagsForPerson(db, selectedId!));
    setStoreTags(await listTags(db));
    // also refresh main persons list so sidebar/graph see updated tagIds
    const { loadAllPersons } = await import("@/db/persons");
    useStore.getState().setPersons(await loadAllPersons(db));
  }

  return (
    <div className="p-4 border-b border-neutral-200">
      <div className="text-xs font-bold text-neutral-400 mb-1.5">TAGS</div>
      <TagCombobox
        personTags={personTags}
        allTags={allTags}
        onAdd={async (t) => {
          const db = await getDb();
          const { attachTag } = await import("@/db/tags");
          await attachTag(db, selectedId!, t.id);
          refresh();
        }}
        onCreate={async (name, color) => {
          const db = await getDb();
          const { createTag, attachTag } = await import("@/db/tags");
          const newId = await createTag(db, name, color);
          await attachTag(db, selectedId!, newId);
          refresh();
        }}
        onRemove={async (t) => {
          const db = await getDb();
          const { detachTag } = await import("@/db/tags");
          await detachTag(db, selectedId!, t.id);
          refresh();
        }}
      />
    </div>
  );
})()}
```

Add the missing imports at the top of ProfilePanel.tsx:
```tsx
import { TagCombobox } from "./TagCombobox";
```

- [ ] **Step 6: Verify**

Run: `npm run tauri dev`
Expected: Click a person; the Tags row shows current tags as chips; typing a name in the combobox + Enter creates a new tag; the chip appears with a pastel color; the sidebar's TAGS section also picks it up.

- [x] **Step 7: Commit**

```bash
git add src/components/TagCombobox.tsx tests/components/TagCombobox.test.tsx src/components/ProfilePanel.tsx
git commit -m "feat(profile): TagCombobox attached to person, creates new tags on Enter"
```

---

### Task 6.3: NotesEditor with autosave

**Files:**
- Create: `src/components/NotesEditor.tsx`, `src/lib/debounce.ts`
- Modify: `src/components/ProfilePanel.tsx`, `package.json`

- [x] **Step 1: Install editor**

Run: `npm install @uiw/react-md-editor@^4`

- [x] **Step 2: Create debounce utility**

`src/lib/debounce.ts`:
```ts
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void | Promise<void>,
  ms: number
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { fn(...args); }, ms);
  };
}
```

- [x] **Step 3: Create NotesEditor component**

`src/components/NotesEditor.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { debounce } from "@/lib/debounce";

interface Props {
  personId: number;
  initial: string;
  onSave: (notes: string) => Promise<void>;
}

export function NotesEditor({ personId, initial, onSave }: Props) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Reset when person changes
  useEffect(() => {
    setValue(initial);
    setSavedAt(null);
  }, [personId, initial]);

  const debouncedSaveRef = useRef(
    debounce(async (notes: string) => {
      setSaving(true);
      try {
        await onSave(notes);
        setSavedAt(new Date());
      } finally {
        setSaving(false);
      }
    }, 500)
  );

  function handleChange(next: string | undefined) {
    const v = next ?? "";
    setValue(v);
    debouncedSaveRef.current(v);
  }

  return (
    <div data-color-mode="light">
      <MDEditor
        value={value}
        onChange={handleChange}
        height={220}
        preview="edit"
        textareaProps={{ placeholder: "Add notes about this person…" }}
      />
      <div className="mt-1 text-xs text-neutral-400">
        {saving ? "Saving…" : savedAt ? `✓ Saved ${formatRelative(savedAt)}` : "Not yet saved"}
      </div>
    </div>
  );
}

function formatRelative(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return d.toLocaleTimeString();
}
```

- [x] **Step 4: Wire into ProfilePanel**

In ProfilePanel.tsx, append below the TAGS block:

```tsx
{/* NOTES */}
<div className="p-4">
  <div className="text-xs font-bold text-neutral-400 mb-1.5">NOTES</div>
  <NotesEditor
    personId={detail.id}
    initial={detail.notes_md}
    onSave={async (notes) => {
      const db = await getDb();
      const { updateNotes } = await import("@/db/personDetail");
      await updateNotes(db, detail.id, notes);
    }}
  />
</div>
```

Add import: `import { NotesEditor } from "./NotesEditor";`

- [ ] **Step 5: Verify**

Run: `npm run tauri dev`
Expected: Click a person, type in the notes editor; after ~500ms idle, "✓ Saved just now" appears. Close and reopen the app — notes persist.

- [x] **Step 6: Commit**

```bash
git add src/components/NotesEditor.tsx src/lib/debounce.ts src/components/ProfilePanel.tsx package.json package-lock.json
git commit -m "feat(profile): markdown notes editor with 500ms debounced autosave"
```

---

### Task 6.4: FTS5 notes search via 'note:' prefix

**Files:**
- Create: `src/search/notes.ts`, `tests/search/notes.test.ts`
- Modify: `src/components/Sidebar.tsx`, `src/state/store.ts`

- [ ] **Step 1: Write failing test**

`tests/search/notes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";
import { searchNotes } from "@/search/notes";

describe("searchNotes (FTS5)", () => {
  it("finds persons whose notes contain a term", async () => {
    const db = makeTestDb();
    await db.execute(
      "INSERT INTO person (linkedin_url, first_name, last_name, notes_md) VALUES (?,?,?,?)",
      ["u1", "Sarah", "Chen", "Met at SXSW; loves infra"]
    );
    await db.execute(
      "INSERT INTO person (linkedin_url, first_name, last_name, notes_md) VALUES (?,?,?,?)",
      ["u2", "John", "Park", "Wants intro to a designer"]
    );
    expect(await searchNotes(db, "SXSW")).toEqual([1]);
    expect(await searchNotes(db, "designer")).toEqual([2]);
    expect(await searchNotes(db, "missing")).toEqual([]);
  });

  it("returns empty array on empty query", async () => {
    const db = makeTestDb();
    expect(await searchNotes(db, "")).toEqual([]);
    expect(await searchNotes(db, "   ")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- "search/notes"`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/search/notes.ts`:
```ts
import type { Db } from "@/db/client";

export async function searchNotes(db: Db, query: string): Promise<number[]> {
  const q = query.trim();
  if (!q) return [];
  // Use prefix-matching FTS5 syntax; sanitize quotes
  const safe = q.replace(/"/g, "");
  const rows = await db.select<{ rowid: number }>(
    "SELECT rowid FROM person_fts WHERE person_fts MATCH ?",
    [safe + "*"]
  );
  return rows.map(r => r.rowid);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- "search/notes"`
Expected: 2 tests pass.

- [ ] **Step 5: Wire search prefix in Sidebar**

In Sidebar.tsx, add a `noteMatchIds` Set state that fires when the search starts with `note:`:

Modify the `visible` memo block to consider FTS results:
```tsx
const [noteMatchIds, setNoteMatchIds] = useState<Set<number> | null>(null);

useEffect(() => {
  if (!search.trim().toLowerCase().startsWith("note:")) {
    setNoteMatchIds(null);
    return;
  }
  const q = search.trim().slice(5).trim();
  if (!q) { setNoteMatchIds(new Set()); return; }
  let cancelled = false;
  (async () => {
    const { getDb } = await import("@/db/client");
    const { searchNotes } = await import("@/search/notes");
    const ids = await searchNotes(await getDb(), q);
    if (!cancelled) setNoteMatchIds(new Set(ids));
  })();
  return () => { cancelled = true; };
}, [search]);

const visible = useMemo(
  () => persons.filter(p => {
    if (noteMatchIds !== null) {
      if (!noteMatchIds.has(p.id)) return false;
    }
    return matchesFilter(p, {
      search,
      companies: selectedCompanies,
      tagIds: useStore.getState().selectedTagIds,
      showArchived,
    });
  }),
  [persons, search, selectedCompanies, showArchived, noteMatchIds]
);
```

Add `useState`/`useEffect` to the imports at the top: `import { useEffect, useMemo, useState } from "react";`

Also export `noteMatchIds` to the store so the GraphCanvas can use the same set. Add to `src/state/store.ts`:
```ts
noteMatchIds: Set<number> | null;
setNoteMatchIds: (s: Set<number> | null) => void;

// in body:
noteMatchIds: null,
setNoteMatchIds: (s) => set({ noteMatchIds: s }),
```

In Sidebar.tsx replace the local `setNoteMatchIds` with `useStore(s => s.setNoteMatchIds)` and `useStore(s => s.noteMatchIds)`.

In GraphCanvas.tsx, in the useMemo, also intersect with `noteMatchIds`:
```tsx
const noteMatchIds = useStore(s => s.noteMatchIds);
// inside useMemo, when computing matched:
const matched = new Set(
  inScope
    .filter(p => matchesFilter(p, filterState))
    .filter(p => noteMatchIds === null || noteMatchIds.has(p.id))
    .map(p => p.id)
);
```
Add `noteMatchIds` to the useMemo deps.

- [ ] **Step 6: Verify**

Run: `npm run tauri dev`
Expected: Add a note containing "SXSW" to a person, then type `note: SXSW` in the search box — only that person stays unfaded.

- [ ] **Step 7: Commit**

```bash
git add src/search/notes.ts tests/search/notes.test.ts src/components/Sidebar.tsx src/components/GraphCanvas.tsx src/state/store.ts
git commit -m "feat(search): 'note:' prefix triggers FTS5 search across notes"
```

---

### Task 6.5: Neighbors-in-graph list in ProfilePanel

**Files:**
- Modify: `src/components/ProfilePanel.tsx`

- [ ] **Step 1: Compute neighbors via current edge rule**

Add this block to ProfilePanel.tsx, after the NOTES block:

```tsx
{/* NEIGHBORS */}
{(() => {
  const persons = useStore(s => s.persons);
  const edgeRule = useStore(s => s.edgeRule);
  const setSelected = useStore(s => s.setSelected);
  const me = persons.find(p => p.id === detail.id);
  if (!me) return null;

  const neighbors = persons.filter(other => {
    if (other.id === me.id || other.archived) return false;
    if (edgeRule === "company") return !!me.company && other.company === me.company;
    if (edgeRule === "tag")     return me.tagIds.some(t => other.tagIds.includes(t));
    if (edgeRule === "title-keyword") {
      const tokenize = (s: string) => s.toLowerCase().split(/\W+/).filter(w => w.length > 2);
      const myTokens = new Set(tokenize(me.title ?? ""));
      return tokenize(other.title ?? "").some(t => myTokens.has(t));
    }
    return false;
  });

  return (
    <div className="p-4 border-t border-neutral-200">
      <div className="text-xs font-bold text-neutral-400 mb-1.5">
        NEIGHBORS IN GRAPH ({edgeRule})
      </div>
      {neighbors.length === 0 ? (
        <div className="text-xs italic text-neutral-400">No neighbors under current edge rule.</div>
      ) : (
        <ul className="text-sm space-y-0.5 max-h-48 overflow-y-auto">
          {neighbors.slice(0, 30).map(n => (
            <li key={n.id}>
              <button
                onClick={() => setSelected(n.id)}
                className="w-full text-left px-1.5 py-0.5 rounded hover:bg-neutral-50 truncate"
              >
                <span className="text-neutral-900">{n.first_name} {n.last_name}</span>
                {n.company && <span className="text-neutral-400 text-xs ml-1">· {n.company}</span>}
              </button>
            </li>
          ))}
          {neighbors.length > 30 && (
            <li className="text-xs italic text-neutral-400 px-1.5">+ {neighbors.length - 30} more</li>
          )}
        </ul>
      )}
    </div>
  );
})()}
```

- [ ] **Step 2: Verify**

Run: `npm run tauri dev`
Expected: Selecting a person shows a list of others sharing the same company (or tag/keyword if you change `edgeRule` later).

- [ ] **Step 3: Commit**

```bash
git add src/components/ProfilePanel.tsx
git commit -m "feat(profile): neighbors-in-graph list keyed to current edge rule"
```

---

**End of Phase 6.** Profile panel is fully functional: header, tags with create-on-Enter, autosaved markdown notes indexed by FTS5, and a neighbors list keyed to the current edge rule.

---

## Phase 7 — Polish

Goal: Settings modal, re-import flow with undo, snapshot pruning, error/empty states, and a focusable search shortcut. After this phase, v1 hits all six success criteria from the spec.

### Task 7.1: SettingsModal scaffold

**Files:**
- Create: `src/components/SettingsModal.tsx`
- Modify: `src/components/Sidebar.tsx`, `src/state/store.ts`

- [ ] **Step 1: Add settings open/close state to store**

In `src/state/store.ts` add:
```ts
settingsOpen: boolean;
setSettingsOpen: (b: boolean) => void;
lastImportSummary: { added: number; updated: number; archived: number; snapshotPath: string } | null;
setLastImportSummary: (s: { added: number; updated: number; archived: number; snapshotPath: string } | null) => void;

// in body:
settingsOpen: false,
setSettingsOpen: (b) => set({ settingsOpen: b }),
lastImportSummary: null,
setLastImportSummary: (s) => set({ lastImportSummary: s }),
```

- [ ] **Step 2: Create SettingsModal**

`src/components/SettingsModal.tsx`:
```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/state/store";
import { getDb } from "@/db/client";
import type { EdgeRule } from "@/graph/synthEdges";

const EDGE_RULES: { value: EdgeRule; label: string }[] = [
  { value: "company", label: "Same company" },
  { value: "tag", label: "Same tag" },
  { value: "title-keyword", label: "Same title keyword" },
  { value: "radial-only", label: "Radial only (no person-to-person)" },
];

export function SettingsModal() {
  const open = useStore(s => s.settingsOpen);
  const setOpen = useStore(s => s.setSettingsOpen);
  const edgeRule = useStore(s => s.edgeRule);
  const setEdgeRule = useStore(s => s.setEdgeRule);
  const filterMode = useStore(s => s.filterMode);
  const setFilterMode = useStore(s => s.setFilterMode);
  const [lastImport, setLastImport] = useState<{ imported_at: string; file_name: string | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const db = await getDb();
      const rows = await db.select<{ imported_at: string; file_name: string | null }>(
        "SELECT imported_at, file_name FROM import_session ORDER BY imported_at DESC LIMIT 1"
      );
      setLastImport(rows[0] ?? null);
    })();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
      <div
        className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
          <div className="font-semibold">Settings</div>
          <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-900">✕</button>
        </div>

        <div className="px-5 py-4 border-b border-neutral-200">
          <div className="text-xs font-bold text-neutral-400 mb-2">DATA</div>
          <div className="text-sm text-neutral-700">
            Last imported: {lastImport ? `${lastImport.imported_at}${lastImport.file_name ? ` (${lastImport.file_name})` : ""}` : "Never"}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => invoke("open_data_dir").catch(console.error)}
              className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
            >Open data folder</button>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-neutral-200">
          <div className="text-xs font-bold text-neutral-400 mb-2">GRAPH</div>
          <label className="flex items-center justify-between text-sm py-1">
            <span>Edge rule</span>
            <select
              value={edgeRule}
              onChange={(e) => setEdgeRule(e.target.value as EdgeRule)}
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
            >
              {EDGE_RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between text-sm py-1">
            <span>Filter mode</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as "fade" | "isolate")}
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
            >
              <option value="fade">Fade non-matches</option>
              <option value="isolate">Isolate matches</option>
            </select>
          </label>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-bold text-neutral-400 mb-2">ABOUT</div>
          <div className="text-sm text-neutral-700">Network · v0.1.0</div>
          <div className="text-xs text-neutral-500 mt-1">All data stays on this machine. No network calls.</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add Settings button + Import button to sidebar footer; mount SettingsModal in Layout**

In `src/components/Sidebar.tsx`, add a footer block (above the closing `</aside>`):

```tsx
<div className="mt-auto pt-4 border-t border-neutral-100 flex gap-2">
  <button
    onClick={() => useStore.getState().setSettingsOpen(true)}
    className="flex-1 px-2 py-1.5 text-xs border border-neutral-200 rounded hover:bg-neutral-50"
  >⚙ Settings</button>
  <button
    onClick={() => useStore.getState().setReimporting(true)}
    className="flex-1 px-2 py-1.5 text-xs border border-neutral-200 rounded hover:bg-neutral-50"
  >📥 Import</button>
</div>
```

Add `reimporting: boolean; setReimporting: (b: boolean) => void;` to the store with the obvious body.

In `src/components/Layout.tsx`, add the modal:
```tsx
import { Sidebar } from "./Sidebar";
import { GraphCanvas } from "./GraphCanvas";
import { ProfilePanel } from "./ProfilePanel";
import { SettingsModal } from "./SettingsModal";

export function Layout() {
  return (
    <>
      <div className="h-full grid grid-cols-[240px_1fr_280px] divide-x divide-neutral-200 bg-neutral-50">
        <Sidebar />
        <GraphCanvas />
        <ProfilePanel />
      </div>
      <SettingsModal />
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run tauri dev`
Expected: Settings button at the bottom of sidebar opens a modal with data / graph / about sections; the edge-rule selector immediately changes the graph layout.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsModal.tsx src/components/Sidebar.tsx src/components/Layout.tsx src/state/store.ts
git commit -m "feat(settings): modal with data, graph, and about sections"
```

---

### Task 7.2: Re-import + Undo via snapshot

**Files:**
- Modify: `src/components/Layout.tsx` (mount re-import flow)
- Modify: `src/components/ImportDialog.tsx` (allow non-modal use)
- Create: `src/components/ImportToast.tsx`

- [ ] **Step 1: Create ImportToast component (shows summary + Undo)**

`src/components/ImportToast.tsx`:
```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/state/store";
import { getDb } from "@/db/client";
import { loadAllPersons } from "@/db/persons";

export function ImportToast() {
  const summary = useStore(s => s.lastImportSummary);
  const setSummary = useStore(s => s.setLastImportSummary);
  const setPersons = useStore(s => s.setPersons);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!summary) return;
    setHidden(false);
    const t = setTimeout(() => setHidden(true), 12_000);
    return () => clearTimeout(t);
  }, [summary]);

  if (!summary || hidden) return null;

  async function undo() {
    if (!summary) return;
    setBusy(true);
    try {
      await invoke("restore_snapshot", { snapshotPath: summary.snapshotPath });
      // Re-open DB connection (force reload)
      const db = await getDb();
      setPersons(await loadAllPersons(db));
      setSummary(null);
    } catch (e) {
      alert(`Undo failed: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 bg-neutral-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-40">
      <span>
        Imported · {summary.added} added · {summary.updated} updated · {summary.archived} archived
      </span>
      <button
        onClick={undo}
        disabled={busy}
        className="px-2 py-1 text-xs border border-white/30 rounded hover:bg-white/10 disabled:opacity-50"
      >{busy ? "Undoing…" : "Undo"}</button>
      <button onClick={() => setHidden(true)} aria-label="Dismiss" className="text-white/60 hover:text-white">✕</button>
    </div>
  );
}
```

- [ ] **Step 2: Wire re-import flow in Layout**

Modify `src/components/Layout.tsx`:
```tsx
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { GraphCanvas } from "./GraphCanvas";
import { ProfilePanel } from "./ProfilePanel";
import { SettingsModal } from "./SettingsModal";
import { ImportDialog } from "./ImportDialog";
import { ImportToast } from "./ImportToast";
import { useStore } from "@/state/store";
import { getDb } from "@/db/client";
import { loadAllPersons } from "@/db/persons";

export function Layout() {
  const reimporting = useStore(s => s.reimporting);
  const setReimporting = useStore(s => s.setReimporting);
  const setPersons = useStore(s => s.setPersons);
  const setLastImportSummary = useStore(s => s.setLastImportSummary);

  return (
    <>
      <div className="h-full grid grid-cols-[240px_1fr_280px] divide-x divide-neutral-200 bg-neutral-50">
        <Sidebar />
        <GraphCanvas />
        <ProfilePanel />
      </div>
      <SettingsModal />
      <ImportToast />
      {reimporting && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setReimporting(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ImportDialogWrapper
              onComplete={async (result) => {
                const db = await getDb();
                setPersons(await loadAllPersons(db));
                setLastImportSummary({
                  added: result.added,
                  updated: result.updated,
                  archived: result.archived,
                  snapshotPath: result.snapshotPath,
                });
                setReimporting(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ImportDialogWrapper({ onComplete }: { onComplete: (r: any) => void }) {
  // Lazy db wrapper so we don't need to thread Db through the tree.
  const [db, setDb] = useStateLike();
  useEffect(() => { (async () => setDb(await getDb()))(); }, []);
  if (!db) return null;
  return <ImportDialog db={db} onComplete={onComplete} />;
}

import { useState } from "react";
function useStateLike() {
  return useState<any>(null);
}
```

(Inline `useStateLike` exists only to keep the import block clean; collapse if you prefer.)

- [ ] **Step 3: Verify**

Run: `npm run tauri dev`
Expected: After initial import, click "📥 Import" in the sidebar to re-import. After import completes, a toast appears in the bottom-right with a working "Undo" button that restores the previous state.

- [ ] **Step 4: Commit**

```bash
git add src/components/ImportToast.tsx src/components/Layout.tsx
git commit -m "feat(import): re-import from sidebar + ImportToast with snapshot-based Undo"
```

---

### Task 7.3: Snapshot pruning on startup

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Invoke prune command on app startup**

In `src/App.tsx`, in the initial `useEffect`, call the prune command (fire-and-forget, no UI):
```ts
useEffect(() => {
  getDb().then(async d => {
    setDb(d);
    await refresh(d);
    // best-effort prune: keep snapshots ≤ 7 days old
    import("@tauri-apps/api/core").then(({ invoke }) =>
      invoke("prune_old_snapshots", { maxAgeDays: 7 }).catch(() => {})
    );
  }).catch(e => setError(String(e)));
}, [refresh]);
```

- [ ] **Step 2: Verify**

Run: `npm run tauri dev`
Expected: No visible change. Confirm via `Open data folder` (Settings) that `backup/` exists; older import snapshots auto-prune after 7 days.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(import): prune snapshots older than 7 days on startup"
```

---

### Task 7.4: Cmd/Ctrl+F focuses sidebar search

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add ref + keydown handler**

In Sidebar.tsx, add a ref to the search input:
```tsx
import { useEffect, useMemo, useRef, useState } from "react";

// inside Sidebar():
const searchRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const cmdOrCtrl = e.metaKey || e.ctrlKey;
    if (cmdOrCtrl && e.key.toLowerCase() === "f") {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

Bind to the input: `<input ref={searchRef} ... />`.

- [ ] **Step 2: Verify**

Run: `npm run tauri dev`
Expected: Cmd/Ctrl+F focuses the search input from anywhere in the app.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(ux): Cmd/Ctrl+F focuses sidebar search"
```

---

### Task 7.5: Friendly error states

**Files:**
- Modify: `src/components/ImportDialog.tsx`, `src/App.tsx`

- [ ] **Step 1: Show parse warnings in ImportDialog completion (already passed via onComplete — surface in the toast)**

In `src/components/ImportToast.tsx`, extend the message to mention warnings count if present. Update `lastImportSummary` type in the store to include `warnings: string[]`:

In `src/state/store.ts`:
```ts
lastImportSummary: { added: number; updated: number; archived: number; snapshotPath: string; warnings: string[] } | null;
```

In `src/components/Layout.tsx` `ImportDialogWrapper.onComplete`, add `warnings: result.warnings`.

In `src/components/ImportToast.tsx`, render warnings count:
```tsx
<span>
  Imported · {summary.added} added · {summary.updated} updated · {summary.archived} archived
  {summary.warnings.length > 0 && (
    <span className="ml-2 text-yellow-300" title={summary.warnings.join("\n")}>
      ⚠ {summary.warnings.length} warning{summary.warnings.length === 1 ? "" : "s"}
    </span>
  )}
</span>
```

- [ ] **Step 2: Wrap top-level App in an ErrorBoundary-style fallback**

In `src/App.tsx`, the existing `error` state already covers DB load failures. Add the same pattern for import:
- The import flow itself surfaces errors inside the dialog — keep that.
- The startup case where the SQLite file is corrupt: show a recovery hint:

Replace the early-return error block:
```tsx
if (error) {
  return (
    <div className="p-8 max-w-lg mx-auto text-sm">
      <div className="text-red-600 font-semibold mb-2">Database error</div>
      <div className="text-neutral-600 mb-4 break-all">{error}</div>
      <div className="text-neutral-500">
        If this keeps happening, the SQLite file may be corrupted. You can restore from a backup
        in <code>backup/</code> inside your data folder, or delete <code>data.sqlite</code> to start fresh
        (you'll lose your notes and tags — only do this as a last resort).
      </div>
      <button
        onClick={() => import("@tauri-apps/api/core").then(({ invoke }) => invoke("open_data_dir"))}
        className="mt-4 px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
      >Open data folder</button>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run tauri dev`
Expected: Normal use unaffected. (To smoke-test the error path: temporarily corrupt the DB by overwriting `data.sqlite` with garbage and relaunch — should show the recovery message. Restore from backup afterward.)

- [ ] **Step 4: Commit**

```bash
git add src/state/store.ts src/components/Layout.tsx src/components/ImportToast.tsx src/App.tsx
git commit -m "feat(ux): surface parse warnings in import toast; friendly DB error recovery hint"
```

---

### Task 7.6: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

`README.md`:
```markdown
# Network — LinkedIn Connections Graph

A personal Tauri desktop app that visualizes your LinkedIn connections as an
interactive force-directed graph. Notes, tags, and saved views persist across
re-imports. Everything stays on your machine.

## Quick start

```
npm install
npm run tauri dev
```

## Build a release binary

```
npm run tauri build
```

Output: `src-tauri/target/release/bundle/`.

## Tests

```
npm test
```

## Get your LinkedIn data

LinkedIn → Settings → Data Privacy → Get a copy of your data → "Connections"
(fast export, ~10 minutes by email).

## Where your data lives

Windows: `%APPDATA%\com.you.linkedin-network\data.sqlite`
macOS:   `~/Library/Application Support/com.you.linkedin-network/data.sqlite`
Linux:   `~/.local/share/com.you.linkedin-network/data.sqlite`

Import snapshots: `backup/import-<timestamp>.sqlite` in the same folder.
Snapshots older than 7 days auto-prune at startup.

## Design + plan docs

- Spec: [docs/superpowers/specs/2026-05-09-linkedin-graph-view-design.md](docs/superpowers/specs/2026-05-09-linkedin-graph-view-design.md)
- Plan: [docs/superpowers/plans/2026-05-09-linkedin-network-graph.md](docs/superpowers/plans/2026-05-09-linkedin-network-graph.md)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with quick start, data locations, and links to spec/plan"
```

---

**End of Phase 7.** v1 is feature-complete per the spec.

---

## Plan Self-Review

Spec coverage check (each section/requirement → which task implements it):

| Spec section | Implemented by |
|---|---|
| §3 LinkedIn data constraint (CSV-only) | 2.1, 2.2, 2.3 (parser tied strictly to LinkedIn CSV format) |
| §5 Architecture (Tauri shell, React SPA, SQLite, IPC) | 1.3, 1.4, 2.5 |
| §6 Data model (full schema + FTS5 triggers) | 1.4 (migration is verbatim from spec) |
| §6 Edges (synthetic, default same-company) | 3.1 (computeSyntheticEdges) |
| §7 CSV import & merge flow | 2.3 (parse), 2.4 (merge), 2.5 (snapshot), 2.6 (dialog) |
| §7 Undo via snapshot | 7.2 (ImportToast) |
| §7 Snapshot pruning | 7.3 |
| §8 Graph rendering pipeline | 3.3, 4.4, 4.5 |
| §8 Louvain communities | 4.2, 4.4 |
| §8 Centrality node sizing | 4.3, 4.4 |
| §8 Cluster colors + 12-palette + gray fallback | 4.1, 4.4 |
| §8 Soft cluster regions (convex hulls) | 4.5 |
| §8 Filter modes (fade vs isolate) | 5.3 |
| §8 Cluster labels | DEFERRED to v1.1 — flagged below |
| §9 Sidebar (search, companies, tags, saved views) | 5.2, 5.4, 5.5 |
| §9 Profile panel (header + tags + notes + neighbors) | 6.1, 6.2, 6.3, 6.5 |
| §9 Search semantics (fuzzy + `note:` prefix) | 5.1, 6.4 |
| §9 Settings modal | 7.1 |
| §10 First-run experience | 2.7 |
| §11 Out-of-scope items | None implemented (correct) |
| §13 Success criteria | All addressed; verification is part of phase end-states |
| §14 Phases 1-7 | Map directly to plan phases 1-7 |

**Gap: cluster labels.** The spec mentions auto-derived cluster labels (most-common company name) at the centroid, fading at high zoom. This was not built into the plan as a dedicated task — it is a small nice-to-have but is referenced in §8. Adding this is a 30-minute task; I'll document it as Task 7.7 below rather than leave it as a true gap.

### Task 7.7: Cluster labels at centroids

**Files:**
- Modify: `src/components/GraphCanvas.tsx`

- [ ] **Step 1: Compute the dominant company per community + render label**

Inside the `useMemo` block of GraphCanvas.tsx, build a `communityLabel` map keyed by color:

```tsx
const communityLabel = new Map<string, string>();
const byColor = new Map<string, { id: number; company: string | null }[]>();
for (const n of nodes as any[]) {
  if (n.isYou || n.color === "#cbd5e1") continue;
  const arr = byColor.get(n.color);
  const company = visible.find(p => p.id === n.id)?.company ?? null;
  if (arr) arr.push({ id: n.id, company });
  else byColor.set(n.color, [{ id: n.id, company }]);
}
for (const [color, members] of byColor) {
  const counts = new Map<string, number>();
  for (const m of members) {
    if (!m.company) continue;
    counts.set(m.company, (counts.get(m.company) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!dominant) continue;
  // dominant takes ≥ 60% to earn the label
  if (dominant[1] / members.length >= 0.6) communityLabel.set(color, dominant[0]);
  else communityLabel.set(color, "Mixed");
}
```

Pass `communityLabel` and `byColor` out of the memo (or include in `data` returned object) and paint inside `onRenderFramePost`:

```tsx
onRenderFramePost={(ctx, globalScale) => {
  if (globalScale > 2.5) return; // hide labels when zoomed in close
  for (const [color, members] of byColor) {
    if (members.length < 4) continue;
    const positions = (data.nodes as any[]).filter(n => n.color === color && typeof n.x === "number");
    if (positions.length === 0) continue;
    const cx = positions.reduce((s, n) => s + n.x, 0) / positions.length;
    const cy = positions.reduce((s, n) => s + n.y, 0) / positions.length;
    const label = communityLabel.get(color);
    if (!label) continue;
    ctx.font = `${12 / globalScale}px ui-sans-serif`;
    ctx.fillStyle = "rgba(55,65,81,0.8)";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cy);
  }
}}
```

(For brevity, the `byColor` and `communityLabel` are kept inside `useMemo`'s closure and exposed through the returned object.)

- [ ] **Step 2: Verify**

Run: `npm run tauri dev`
Expected: At normal zoom, cluster labels (e.g., "Stripe", "Google", "Mixed") appear over each colored region; they fade out when you zoom in close.

- [ ] **Step 3: Commit**

```bash
git add src/components/GraphCanvas.tsx
git commit -m "feat(graph): cluster labels at community centroids"
```

---

**Placeholder scan:** searched the plan for `TBD`, `TODO`, `implement later`, `Add appropriate error handling`, `Similar to Task N` — none present. The only deferred items are explicitly out-of-scope per spec §11.

**Type consistency:** `EdgeRule`, `PersonNode`, `SyntheticEdge`, `Tag`, `MergeResult`, `ParsedRow`, `Db` are defined once and used consistently across tasks. The `noteMatchIds` set name and `setNoteMatchIds` setter match between Sidebar.tsx and GraphCanvas.tsx.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-09-linkedin-network-graph.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**

