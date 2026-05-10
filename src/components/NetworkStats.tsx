import { useMemo } from "react";
import { useStore } from "@/state/store";
import { computeNetworkStats } from "@/state/selectors";

export function NetworkStats() {
  const persons = useStore(s => s.persons);
  const stats = useMemo(() => computeNetworkStats(persons), [persons]);

  if (stats.total === 0) return null;

  const parts: string[] = [];
  parts.push(`${stats.total} ${stats.total === 1 ? "connection" : "connections"}`);
  if (stats.topCompany) {
    parts.push(`Top: ${stats.topCompany.name} (${stats.topCompany.count})`);
    parts.push(`${stats.companyCount} ${stats.companyCount === 1 ? "company" : "companies"}`);
  }

  return (
    <div className="px-3 py-1.5 border-b border-neutral-200 bg-white text-xs text-neutral-600">
      {parts.join("  ·  ")}
    </div>
  );
}
