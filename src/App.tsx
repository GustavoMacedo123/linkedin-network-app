import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { getDb } from "./db/client";

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(db => db.select("SELECT 1"))
      .then(() => setReady(true))
      .catch(e => setError(String(e)));
  }, []);

  if (error) return <div className="p-8 text-red-600">DB error: {error}</div>;
  if (!ready) return <div className="p-8 text-neutral-500">Loading…</div>;
  return <Layout />;
}
