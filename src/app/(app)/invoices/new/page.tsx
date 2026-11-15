import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { NewInvoiceForm, type EntryOption } from "./new-invoice-form";
import { listUninvoicedEntries } from "@/invoice/queries";
import { roundHalfUp } from "@/lib/money";
import { getBusinessProfile, getSetting } from "@/settings/store";

export const metadata: Metadata = { title: "New invoice — Barebook" };

export default function NewInvoicePage() {
  const db = getDb();
  const business = getBusinessProfile();

  const clientRows = db
    .select({ id: clients.id, name: clients.name, company: clients.company, currency: clients.currency })
    .from(clients)
    .orderBy(asc(clients.name))
    .all()
    .map((c) => ({
      id: c.id,
      label: c.company ? `${c.company} (${c.name})` : c.name,
      currency: c.currency ?? business.currency,
    }));

  const entries: EntryOption[] = listUninvoicedEntries().map((e) => ({
    id: e.id,
    clientId: e.clientId,
    label: `${e.projectName}: ${e.description ?? "work session"}`,
    minutes: e.minutes,
    rateMinor: e.rateMinor,
    currency: clientRows.find((c) => c.id === e.clientId)?.currency ?? business.currency,
    valueMinor: e.rateMinor ? roundHalfUp((e.minutes * e.rateMinor) / 60) : 0,
  }));

  const defaultTaxPct = Number(getSetting("tax_default_bps") ?? "0") / 100;

  if (clientRows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">New invoice</h1>
        </header>
        <p className="rounded-lg border border-dashed border-border-subtle px-5 py-10 text-center text-sm text-faint">
          Add a client first — invoices always belong to one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">New invoice</h1>
        <p className="mt-1 text-sm text-muted">
          Pick uninvoiced time now or add lines by hand after the draft opens.
        </p>
      </header>
      <NewInvoiceForm
        clients={clientRows}
        entries={entries}
        defaultTaxPct={defaultTaxPct}
      />
    </div>
  );
}
