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
