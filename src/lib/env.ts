import path from "node:path";

/**
 * Where all Barebook data lives: the SQLite file, uploads, generated PDFs.
 * Defaults to ./data for development; the Docker image sets DATA_DIR=/data.
 */
export function dataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

/** Where drizzle migrations live. Overridable for the standalone Docker build. */
export function migrationsDir(): string {
  return process.env.DRIZZLE_DIR ?? path.join(process.cwd(), "drizzle");
}
