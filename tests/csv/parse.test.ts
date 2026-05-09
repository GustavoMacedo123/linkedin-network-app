import { describe, it, expect } from "vitest";
import { findHeaderLine, parseConnectionsCsv } from "@/csv/parse";

describe("findHeaderLine", () => {
  it("returns line index of header row in a typical LinkedIn export", () => {
    const csv =
      `"Notes:"\n` +
      `"When exporting your connection data..."\n` +
      `\n` +
      `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
      `Sarah,Chen,https://www.linkedin.com/in/sarah,,Stripe,Engineer,16 Mar 2024\n`;
    expect(findHeaderLine(csv)).toBe(3);
  });

  it("returns 0 if file has no preamble", () => {
    const csv =
      `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
      `Sarah,Chen,https://www.linkedin.com/in/sarah,,Stripe,Engineer,16 Mar 2024\n`;
    expect(findHeaderLine(csv)).toBe(0);
  });

  it("throws if no header row is found in first 10 lines", () => {
    const csv = Array(15).fill('"Notes:"').join("\n");
    expect(() => findHeaderLine(csv)).toThrow(/header row/i);
  });
});

describe("parseConnectionsCsv", () => {
  const goodCsv =
    `"Notes:"\n` +
    `\n` +
    `\n` +
    `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
    `Sarah,Chen,https://www.linkedin.com/in/sarah,sarah@stripe.com,Stripe,Senior Engineer,16 Mar 2024\n` +
    `John,Park,https://www.linkedin.com/in/john,,Google,PM,03 Jan 2023\n`;

  it("returns parsed rows after skipping preamble", () => {
    const result = parseConnectionsCsv(goodCsv);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toEqual({
      first_name: "Sarah",
      last_name: "Chen",
      linkedin_url: "https://www.linkedin.com/in/sarah",
      email: "sarah@stripe.com",
      company: "Stripe",
      title: "Senior Engineer",
      connected_on: "2024-03-16",
    });
    expect(result.rows[1].connected_on).toBe("2023-01-03");
    expect(result.rows[1].email).toBeNull();
  });

  it("collects warnings for rows missing URL", () => {
    const csv =
      `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
      `Sarah,Chen,,,Stripe,Engineer,16 Mar 2024\n` +
      `John,Park,https://www.linkedin.com/in/john,,Google,PM,03 Jan 2023\n`;
    const result = parseConnectionsCsv(csv);
    expect(result.rows.length).toBe(1);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/missing URL/i);
  });

  it("dedupes rows with the same URL (last wins)", () => {
    const csv =
      `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
      `Sarah,Chen,https://www.linkedin.com/in/sarah,,Stripe,Engineer,16 Mar 2024\n` +
      `Sarah,Chen,https://www.linkedin.com/in/sarah,,Notion,Staff Eng,01 Apr 2024\n`;
    const result = parseConnectionsCsv(csv);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].company).toBe("Notion");
    expect(result.warnings.some(w => /duplicate/i.test(w))).toBe(true);
  });

  it("throws when required header missing", () => {
    const csv = `First Name,Last Name,Foo\nSarah,Chen,Bar`;
    expect(() => parseConnectionsCsv(csv)).toThrow(/header row/i);
  });
});
