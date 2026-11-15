"use server";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { owners } from "@/db/schema";
import { createSession, hashPassword, requireOwner } from "@/lib/auth";
import { dataDir } from "@/lib/env";
import { hasOwner } from "@/lib/setup";
import { setSetting } from "@/settings/store";

export interface WizardState {
  error: string | null;
}

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const accountSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password needs at least 8 characters"),
  businessName: z.string().trim().min(1, "Business name is required"),
  currency: z.string().trim().length(3),
  timezone: z.string().trim().min(1),
});

/** Step 1: owner account + business identity. Locks the wizard forever after. */
export async function setupAccountAction(
  _prev: WizardState,
  formData: FormData,
): Promise<WizardState> {
  if (hasOwner()) {
    redirect("/login");
  }

  const parsed = accountSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    businessName: formData.get("businessName"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const db = getDb();
  const email = parsed.data.email.toLowerCase().trim();
  if (db.select({ id: owners.id }).from(owners).where(eq(owners.email, email)).get()) {
    return { error: "That email already has an account. Sign in instead." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const ownerId = randomUUID();
  db.insert(owners)
    .values({ id: ownerId, email, passwordHash })
    .run();

  setSetting("business_name", parsed.data.businessName);
  setSetting("currency", parsed.data.currency);
  setSetting("timezone", parsed.data.timezone);

  await createSession(ownerId);
  redirect("/setup?step=2");
}

const detailsSchema = z.object({
  businessAddress: z.string().optional(),
  businessTaxId: z.string().optional(),
  taxDefaultPct: z.coerce
    .number()
    .min(0, "Tax rate can't be negative")
    .max(100, "Tax rate is a percentage"),
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]*$/, "Letters, digits, dots, dashes only"),
});

/** Step 2: invoicing defaults + optional SMTP. All fields skippable. */
export async function setupDetailsAction(
  _prev: WizardState,
  formData: FormData,
): Promise<WizardState> {
  await requireOwner();

  const parsed = detailsSchema.safeParse({
    businessAddress: formData.get("businessAddress") ?? "",
    businessTaxId: formData.get("businessTaxId") ?? "",
    taxDefaultPct: formData.get("taxDefaultPct") ?? "0",
    invoicePrefix: formData.get("invoicePrefix"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  setSetting("business_address", parsed.data.businessAddress?.trim() ?? "");
  setSetting("business_tax_id", parsed.data.businessTaxId?.trim() ?? "");
  setSetting("tax_default_bps", String(Math.round(parsed.data.taxDefaultPct * 100)));
  setSetting("invoice_prefix", parsed.data.invoicePrefix || new Date().getFullYear().toString());

  // Optional logo
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const ext = LOGO_TYPES[logo.type];
    if (!ext) {
      return { error: "Logo must be a PNG, JPG, WebP, or SVG file" };
    }
    if (logo.size > LOGO_MAX_BYTES) {
      return { error: "Logo must be under 2 MB" };
    }
    const uploadsDir = path.join(dataDir(), "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `logo.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(await logo.arrayBuffer()));
    setSetting("logo_path", filename);
  }

  // Optional SMTP (test-connection comes in M5)
  const smtp = {
    host: formData.get("smtpHost"),
    port: formData.get("smtpPort"),
    user: formData.get("smtpUser"),
    password: formData.get("smtpPassword"),
    from: formData.get("smtpFrom"),
  };
  if (typeof smtp.host === "string" && smtp.host.trim()) {
    setSetting("smtp_host", smtp.host.trim());
    setSetting("smtp_port", smtp.port ? String(smtp.port) : "587");
    setSetting("smtp_user", typeof smtp.user === "string" ? smtp.user.trim() : "");
    setSetting("smtp_password", typeof smtp.password === "string" ? smtp.password : "");
    setSetting("smtp_from", typeof smtp.from === "string" ? smtp.from.trim() : "");
  }

  redirect("/");
}
