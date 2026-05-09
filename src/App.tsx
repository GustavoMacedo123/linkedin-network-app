import { useEffect, useState } from "react";
import { getDb } from "./db/client";

export default function App() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(db => db.select<{ n: number }>("SELECT count(*) AS n FROM person"))
      .then(rows => setCount(rows[0]?.n ?? 0))
      .catch(e => setError(String(e)));
  }, []);

  return (
    <div className="h-full flex items-center justify-center text-neutral-700">
      {error && <span className="text-red-600">DB error: {error}</span>}
      {!error && count !== null && <span>DB ready · {count} persons</span>}
      {!error && count === null && <span>Loading…</span>}
    </div>
  );
}
