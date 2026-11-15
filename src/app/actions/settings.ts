"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { setSetting } from "@/settings/store";
import { settingsOk } from "./settings-state";
import type { SettingsState } from "./settings-types";

function fail(message: string): SettingsState {
  return { saved: false, error: message };
}

const businessSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required"),
  businessAddress: z.string().optional(),
  businessTaxId: z.string().optional(),
  currency: z.string().trim().length(3),
  timezone: z.string().trim().min(1),
});

export async function updateBusinessAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireOwner();

  const parsed = businessSchema.safeParse({
    businessName: formData.get("businessName"),
    businessAddress: formData.get("businessAddress"),
    businessTaxId: formData.get("businessTaxId"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the form");
  }

  setSetting("business_name", parsed.data.businessName);
  setSetting("business_address", parsed.data.businessAddress?.trim() ?? "");
  setSetting("business_tax_id", parsed.data.businessTaxId?.trim() ?? "");
  setSetting("currency", parsed.data.currency);
  setSetting("timezone", parsed.data.timezone);

  revalidatePath("/settings");
  return settingsOk;
}

const invoicingSchema = z.object({
  taxDefaultPct: z.coerce
    .number()
    .min(0, "Tax rate can't be negative")
    .max(100, "Tax rate is a percentage"),
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]*$/, "Letters, digits, dots, dashes only"),
  reminderEnabled: z.enum(["on", "off"]).optional(),
  reminderDays: z.coerce.number().int().min(1).max(365),
});

export async function updateInvoicingAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireOwner();

  const parsed = invoicingSchema.safeParse({
    taxDefaultPct: formData.get("taxDefaultPct"),
    invoicePrefix: formData.get("invoicePrefix"),
    reminderEnabled: formData.get("reminderEnabled") ? "on" : "off",
    reminderDays: formData.get("reminderDays") ?? "3",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the form");
  }

  setSetting("tax_default_bps", String(Math.round(parsed.data.taxDefaultPct * 100)));
  setSetting("invoice_prefix", parsed.data.invoicePrefix);
  setSetting("reminder_enabled", parsed.data.reminderEnabled === "on" ? "true" : "false");
  setSetting("reminder_days", String(parsed.data.reminderDays));

  revalidatePath("/settings");
  return settingsOk;
}

const smtpSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFrom: z.string().optional(),
});

export async function updateSmtpAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireOwner();

  const parsed = smtpSchema.safeParse({
    smtpHost: formData.get("smtpHost") ?? "",
    smtpPort: formData.get("smtpPort"),
    smtpUser: formData.get("smtpUser") ?? "",
    smtpPassword: formData.get("smtpPassword"),
    smtpFrom: formData.get("smtpFrom") ?? "",
  });
  if (!parsed.success) {
    return fail("Check the form");
  }

  const host = parsed.data.smtpHost?.trim() ?? "";
  if (!host) {
    // clearing the host clears the whole SMTP config
    for (const key of ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from"]) {
      setSetting(key, "");
    }
    revalidatePath("/settings");
    return settingsOk;
  }

  setSetting("smtp_host", host);
  setSetting("smtp_port", parsed.data.smtpPort?.trim() || "587");
  setSetting("smtp_user", parsed.data.smtpUser?.trim() ?? "");
  setSetting("smtp_password", parsed.data.smtpPassword ?? "");
  setSetting("smtp_from", parsed.data.smtpFrom?.trim() ?? "");

  revalidatePath("/settings");
  return settingsOk;
}
