import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";

/**
 * Settings are key/value rows; complex values are stored JSON-encoded and
 * decoded by their accessors. Written by the setup wizard (M2) and the
 * settings screen; read everywhere (PDF, mail, cron, Stripe).
 *
 * Known keys:
 *  business_name, business_address, business_tax_id, currency,
 *  tax_default_bps, invoice_prefix, timezone,
 *  smtp_host, smtp_port, smtp_user, smtp_password, smtp_from,
 *  stripe_secret_key,
 *  reminder_days (JSON number), reminder_enabled (JSON boolean)
 */

export type SettingsMap = Record<string, string>;

export function getAllSettings(): SettingsMap {
  const rows = getDb().select().from(settings).all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function getSetting(key: string): string | null {
  const row = getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    })
    .run();
}

export interface BusinessProfile {
  name: string;
  address: string;
  taxId: string;
  currency: string;
}

export function getBusinessProfile(): BusinessProfile {
  const s = getAllSettings();
  return {
    name: s["business_name"] ?? "Your business",
    address: s["business_address"] ?? "",
    taxId: s["business_tax_id"] ?? "",
    currency: s["currency"] ?? "USD",
  };
}
