import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CURRENCIES } from "@/lib/currencies";
import { TIMEZONES } from "@/lib/timezones";
import { getAllSettings } from "@/settings/store";
import {
  BusinessForm,
  InvoicingForm,
  SmtpForm,
  SmtpTestButton,
  StripeForm,
} from "./settings-forms";

export const metadata: Metadata = { title: "Settings — Barebook" };

export default function SettingsPage() {
  const s = getAllSettings();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Everything the setup wizard asked, editable forever.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
          <CardDescription>What your invoices say about you.</CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessForm
            values={{
              businessName: s["business_name"] ?? "",
              businessAddress: s["business_address"] ?? "",
              businessTaxId: s["business_tax_id"] ?? "",
              currency: s["currency"] ?? "USD",
              timezone: s["timezone"] ?? "UTC",
            }}
            currencies={CURRENCIES}
            timezones={TIMEZONES}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoicing</CardTitle>
          <CardDescription>Defaults for new invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicingForm
            taxDefaultPct={String(
              Number(s["tax_default_bps"] ?? 0) / 100,
            )}
            invoicePrefix={s["invoice_prefix"] ?? ""}
            reminderEnabled={s["reminder_enabled"] === "true"}
            reminderDays={s["reminder_days"] ?? "3"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Your own SMTP account — used to send invoices and reminders.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SmtpForm
            values={{
              smtpHost: s["smtp_host"] ?? "",
              smtpPort: s["smtp_port"] ?? "",
              smtpUser: s["smtp_user"] ?? "",
              smtpFrom: s["smtp_from"] ?? "",
            }}
          />
          <SmtpTestButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>
            Let clients pay invoices by card through your own Stripe account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StripeForm hasKey={!!s["stripe_secret_key"]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Everything lives in one SQLite file plus uploads.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <a
            href="/api/backup"
            className="inline-flex h-8 w-fit items-center justify-center rounded-md border border-border-subtle bg-surface px-3 text-sm font-medium transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Download backup (.zip)
          </a>
          <p className="text-2xs text-faint">
            The archive contains your SMTP and Stripe credentials — store it
            somewhere safe. Automate off-site copies with cron + the same URL
            and an auth header, or plain file copies of the data directory.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
