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
