"use client";

import { useActionState } from "react";
import {
  settingsIdle,
} from "@/app/actions/settings-state";
import {
  updateBusinessAction,
  updateInvoicingAction,
  updateSmtpAction,
} from "@/app/actions/settings";
import type { SettingsState } from "@/app/actions/settings-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function Status({ state }: { state: SettingsState }) {
  if (state.error) {
    return (
      <p className="text-sm text-danger" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.saved) {
    return (
      <p className="text-sm text-success" role="status">
        Saved.
      </p>
    );
  }
  return null;
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function BusinessForm({
  values,
  currencies,
  timezones,
}: {
  values: {
    businessName: string;
    businessAddress: string;
    businessTaxId: string;
    currency: string;
    timezone: string;
  };
  currencies: { code: string; label: string }[];
  timezones: string[];
}) {
  const [state, formAction, pending] = useActionState(
    updateBusinessAction,
    settingsIdle,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            name="businessName"
            defaultValue={values.businessName}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="businessTaxId">Tax ID</Label>
          <Input
            id="businessTaxId"
            name="businessTaxId"
            defaultValue={values.businessTaxId}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Select id="currency" name="currency" defaultValue={values.currency}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Select id="timezone" name="timezone" defaultValue={values.timezone}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="businessAddress">Address</Label>
          <Textarea
            id="businessAddress"
            name="businessAddress"
            defaultValue={values.businessAddress}
            className="min-h-16"
          />
        </div>
      </div>
      <Status state={state} />
      <SaveButton pending={pending} />
    </form>
  );
}

export function InvoicingForm({
  taxDefaultPct,
  invoicePrefix,
}: {
  taxDefaultPct: string;
  invoicePrefix: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateInvoicingAction,
    settingsIdle,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
            defaultValue={taxDefaultPct}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoicePrefix">Invoice number prefix</Label>
          <Input
            id="invoicePrefix"
            name="invoicePrefix"
            defaultValue={invoicePrefix}
          />
        </div>
      </div>
      <Status state={state} />
      <SaveButton pending={pending} />
    </form>
  );
}

export function SmtpForm({
  values,
}: {
  values: {
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpFrom: string;
  };
}) {
  const [state, formAction, pending] = useActionState(
    updateSmtpAction,
    settingsIdle,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtpHost">SMTP host</Label>
          <Input
            id="smtpHost"
            name="smtpHost"
            defaultValue={values.smtpHost}
            placeholder="smtp.resend.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtpPort">Port</Label>
          <Input
            id="smtpPort"
            name="smtpPort"
            type="number"
            defaultValue={values.smtpPort}
            placeholder="587"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtpUser">User</Label>
          <Input
            id="smtpUser"
            name="smtpUser"
            defaultValue={values.smtpUser}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtpPassword">Password</Label>
          <Input
            id="smtpPassword"
            name="smtpPassword"
            type="password"
            autoComplete="off"
            placeholder={values.smtpHost ? "Leave blank to keep" : ""}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="smtpFrom">From address</Label>
          <Input
            id="smtpFrom"
            name="smtpFrom"
            type="email"
            defaultValue={values.smtpFrom}
          />
        </div>
      </div>
      <p className="text-2xs text-faint">
        Clearing the host clears the whole email config. Password is kept when
        left blank.
      </p>
      <Status state={state} />
      <SaveButton pending={pending} />
    </form>
  );
}
