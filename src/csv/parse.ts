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
