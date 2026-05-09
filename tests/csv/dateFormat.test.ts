import { describe, it, expect } from "vitest";
import { parseLinkedInDate } from "@/csv/dateFormat";

describe("parseLinkedInDate", () => {
  it("parses 'DD Mon YYYY' to ISO YYYY-MM-DD", () => {
    expect(parseLinkedInDate("16 Mar 2024")).toBe("2024-03-16");
    expect(parseLinkedInDate("01 Jan 2020")).toBe("2020-01-01");
    expect(parseLinkedInDate("31 Dec 2025")).toBe("2025-12-31");
  });

  it("trims whitespace", () => {
    expect(parseLinkedInDate("  04 Aug 2022  ")).toBe("2022-08-04");
  });

  it("returns null for empty or unparseable input", () => {
    expect(parseLinkedInDate("")).toBeNull();
    expect(parseLinkedInDate("not a date")).toBeNull();
    expect(parseLinkedInDate("2024-03-16")).toBeNull();
  });

  it("returns null for invalid month abbreviation", () => {
    expect(parseLinkedInDate("16 Foo 2024")).toBeNull();
  });
});
