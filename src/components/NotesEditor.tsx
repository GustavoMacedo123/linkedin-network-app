import { useEffect, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { debounce } from "@/lib/debounce";

interface Props {
  personId: number;
  initial: string;
  onSave: (notes: string) => Promise<void>;
}

export function NotesEditor({ personId, initial, onSave }: Props) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setValue(initial);
    setSavedAt(null);
  }, [personId, initial]);

  const debouncedSaveRef = useRef(
    debounce(async (notes: string) => {
      setSaving(true);
      try {
        await onSave(notes);
        setSavedAt(new Date());
      } finally {
        setSaving(false);
      }
    }, 500)
  );

  function handleChange(next: string | undefined) {
    const v = next ?? "";
    setValue(v);
    debouncedSaveRef.current(v);
  }

  return (
    <div data-color-mode="light">
      <MDEditor
        value={value}
        onChange={handleChange}
        height={220}
        preview="edit"
        textareaProps={{ placeholder: "Add notes about this person…" }}
      />
      <div className="mt-1 text-xs text-neutral-400">
        {saving ? "Saving…" : savedAt ? `✓ Saved ${formatRelative(savedAt)}` : "Not yet saved"}
      </div>
    </div>
  );
}

function formatRelative(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return d.toLocaleTimeString();
}
