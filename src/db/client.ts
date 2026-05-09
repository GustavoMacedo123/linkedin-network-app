import Database from "@tauri-apps/plugin-sql";

export interface Db {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

let _db: Database | null = null;

export async function getDb(): Promise<Db> {
  if (!_db) _db = await Database.load("sqlite:data.sqlite");
  const db = _db;
  return {
    async execute(sql, params = []) {
      const r = await db.execute(sql, params);
      return { rowsAffected: r.rowsAffected, lastInsertId: r.lastInsertId };
    },
    async select<T>(sql: string, params: unknown[] = []) {
      return db.select<T[]>(sql, params);
    },
  };
}
