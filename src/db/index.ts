import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { dataDir } from "../lib/env";

let _db: BarebookDb | null = null;

function openDatabase(): BarebookDb {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(path.join(dir, "barebook.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return drizzle(sqlite, { schema });
}

export type BarebookDb = BetterSQLite3Database<typeof schema>;

/** Process-wide database handle. Opens and configures on first call. */
export function getDb(): BarebookDb {
  if (!_db) {
    _db = openDatabase();
  }
  return _db;
}

/** Test/dev helper: close and forget the cached handle. */
export function closeDb(): void {
  if (_db) {
    _db.$client.close();
    _db = null;
  }
}
