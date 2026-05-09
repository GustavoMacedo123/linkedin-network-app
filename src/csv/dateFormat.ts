const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

export function parseLinkedInDate(input: string): string | null {
  const trimmed = input.trim();
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(trimmed);
  if (!m) return null;
  const [, day, mon, year] = m;
  const monthNum = MONTHS[mon[0].toUpperCase() + mon.slice(1).toLowerCase()];
  if (!monthNum) return null;
  return `${year}-${monthNum}-${day.padStart(2, "0")}`;
}
