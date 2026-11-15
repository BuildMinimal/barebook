import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { dataDir } from "../lib/env";

export type BarebookDb = BetterSQLite3Database<typeof schema>;

interface DbHandle {
  db: BarebookDb;
  sqlite: Database.Database;
}

let _handle: DbHandle | null = null;

function openDatabase(): DbHandle {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(path.join(dir, "barebook.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return { db: drizzle(sqlite, { schema }), sqlite };
}

/** Process-wide database handle. Opens and configures on first call. */
export function getDb(): BarebookDb {
  if (!_handle) {
    _handle = openDatabase();
  }
  return _handle.db;
}

/** Raw better-sqlite3 handle — only for backup APIs and tests. */
export function getRawDb(): Database.Database {
  if (!_handle) {
    _handle = openDatabase();
  }
  return _handle.sqlite;
}

/** Test/dev helper: close and forget the cached handle. */
export function closeDb(): void {
  if (_handle) {
    _handle.sqlite.close();
    _handle = null;
  }
}
