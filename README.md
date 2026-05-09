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
