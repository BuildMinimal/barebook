"use client";

import { useActionState } from "react";
import {
  setupDetailsAction,
  type WizardState,
} from "@/app/actions/setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: WizardState = { error: null };

export function SetupDetailsForm() {
  const [state, formAction, pending] = useActionState(
    setupDetailsAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Business details</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="businessAddress">Address</Label>
          <Textarea
            id="businessAddress"
            name="businessAddress"
            placeholder={"Street\nCity, ZIP\nCountry"}
            className="min-h-16"
          />
          <p className="text-2xs text-faint">
            Printed on your invoices. Multi-line is fine.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessTaxId">Tax ID</Label>
            <Input id="businessTaxId" name="businessTaxId" placeholder="GST / VAT / EIN" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logo">Logo</Label>
            <Input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
            />
            <p className="text-2xs text-faint">PNG, JPG, WebP or SVG, under 2 MB.</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Invoicing defaults</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="taxDefaultPct">Default tax rate (%)</Label>
            <Input
              id="taxDefaultPct"
              name="taxDefaultPct"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={0}
            />
            <p className="text-2xs text-faint">Pre-fills tax on new lines. 0 = none.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoicePrefix">Invoice number prefix</Label>
            <Input
              id="invoicePrefix"
              name="invoicePrefix"
              placeholder={String(new Date().getFullYear())}
            />
            <p className="text-2xs text-faint">
              Invoices number as prefix-001, prefix-002, …
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Email (optional)</h3>
        <p className="text-2xs text-faint">
          For sending invoices. Uses your own SMTP account — Gmail app password,
          Resend, Mailgun, anything. You can skip this and add it in Settings.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtpHost">SMTP host</Label>
            <Input id="smtpHost" name="smtpHost" placeholder="smtp.resend.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtpPort">Port</Label>
            <Input id="smtpPort" name="smtpPort" type="number" placeholder="587" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtpUser">User</Label>
            <Input id="smtpUser" name="smtpUser" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtpPassword">Password</Label>
            <Input
              id="smtpPassword"
              name="smtpPassword"
              type="password"
              autoComplete="off"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="smtpFrom">From address</Label>
            <Input
              id="smtpFrom"
              name="smtpFrom"
              type="email"
              placeholder="you@yourdomain.com"
            />
          </div>
        </div>
      </section>

      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Saving…" : "Finish setup"}
      </Button>
    </form>
  );
}
