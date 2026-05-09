import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";

describe("schema", () => {
  it("creates all tables and FTS5 virtual table", async () => {
    const db = await makeTestDb();
    const tables = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type IN ('table','virtual') ORDER BY name"
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "person",
        "person_fts",
        "tag",
        "person_tag",
        "saved_view",
        "import_session",
        "setting",
      ])
    );
  });

  it("FTS triggers index inserted persons", async () => {
    const db = await makeTestDb();
    await db.execute(
      "INSERT INTO person (linkedin_url, first_name, last_name, company) VALUES (?,?,?,?)",
      ["https://www.linkedin.com/in/sarah", "Sarah", "Chen", "Stripe"]
    );
    const hits = await db.select<{ rowid: number }>(
      "SELECT rowid FROM person_fts WHERE person_fts MATCH 'Stripe'"
    );
    expect(hits.length).toBe(1);
  });
});
