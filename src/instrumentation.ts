/**
 * Runs once when the Next.js server boots (dev and prod).
 * Migrations on boot = `docker compose pull && up -d` upgrades the schema
 * with no manual step, per the deployment contract in docs/architecture.md.
 * The reminder cron is hourly; reminder logic itself is idempotent per
 * business day (see src/lib/reminders.ts).
 */
export async function register() {
  // Positive-form guard: the bundler eliminates the non-node branch before
  // module resolution — the inverted form pulls node-only code into the edge
  // build (webpack fails on better-sqlite3 there).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./db/migrate");
    runMigrations();

    if (process.env.BAREBOOK_DISABLE_CRON === "1") return;

    const cron = (await import("node-cron")).default;
    const { sendOverdueReminders } = await import("./lib/reminders");

    cron.schedule("5 * * * *", () => {
      sendOverdueReminders().catch((err) => {
        console.error("[reminders] failed:", err);
      });
    });
  }
}
