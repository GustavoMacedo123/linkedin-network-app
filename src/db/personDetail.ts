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
