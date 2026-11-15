/**
 * Runs once when the Next.js server boots (dev and prod).
 * Migrations on boot = `docker compose pull && up -d` upgrades the schema
 * with no manual step, per the deployment contract in docs/architecture.md.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runMigrations } = await import("./db/migrate");
  runMigrations();
}
