import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Db } from "@/db/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA = readFileSync(
  path.resolve(__dirname, "../../src-tauri/migrations/0001_initial.sql"),
  "utf-8"
);

let sqlite3: Awaited<ReturnType<typeof sqlite3InitModule>> | null = null;

async function getSqlite() {
  if (sqlite3) return sqlite3;
  sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
  // Silence the SQL TRACE output the module emits by default.
  const cfg = (sqlite3 as unknown as { config?: Record<string, unknown> }).config;
  if (cfg) { cfg.log = () => {}; cfg.warn = () => {}; cfg.error = () => {}; cfg.debug = () => {}; }
  return sqlite3;
}

export async function makeTestDb(): Promise<Db> {
  const s = await getSqlite();
  const db = new s.oo1.DB(":memory:", "c");
  db.exec(SCHEMA);

  return {
    async execute(sql: string, params: unknown[] = []) {
      db.exec({ sql, bind: params as never });
      const lastIdRow = db.exec({
        sql: "SELECT last_insert_rowid() AS id, changes() AS c",
        returnValue: "resultRows",
        rowMode: "object",
      }) as unknown as Array<{ id: number; c: number }>;
      const row = lastIdRow[0] ?? { id: 0, c: 0 };
      return { rowsAffected: Number(row.c), lastInsertId: Number(row.id) };
    },
    async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const rows = db.exec({
        sql,
        bind: params as never,
        returnValue: "resultRows",
        rowMode: "object",
      }) as unknown as T[];
      return rows;
    },
  };
}
