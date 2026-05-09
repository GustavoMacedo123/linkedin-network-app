import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";
import type { Db } from "@/db/client";
import { createTag, listTags, attachTag, detachTag, listTagsForPerson, deleteTag } from "@/db/tags";

async function seedPerson(db: Db) {
  const r = await db.execute(
    "INSERT INTO person (linkedin_url, first_name, last_name) VALUES (?,?,?)",
    ["u1", "Sarah", "Chen"]
  );
  return r.lastInsertId as number;
}

describe("tags db", () => {
  it("creates and lists tags", async () => {
    const db = await makeTestDb();
    const id = await createTag(db, "advisor", "#dbeafe");
    const all = await listTags(db);
    expect(all).toEqual([{ id, name: "advisor", color: "#dbeafe" }]);
  });

  it("attach + listTagsForPerson + detach", async () => {
    const db = await makeTestDb();
    const pid = await seedPerson(db);
    const tagId = await createTag(db, "infra", "#fef3c7");
    await attachTag(db, pid, tagId);
    expect(await listTagsForPerson(db, pid)).toEqual([{ id: tagId, name: "infra", color: "#fef3c7" }]);
    await detachTag(db, pid, tagId);
    expect(await listTagsForPerson(db, pid)).toEqual([]);
  });

  it("deleteTag cascades to person_tag", async () => {
    const db = await makeTestDb();
    const pid = await seedPerson(db);
    const tagId = await createTag(db, "infra", "#fef3c7");
    await attachTag(db, pid, tagId);
    await deleteTag(db, tagId);
    expect(await listTagsForPerson(db, pid)).toEqual([]);
  });
});
