import { useEffect, useState, useCallback, useMemo } from "react";
import { useStore } from "@/state/store";
import { getDb } from "@/db/client";
import { loadPersonDetail, type PersonDetail, updateNotes } from "@/db/personDetail";
import {
  attachTag, createTag, detachTag, listTags, listTagsForPerson, type Tag,
} from "@/db/tags";
import { loadAllPersons } from "@/db/persons";
import { TagCombobox } from "./TagCombobox";
import { NotesEditor } from "./NotesEditor";

export function ProfilePanel() {
  const selectedId = useStore(s => s.selectedId);
  const allTags = useStore(s => s.tags);
  const setStoreTags = useStore(s => s.setTags);
  const persons = useStore(s => s.persons);
  const setPersons = useStore(s => s.setPersons);
  const edgeRule = useStore(s => s.edgeRule);
  const setSelected = useStore(s => s.setSelected);
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

  const neighbors = useMemo(() => {
    if (!detail) return [];
    const me = persons.find(p => p.id === detail.id);
    if (!me) return [];
    return persons.filter(other => {
      if (other.id === me.id || other.archived) return false;
      if (edgeRule === "company") return !!me.company && other.company === me.company;
      if (edgeRule === "tag")     return me.tagIds.some(t => other.tagIds.includes(t));
      if (edgeRule === "title-keyword") {
        const tokenize = (s: string) => s.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        const myTokens = new Set(tokenize(me.title ?? ""));
        return tokenize(other.title ?? "").some(t => myTokens.has(t));
      }
      return false;
    });
  }, [persons, detail, edgeRule]);

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

      <div className="p-4">
        <div className="text-xs font-bold text-neutral-400 mb-1.5">NOTES</div>
        <NotesEditor
          personId={detail.id}
          initial={detail.notes_md}
          onSave={async (notes) => {
            const db = await getDb();
            await updateNotes(db, detail.id, notes);
          }}
        />
      </div>

      <div className="p-4 border-t border-neutral-200">
        <div className="text-xs font-bold text-neutral-400 mb-1.5">
          NEIGHBORS IN GRAPH ({edgeRule})
        </div>
        {neighbors.length === 0 ? (
          <div className="text-xs italic text-neutral-400">No neighbors under current edge rule.</div>
        ) : (
          <ul className="text-sm space-y-0.5 max-h-48 overflow-y-auto">
            {neighbors.slice(0, 30).map(n => (
              <li key={n.id}>
                <button
                  onClick={() => setSelected(n.id)}
                  className="w-full text-left px-1.5 py-0.5 rounded hover:bg-neutral-50 truncate"
                >
                  <span className="text-neutral-900">{n.first_name} {n.last_name}</span>
                  {n.company && <span className="text-neutral-400 text-xs ml-1">· {n.company}</span>}
                </button>
              </li>
            ))}
            {neighbors.length > 30 && (
              <li className="text-xs italic text-neutral-400 px-1.5">+ {neighbors.length - 30} more</li>
            )}
          </ul>
        )}
      </div>
    </aside>
  );
}
