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
