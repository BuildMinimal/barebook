import type { Metadata } from "next";
import { CURRENCIES } from "@/lib/currencies";
import { getBusinessProfile } from "@/settings/store";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "New client — Barebook" };

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">New client</h1>
        <p className="mt-1 text-sm text-muted">
          Only a name is required — everything else can wait.
        </p>
      </header>
      <ClientForm
        mode="create"
        values={{
          name: "",
          company: "",
          email: "",
          address: "",
          taxId: "",
          currency: getBusinessProfile().currency,
          notes: "",
        }}
        currencies={CURRENCIES}
      />
    </div>
  );
}
