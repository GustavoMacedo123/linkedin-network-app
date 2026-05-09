import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";
import { mergeConnections } from "@/csv/merge";
import type { ParsedRow } from "@/csv/parse";

const sarah: ParsedRow = {
  first_name: "Sarah", last_name: "Chen",
  linkedin_url: "https://www.linkedin.com/in/sarah",
  email: null, company: "Stripe", title: "Engineer",
  connected_on: "2024-03-16",
};
const john: ParsedRow = {
  first_name: "John", last_name: "Park",
  linkedin_url: "https://www.linkedin.com/in/john",
  email: null, company: "Google", title: "PM",
  connected_on: "2023-01-03",
};

describe("mergeConnections", () => {
  it("inserts new persons on first run", async () => {
    const db = await makeTestDb();
    const result = await mergeConnections(db, [sarah, john]);
    expect(result).toEqual({ added: 2, updated: 0, archived: 0 });
    const rows = await db.select<{ count: number }>("SELECT COUNT(*) AS count FROM person");
    expect(rows[0].count).toBe(2);
  });

  it("updates company/title on re-import but preserves notes", async () => {
    const db = await makeTestDb();
    await mergeConnections(db, [sarah]);
    await db.execute(
      "UPDATE person SET notes_md = ? WHERE linkedin_url = ?",
      ["Met at SXSW", sarah.linkedin_url]
    );
    const updated = { ...sarah, company: "Notion", title: "Staff Engineer" };
    const result = await mergeConnections(db, [updated]);
    expect(result).toEqual({ added: 0, updated: 1, archived: 0 });
    const rows = await db.select<{ company: string; notes_md: string }>(
      "SELECT company, notes_md FROM person WHERE linkedin_url = ?",
      [sarah.linkedin_url]
    );
    expect(rows[0].company).toBe("Notion");
    expect(rows[0].notes_md).toBe("Met at SXSW");
  });

  it("archives persons no longer in CSV (preserves notes/tags)", async () => {
    const db = await makeTestDb();
    await mergeConnections(db, [sarah, john]);
    await db.execute(
      "UPDATE person SET notes_md = 'keep me' WHERE linkedin_url = ?",
      [john.linkedin_url]
    );
    const result = await mergeConnections(db, [sarah]);
    expect(result).toEqual({ added: 0, updated: 0, archived: 1 });
    const rows = await db.select<{ archived: number; notes_md: string }>(
      "SELECT archived, notes_md FROM person WHERE linkedin_url = ?",
      [john.linkedin_url]
    );
    expect(rows[0].archived).toBe(1);
    expect(rows[0].notes_md).toBe("keep me");
  });

  it("re-activates an archived person if they reappear in CSV", async () => {
    const db = await makeTestDb();
    await mergeConnections(db, [sarah, john]);
    await mergeConnections(db, [sarah]);
    const result = await mergeConnections(db, [sarah, john]);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    const rows = await db.select<{ archived: number }>(
      "SELECT archived FROM person WHERE linkedin_url = ?",
      [john.linkedin_url]
    );
    expect(rows[0].archived).toBe(0);
  });

  it("does not double-count: same row in CSV twice with no DB change is updated:0", async () => {
    const db = await makeTestDb();
    await mergeConnections(db, [sarah]);
    const result = await mergeConnections(db, [sarah]);
    expect(result).toEqual({ added: 0, updated: 0, archived: 0 });
  });
});
