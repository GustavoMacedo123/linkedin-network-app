import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/state/store";
import { getDb } from "@/db/client";
import { loadPersonDetail, type PersonDetail } from "@/db/personDetail";
import {
  attachTag, createTag, detachTag, listTags, listTagsForPerson, type Tag,
} from "@/db/tags";
import { loadAllPersons } from "@/db/persons";
import { TagCombobox } from "./TagCombobox";

export function ProfilePanel() {
  const selectedId = useStore(s => s.selectedId);
  const allTags = useStore(s => s.tags);
  const setStoreTags = useStore(s => s.setTags);
  const setPersons = useStore(s => s.setPersons);
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [personTags, setPersonTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (selectedId === null) { setDetail(null); setPersonTags([]); return; }
    let cancelled = false;
    (async () => {
      const db = await getDb();
      const [d, ts] = await Promise.all([
        loadPersonDetail(db, selectedId),
        listTagsForPerson(db, selectedId),
      ]);
      if (!cancelled) {
        setDetail(d);
        setPersonTags(ts);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const refreshTags = useCallback(async () => {
    if (selectedId === null) return;
    const db = await getDb();
    const [pTags, all, persons] = await Promise.all([
      listTagsForPerson(db, selectedId),
      listTags(db),
      loadAllPersons(db),
    ]);
    setPersonTags(pTags);
    setStoreTags(all);
    setPersons(persons);
  }, [selectedId, setStoreTags, setPersons]);

  if (!detail) {
    return (
      <aside className="bg-white p-4 overflow-y-auto text-sm text-neutral-500">
        <div className="text-center italic text-neutral-400 mt-12">
          Click a node to see details
        </div>
      </aside>
    );
  }

  const initials = `${detail.first_name[0] ?? ""}${detail.last_name[0] ?? ""}`.toUpperCase();
  const fullName = `${detail.first_name} ${detail.last_name}`.trim();
  const subtitle = [detail.title, detail.company].filter(Boolean).join(" @ ");

  return (
    <aside className="bg-white overflow-y-auto text-sm">
      <div className="p-4 border-b border-neutral-200">
        <div className="w-16 h-16 mx-auto rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 text-xl font-medium">
          {initials || "?"}
        </div>
        <div className="text-center mt-2 font-semibold text-neutral-900">{fullName}</div>
        {subtitle && <div className="text-center text-xs text-neutral-500 mt-0.5">{subtitle}</div>}
        {detail.connected_on && (
          <div className="text-center text-xs text-neutral-400 mt-0.5">
            Connected: {detail.connected_on}
          </div>
        )}
        <a
          href={detail.linkedin_url}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs text-blue-600 mt-2 hover:underline"
        >↗ Open on LinkedIn</a>
        {detail.archived === 1 && (
          <div className="text-center text-xs text-amber-700 bg-amber-50 mt-2 py-1 rounded">
            Archived (no longer in latest CSV)
          </div>
        )}
      </div>

      <div className="p-4 border-b border-neutral-200">
        <div className="text-xs font-bold text-neutral-400 mb-1.5">TAGS</div>
        <TagCombobox
          personTags={personTags}
          allTags={allTags}
          onAdd={async (t) => {
            const db = await getDb();
            await attachTag(db, detail.id, t.id);
            await refreshTags();
          }}
          onCreate={async (name, color) => {
            const db = await getDb();
            const newId = await createTag(db, name, color);
            await attachTag(db, detail.id, newId);
            await refreshTags();
          }}
          onRemove={async (t) => {
            const db = await getDb();
            await detachTag(db, detail.id, t.id);
            await refreshTags();
          }}
        />
      </div>

      <div className="p-4 text-xs text-neutral-400 italic">
        (Notes coming next.)
      </div>
    </aside>
  );
}
