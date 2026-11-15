"use client";

import { useActionState } from "react";
import { invoiceActionIdle } from "@/app/actions/time-state";
import { emailInvoiceAction, sendReminderAction } from "@/app/actions/email";
import { Button } from "@/components/ui/button";

function MailResult({ state }: { state: { error: string | null; saved: boolean } }) {
  if (state.saved) {
    return (
      <span className="text-sm text-success" role="status">
        Sent.
      </span>
    );
  }
  if (state.error) {
    return (
      <span className="text-sm text-danger" role="alert">
        {state.error}
      </span>
    );
  }
  return null;
}

export function EmailInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState(
    emailInvoiceAction,
    invoiceActionIdle,
  );

  return (
    <div className="flex items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={invoiceId} />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Sending…" : "Email invoice"}
        </Button>
      </form>
      <MailResult state={state} />
    </div>
  );
}

export function ReminderButton({
  invoiceId,
  disabled,
}: {
  invoiceId: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    sendReminderAction,
    invoiceActionIdle,
  );

  return (
    <div className="flex items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={invoiceId} />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={pending || disabled}
        >
          {pending ? "Sending…" : "Send reminder"}
        </Button>
      </form>
      <MailResult state={state} />
    </div>
  );
}
