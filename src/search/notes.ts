import type { Db } from "@/db/client";

export async function searchNotes(db: Db, query: string): Promise<number[]> {
  const q = query.trim();
  if (!q) return [];
  const safe = q.replace(/"/g, "");
  const rows = await db.select<{ rowid: number }>(
    "SELECT rowid FROM person_fts WHERE person_fts MATCH ?",
    [safe + "*"]
  );
  return rows.map(r => r.rowid);
}
