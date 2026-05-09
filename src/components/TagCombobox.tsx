import { useState, useMemo } from "react";
import type { Tag } from "@/db/tags";

const PALETTE = [
  "#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3",
  "#e0e7ff", "#fee2e2", "#cffafe", "#ecfccb",
];

interface Props {
  personTags: Tag[];
  allTags: Tag[];
  onAdd: (tag: Tag) => void;
  onCreate: (name: string, color: string) => void;
  onRemove: (tag: Tag) => void;
}

export function TagCombobox({ personTags, allTags, onAdd, onCreate, onRemove }: Props) {
  const [input, setInput] = useState("");
  const attachedIds = new Set(personTags.map(t => t.id));

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return allTags.filter(t => !attachedIds.has(t.id) && t.name.toLowerCase().includes(q));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, allTags, personTags]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = input.trim();
      if (!q) return;
      const exact = allTags.find(t => t.name.toLowerCase() === q.toLowerCase());
      if (exact && !attachedIds.has(exact.id)) {
        onAdd(exact);
      } else if (!exact) {
        const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        onCreate(q, color);
      }
      setInput("");
    }
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {personTags.map(t => (
        <span
          key={t.id}
          className="px-2 py-0.5 text-xs rounded-full inline-flex items-center gap-1"
          style={{ backgroundColor: t.color }}
        >
          {t.name}
          <button
            onClick={() => onRemove(t)}
            className="text-neutral-500 hover:text-neutral-900"
            aria-label={`Remove ${t.name}`}
          >✕</button>
        </span>
      ))}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="+ add tag"
          className="px-2 py-0.5 text-xs border border-neutral-200 rounded-full focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 left-0 bg-white border border-neutral-200 rounded shadow text-xs min-w-[140px]" role="listbox">
            {suggestions.map(t => (
              <li key={t.id}>
                <button
                  onClick={() => { onAdd(t); setInput(""); }}
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                >{t.name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
