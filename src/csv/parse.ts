import Papa from "papaparse";
import { parseLinkedInDate } from "./dateFormat";

const REQUIRED_HEADERS = ["First Name", "Last Name", "URL"];

export function findHeaderLine(csv: string): number {
  const lines = csv.split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (REQUIRED_HEADERS.every(h => line.includes(h))) return i;
  }
  throw new Error(
    `No header row found in first 10 lines (looking for ${REQUIRED_HEADERS.join(", ")})`
  );
}

export interface ParsedRow {
  first_name: string;
  last_name: string;
  linkedin_url: string;
  email: string | null;
  company: string | null;
  title: string | null;
  connected_on: string | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  warnings: string[];
}

export function parseConnectionsCsv(csv: string): ParseResult {
  const headerLine = findHeaderLine(csv);
  const trimmedCsv = csv.split(/\r?\n/).slice(headerLine).join("\n");
  const parsed = Papa.parse<Record<string, string>>(trimmedCsv, {
    header: true,
    skipEmptyLines: true,
  });

  const warnings: string[] = [];
  const seen = new Map<string, ParsedRow>();

  for (const r of parsed.data) {
    const url = (r["URL"] || "").trim();
    if (!url) {
      warnings.push(`Skipped row with missing URL: ${JSON.stringify(r)}`);
      continue;
    }
    const row: ParsedRow = {
      first_name: (r["First Name"] || "").trim(),
      last_name: (r["Last Name"] || "").trim(),
      linkedin_url: url,
      email: (r["Email Address"] || "").trim() || null,
      company: (r["Company"] || "").trim() || null,
      title: (r["Position"] || "").trim() || null,
      connected_on: parseLinkedInDate(r["Connected On"] || ""),
    };
    if (seen.has(url)) {
      warnings.push(`Duplicate URL in CSV (last wins): ${url}`);
    }
    seen.set(url, row);
  }

  return { rows: Array.from(seen.values()), warnings };
}
