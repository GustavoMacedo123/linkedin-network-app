import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testDb";
import { createSavedView, listSavedViews, deleteSavedView } from "@/db/savedViews";

describe("savedViews db", () => {
  it("creates and lists saved views", async () => {
    const db = await makeTestDb();
    const filter = { search: "stripe", companies: ["Stripe"], tagIds: [] };
    await createSavedView(db, "Q2 reach-outs", filter);
    const all = await listSavedViews(db);
    expect(all.length).toBe(1);
    expect(all[0].name).toBe("Q2 reach-outs");
    expect(all[0].filter).toEqual(filter);
  });

  it("deletes a saved view", async () => {
    const db = await makeTestDb();
    const id = await createSavedView(db, "x", {});
    await deleteSavedView(db, id);
    expect((await listSavedViews(db)).length).toBe(0);
  });
});
