import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";
import { searchNotes } from "@/search/notes";

describe("searchNotes (FTS5)", () => {
  it("finds persons whose notes contain a term", async () => {
    const db = await makeTestDb();
    await db.execute(
      "INSERT INTO person (linkedin_url, first_name, last_name, notes_md) VALUES (?,?,?,?)",
      ["u1", "Sarah", "Chen", "Met at SXSW; loves infra"]
    );
    await db.execute(
      "INSERT INTO person (linkedin_url, first_name, last_name, notes_md) VALUES (?,?,?,?)",
      ["u2", "John", "Park", "Wants intro to a designer"]
    );
    expect(await searchNotes(db, "SXSW")).toEqual([1]);
    expect(await searchNotes(db, "designer")).toEqual([2]);
    expect(await searchNotes(db, "missing")).toEqual([]);
  });

  it("returns empty array on empty query", async () => {
    const db = await makeTestDb();
    expect(await searchNotes(db, "")).toEqual([]);
    expect(await searchNotes(db, "   ")).toEqual([]);
  });
});
