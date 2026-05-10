import { describe, it, expect } from "vitest";
import { computeNetworkStats } from "@/state/selectors";
import type { PersonNode } from "@/state/store";

const make = (id: number, company: string | null, archived = false): PersonNode => ({
  id, first_name: "F", last_name: "L", company, title: null, archived, tagIds: [],
});

describe("computeNetworkStats", () => {
  it("counts non-archived persons and finds top company", () => {
    const persons = [make(1, "Google"), make(2, "Google"), make(3, "Stripe")];
    expect(computeNetworkStats(persons)).toEqual({
      total: 3,
      topCompany: { name: "Google", count: 2 },
      companyCount: 2,
    });
  });

  it("excludes archived from all three stats", () => {
    const persons = [make(1, "Google"), make(2, "Stripe"), make(3, "Stripe", true)];
    expect(computeNetworkStats(persons)).toEqual({
      total: 2,
      topCompany: { name: "Google", count: 1 },
      companyCount: 2,
    });
  });

  it("returns zero stats for empty input", () => {
    expect(computeNetworkStats([])).toEqual({
      total: 0, topCompany: null, companyCount: 0,
    });
  });

  it("returns zero stats when every person is archived", () => {
    expect(computeNetworkStats([make(1, "Google", true)])).toEqual({
      total: 0, topCompany: null, companyCount: 0,
    });
  });

  it("treats null, empty, and whitespace-only company as missing", () => {
    const persons = [make(1, null), make(2, ""), make(3, "   "), make(4, "Stripe")];
    expect(computeNetworkStats(persons)).toEqual({
      total: 4,
      topCompany: { name: "Stripe", count: 1 },
      companyCount: 1,
    });
  });

  it("returns null topCompany and zero companyCount when nobody has a company set", () => {
    const persons = [make(1, null), make(2, "")];
    expect(computeNetworkStats(persons)).toEqual({
      total: 2, topCompany: null, companyCount: 0,
    });
  });

  it("groups companies case-insensitively and merges leading/trailing whitespace", () => {
    const persons = [make(1, "Google"), make(2, "google"), make(3, " GOOGLE ")];
    const stats = computeNetworkStats(persons);
    expect(stats.total).toBe(3);
    expect(stats.companyCount).toBe(1);
    expect(stats.topCompany?.count).toBe(3);
  });

  it("uses most-common original casing as the display name for the top company", () => {
    const persons = [make(1, "Google"), make(2, "Google"), make(3, "google")];
    expect(computeNetworkStats(persons).topCompany?.name).toBe("Google");
  });

  it("breaks display-casing ties by case-sensitive alphabetical first", () => {
    // Both casings appear once. ASCII: 'G' (71) < 'g' (103), so "Google" wins.
    const persons = [make(1, "Google"), make(2, "google")];
    expect(computeNetworkStats(persons).topCompany?.name).toBe("Google");
  });

  it("breaks top-company ties alphabetically (case-insensitive)", () => {
    const persons = [make(1, "Stripe"), make(2, "apple")];
    expect(computeNetworkStats(persons).topCompany).toEqual({ name: "apple", count: 1 });
  });
});
