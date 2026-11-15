export interface TimeEntryState {
  error: string | null;
  saved: boolean;
}

export const timeIdle: TimeEntryState = { error: null, saved: false };

export interface InvoiceActionState {
  error: string | null;
  saved: boolean;
}

export const invoiceActionIdle: InvoiceActionState = {
  error: null,
  saved: false,
};
