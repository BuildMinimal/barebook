import { randomUUID } from "node:crypto";
import { closeDb, getDb } from "../src/db/index";
import { owners, settings } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";

/**
 * Demo/dev helper: creates an owner login and a minimal business profile.
 * Run AFTER `npm run db:seed` (which wipes owners and settings):
 *   DATA_DIR=./data-demo npx tsx scripts/demo-owner.ts
 */

const email = process.argv[2] ?? "demo@barebook.app";
const password = process.argv[3] ?? "demo-barebook";

async function main() {
  const db = getDb();
  db.delete(owners).run();
  db.insert(owners)
    .values({ id: randomUUID(), email, passwordHash: await hashPassword(password) })
    .run();

  const demoSettings: [string, string][] = [
    ["business_name", "Harbor Lane Studio"],
    ["business_address", "9 Harbor Lane\nPortsmouth PO1 3AA\nUnited Kingdom"],
    ["currency", "USD"],
    ["timezone", "UTC"],
    ["invoice_prefix", "2026"],
    ["tax_default_bps", "1800"],
  ];
  for (const [key, value] of demoSettings) {
    db.insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
      .run();
  }

  console.log(`demo owner ready: ${email} / ${password}`);
  closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
