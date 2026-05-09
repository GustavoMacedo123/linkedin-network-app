import { describe, it, expect } from "vitest";
import { findHeaderLine } from "@/csv/parse";

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
