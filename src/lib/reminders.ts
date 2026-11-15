import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, invoices } from "@/db/schema";
import { sendMail } from "@/lib/mail";
import { formatMoney } from "@/lib/money";
import { utcToDateString } from "@/lib/datetime";
import { getInvoiceDetail } from "@/invoice/queries";
import { getAllSettings } from "@/settings/store";

/*
 * Automated overdue reminders. The cron fires hourly and this function is
 * idempotent per business-day per invoice, so no timezone math lives in the
 * cron expression — reminders go out on the first tick after the condition
 * is met, and never twice in one business day.
 */

const REMINDER_COOLDOWN_DAYS = 3;

export async function sendOverdueReminders(): Promise<number> {
  const s = getAllSettings();
  if (s["reminder_enabled"] !== "true") return 0;

  const afterDays = Math.max(1, Number(s["reminder_days"] ?? "3") || 3);
  const businessTz = s["timezone"] ?? "UTC";
  const graceDate = new Date();
  graceDate.setDate(graceDate.getDate() - afterDays);
  const graceStr = utcToDateString(graceDate, businessTz);

  const business = { name: s["business_name"] ?? "Your business" };

  const rows = getDb()
    .select({
      id: invoices.id,
      number: invoices.number,
      dueDate: invoices.dueDate,
      currency: invoices.currency,
      shareToken: invoices.shareToken,
      lastReminderAt: invoices.lastReminderAt,
      clientName: clients.name,
      clientEmail: clients.email,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.status, "sent"), eq(invoices.kind, "invoice")))
    .all();

  let sent = 0;
  for (const r of rows) {
    if (!r.clientEmail) continue;
    if (!r.dueDate || r.dueDate > graceStr) continue;

    // at most one automated reminder per invoice per cooldown window
    const last = r.lastReminderAt?.getTime() ?? 0;
    const cooldownMs = REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - last < cooldownMs) continue;

    const detail = getInvoiceDetail(r.id);
    if (!detail || detail.balanceMinor <= 0) continue;

    const result = await sendMail({
      to: r.clientEmail,
      subject: `Reminder: invoice ${r.number} from ${business.name}`,
      text: [
        `Hi ${r.clientName},`,
        "",
        `A friendly reminder that invoice ${r.number} (due ${r.dueDate}) has a balance of ${formatMoney(detail.balanceMinor, r.currency)}.`,
        r.shareToken ? `View or pay online: /i/${r.shareToken}` : "",
        "",
        "If you've already sent payment, please disregard this note.",
        business.name,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    if (result.ok) {
      getDb()
        .update(invoices)
        .set({ lastReminderAt: new Date() })
        .where(eq(invoices.id, r.id))
        .run();
      sent += 1;
    }
  }

  return sent;
}
