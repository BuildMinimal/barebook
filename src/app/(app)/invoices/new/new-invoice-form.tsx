"use client";

import { useActionState, useMemo, useState } from "react";
import { invoiceIdle } from "@/app/actions/invoice-form-state";
import { createInvoiceAction } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/money";

export interface EntryOption {
  id: string;
  clientId: string;
  label: string;
  minutes: number;
  valueMinor: number;
  rateMinor: number | null;
  currency: string;
}

export function NewInvoiceForm({
  clients,
  entries,
  defaultTaxPct,
}: {
  clients: { id: string; label: string; currency: string | null }[];
  entries: EntryOption[];
  defaultTaxPct: number;
}) {
  const [state, formAction, pending] = useActionState(createInvoiceAction, invoiceIdle);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const clientEntries = useMemo(
    () => entries.filter((e) => e.clientId === clientId),
    [entries, clientId],
  );

  const clientCurrency =
    clients.find((c) => c.id === clientId)?.currency ?? "USD";

  const selectedValueMinor = clientEntries
    .filter((e) => selected.has(e.id))
    .reduce((sum, e) => sum + e.valueMinor, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invClient">Client</Label>
          <Select
            id="invClient"
            name="clientId"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setSelected(new Set());
            }}
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invKind">Type</Label>
          <Select id="invKind" name="kind" defaultValue="invoice">
            <option value="invoice">Invoice</option>
            <option value="quote">Quote (convertible later)</option>
          </Select>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <Label>Include uninvoiced time</Label>
        {clientEntries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-subtle px-5 py-6 text-center text-sm text-faint">
            No uninvoiced time for this client. You can add lines by hand next.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface">
            {clientEntries.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="entryIds"
                    value={e.id}
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    {e.label}
                    <span className="text-faint"> · {Math.floor(e.minutes / 60)}h {e.minutes % 60}m</span>
                  </span>
                </span>
                <span className="tabular-nums text-muted">
                  {e.rateMinor ? formatMoney(e.valueMinor, e.currency) : "no rate"}
                </span>
              </label>
            ))}
          </div>
        )}
        {clientEntries.length > 0 ? (
          <p className="text-2xs text-faint">
            Selected value: {formatMoney(selectedValueMinor, clientCurrency)} · tax
            defaults to {defaultTaxPct}% per line, editable inside the invoice.
          </p>
        ) : null}
      </section>

      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending || !clientId}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
