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
