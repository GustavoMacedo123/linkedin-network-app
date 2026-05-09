import { useEffect, useState, useCallback } from "react";
import { Layout } from "./components/Layout";
import { ImportDialog } from "./components/ImportDialog";
import { getDb, type Db } from "./db/client";

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [personCount, setPersonCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(async d => {
        setDb(d);
        const rows = await d.select<{ n: number }>("SELECT count(*) AS n FROM person");
        setPersonCount(rows[0].n);
      })
      .catch(e => setError(String(e)));
  }, []);

  const handleImportComplete = useCallback(async () => {
    if (!db) return;
    const rows = await db.select<{ n: number }>("SELECT count(*) AS n FROM person");
    setPersonCount(rows[0].n);
  }, [db]);

  if (error) return <div className="p-8 text-red-600">DB error: {error}</div>;
  if (!db || personCount === null) return <div className="p-8 text-neutral-500">Loading…</div>;

  if (personCount === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <ImportDialog db={db} onComplete={handleImportComplete} />
      </div>
    );
  }

  return <Layout />;
}
