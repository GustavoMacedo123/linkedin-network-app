import type { Db } from "@/db/client";
import type { ParsedRow } from "./parse";

export interface MergeResult {
  added: number;
  updated: number;
  archived: number;
}

interface ExistingPerson {
  id: number;
  linkedin_url: string;
  first_name: string;
  last_name: string;
  email: string | null;
  company: string | null;
  title: string | null;
  connected_on: string | null;
  archived: number;
}

export async function mergeConnections(
  db: Db,
  rows: ParsedRow[]
): Promise<MergeResult> {
  const result: MergeResult = { added: 0, updated: 0, archived: 0 };

  const incomingUrls = new Set(rows.map(r => r.linkedin_url));

  const existing = await db.select<ExistingPerson>(
    "SELECT id, linkedin_url, first_name, last_name, email, company, title, connected_on, archived FROM person"
  );
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
