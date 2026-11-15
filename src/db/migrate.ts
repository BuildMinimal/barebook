import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb } from "./index";
import { migrationsDir } from "../lib/env";

/**
 * Runs pending drizzle migrations. Idempotent — called on every boot
 * (see src/instrumentation.ts) so a container upgrade just works.
 */
export function runMigrations(): void {
  migrate(getDb(), { migrationsFolder: migrationsDir() });
}
