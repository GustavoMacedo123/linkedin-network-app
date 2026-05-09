# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Tauri 2 desktop app that imports a LinkedIn `Connections.csv` and visualises it as an Obsidian-style force-directed graph with persistent notes/tags. Single-user, fully local, no network calls. Spec at `docs/superpowers/specs/2026-05-09-linkedin-graph-view-design.md`; phased implementation plan at `docs/superpowers/plans/2026-05-09-linkedin-network-graph.md` (the plan is the authoritative task list — pick up at the next unchecked step).

## Commands

| Task | Command |
|---|---|
| Run web frontend only (Vite) | `npm run dev` (port 1420, strict) |
| Run full desktop app | `npm run tauri dev` (invokes `npm run dev` automatically) |
| Production build | `npm run build` (tsc + vite), then `npm run tauri build` |
| Run all tests once | `npm test` |
| Watch mode | `npm run test:watch` |
| Single test file | `npx vitest run tests/path/to/file.test.ts` |
| Single test by name | `npx vitest run -t "test name pattern"` |

Rust toolchain must be installed for any `tauri` command (rustup; `winget install --id Rustlang.Rustup -e`). After installing, restart any open shells so `PATH` picks up cargo.

## Architecture

**Two layers, glued by Tauri IPC:**
- `src-tauri/` — minimal Rust shell. Only responsibilities: window management, file picker (planned), and `tauri-plugin-sql` driving SQLite. The plugin runs migrations on startup from `src-tauri/migrations/`.
- `src/` — React 18 + TS SPA running in the Tauri webview. All domain logic lives here.

**Database is the spine of everything.** SQLite (FTS5) at `%APPDATA%\com.you.linkedin-network\data.sqlite`. The schema lives in exactly one place — `src-tauri/migrations/0001_initial.sql` — and is loaded by both production (via `tauri-plugin-sql` in `src-tauri/src/lib.rs`) and tests (via `tests/helpers/testDb.ts` reading the same file into an in-memory `@sqlite.org/sqlite-wasm` instance). **Never duplicate the schema in test code; always edit the migration file.** When adding migrations, append `0002_*.sql` etc. and register them in the `migrations` vec in `lib.rs`.

**`src/db/client.ts` exports a `Db` interface** (`execute` + `select`). Production binds it to `@tauri-apps/plugin-sql`; tests bind it to sqlite-wasm via `makeTestDb()`. All db modules under `src/db/*` should consume the interface, never the Tauri import directly — that keeps them testable in jsdom.

**Synthetic edges, not real ones.** The LinkedIn CSV does not contain person-to-person connections. Every edge in the graph is *derived at query time* from shared attributes (default: same company), then Louvain detects communities for cluster colors. This is a load-bearing design choice — see Section 6 of the spec. There is intentionally no `edge` table.

**`linkedin_url` is the natural key for merge.** Re-imports must never DELETE a person — set `archived = 1` instead. Notes (`person.notes_md`) and tags (`person_tag`) must survive re-import. Snapshot the DB to `backup/import-<ts>.sqlite` before each import for undo. The merge contract is enforced in `src/csv/merge.ts` (planned) — touch it carefully.

**Module boundaries (per the plan, mostly not yet implemented):**
- `src/csv/`, `src/graph/`, `src/search/` — pure functions, no DB or React imports. Trivially unit-testable.
- `src/db/` — interface-based wrappers around the `Db`.
- `src/state/` — Zustand store; owns filter state and selected person.
- `src/components/` — React; consumes `state/` and `db/` via hooks only.

## Conventions worth knowing

- Path alias `@/*` → `src/*` (configured in `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`).
- TS is strict + `noUnusedLocals`/`noUnusedParameters`; build will fail on dead identifiers.
- Vite dev server is locked to port 1420 with `strictPort: true` because `tauri.conf.json` points `devUrl` there.
- The `@sqlite.org/sqlite-wasm` constructor in tests is noisy — `testDb.ts` silences it via the `print`/`printErr` callbacks. **Do not** pass options like `"t"` or `"ct"` to `new s.oo1.DB()`; the second arg's `t` flag enables SQL tracing that floods test output.
- `src-tauri/Cargo.toml` crate is named `app` with lib `app_lib`; `main.rs` is just `app_lib::run()`. Add Tauri commands inside `lib.rs` (or a new module imported from it).

## Working with the plan

Tasks in `docs/superpowers/plans/2026-05-09-linkedin-network-graph.md` use `- [ ]` checkboxes. Implementation is intended to flow through them sequentially via `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Phase 1 (Skeleton) is complete through Task 1.6; phase 2 (CSV import) is next.
