import { describe, it, expect } from "vitest";
import { matchesFilter } from "@/state/selectors";
import type { PersonNode } from "@/state/store";

const sarah: PersonNode = { id: 1, first_name: "Sarah", last_name: "Chen", company: "Stripe", title: "Engineer", archived: false, tagIds: [10] };
const john:  PersonNode = { id: 2, first_name: "John",  last_name: "Park", company: "Google", title: "PM",       archived: false, tagIds: [11] };
const lisa:  PersonNode = { id: 3, first_name: "Lisa",  last_name: "Wu",   company: "Stripe", title: "Designer", archived: false, tagIds: []   };
const old:   PersonNode = { id: 4, first_name: "Old",   last_name: "Pal",  company: "Yahoo!", title: "VP",       archived: true,  tagIds: []   };

describe("matchesFilter", () => {
  it("empty filter shows non-archived", () => {
    expect(matchesFilter(sarah, { search: "", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(old,   { search: "", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(false);
  });

  it("showArchived = true includes archived", () => {
    expect(matchesFilter(old, { search: "", companies: new Set(), tagIds: new Set(), showArchived: true })).toBe(true);
  });

  it("company filter intersects (any-of)", () => {
    expect(matchesFilter(sarah, { search: "", companies: new Set(["Stripe"]), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(john,  { search: "", companies: new Set(["Stripe"]), tagIds: new Set(), showArchived: false })).toBe(false);
    expect(matchesFilter(lisa,  { search: "", companies: new Set(["Stripe", "Google"]), tagIds: new Set(), showArchived: false })).toBe(true);
  });

  it("tag filter intersects (any-of)", () => {
    expect(matchesFilter(sarah, { search: "", companies: new Set(), tagIds: new Set([10]), showArchived: false })).toBe(true);
    expect(matchesFilter(john,  { search: "", companies: new Set(), tagIds: new Set([10]), showArchived: false })).toBe(false);
  });

  it("search matches across name / company / title (case-insensitive substring)", () => {
    expect(matchesFilter(sarah, { search: "stripe", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(sarah, { search: "saraH",  companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(lisa,  { search: "design", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
    expect(matchesFilter(john,  { search: "design", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(false);
  });

  it("search ignores 'note:' prefix (FTS handled elsewhere)", () => {
    expect(matchesFilter(sarah, { search: "note: anything", companies: new Set(), tagIds: new Set(), showArchived: false })).toBe(true);
  });
});
