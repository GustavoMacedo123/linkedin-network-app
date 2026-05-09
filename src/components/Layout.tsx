import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { GraphCanvas } from "./GraphCanvas";
import { ProfilePanel } from "./ProfilePanel";
import { SettingsModal } from "./SettingsModal";
import { ImportDialog } from "./ImportDialog";
import { ImportToast } from "./ImportToast";
import { useStore } from "@/state/store";
import { getDb, type Db } from "@/db/client";
import { loadAllPersons } from "@/db/persons";

export function Layout() {
  const reimporting = useStore(s => s.reimporting);
  const setReimporting = useStore(s => s.setReimporting);
  const setPersons = useStore(s => s.setPersons);
  const setLastImportSummary = useStore(s => s.setLastImportSummary);
  const [db, setDb] = useState<Db | null>(null);

  useEffect(() => { getDb().then(setDb); }, []);

  return (
    <>
      <div className="h-full grid grid-cols-[240px_1fr_280px] divide-x divide-neutral-200 bg-neutral-50">
        <Sidebar />
        <GraphCanvas />
        <ProfilePanel />
      </div>
      <SettingsModal />
      <ImportToast />
      {reimporting && db && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setReimporting(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ImportDialog
              db={db}
              onComplete={async (result) => {
                setPersons(await loadAllPersons(db));
                setLastImportSummary({
                  added: result.added,
                  updated: result.updated,
                  archived: result.archived,
                  snapshotPath: result.snapshotPath,
                  warnings: result.warnings,
                });
                setReimporting(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
