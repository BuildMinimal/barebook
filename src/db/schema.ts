import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/*
 * Money invariants (see docs/architecture.md):
 *  - amounts: integer minor units (cents/paise)
 *  - quantities: integer thousandths (7.5 hours -> 7500)
 *  - tax rates and discounts: basis points (18% -> 1800)
 *  - dates without time-of-day (issue/due): ISO text "YYYY-MM-DD"
 *  - instants (created, paid, session expiry): integer ms timestamps
 */

export const owners = sqliteTable("owners", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha-256 of the session token
    ownerId: text("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("sessions_owner_idx").on(t.ownerId)],
);

/** Wizard/settings output. Complex values are stored JSON-encoded. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    address: text("address"),
    taxId: text("tax_id"),
    /** Client's preferred currency; falls back to the business currency. */
    currency: text("currency"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Default hourly rate in minor units; null for fixed-price work. */
    hourlyRateMinor: integer("hourly_rate_minor"),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("projects_client_idx").on(t.clientId)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["draft", "quote", "invoice"] })
      .notNull()
      .default("invoice"),
    /** "draft" | "sent" | "paid" | "void". "overdue" is derived, never stored. */
    status: text("status", { enum: ["draft", "sent", "paid", "void"] })
      .notNull()
      .default("draft"),
    /** Human number, e.g. "2026-001" (prefix from settings + sequence). */
    number: text("number").notNull(),
    currency: text("currency").notNull().default("USD"),
    /** Exchange rate to the business currency at issue time; 1 = same. */
    fxRate: integer("fx_rate").notNull().default(1000000), // millionths
    issueDate: text("issue_date"),
    dueDate: text("due_date"),
    /** Invoice-level discount in basis points of the subtotal. */
    discountBps: integer("discount_bps").notNull().default(0),
    notes: text("notes"),
    /** Present = share link active; null = link revoked/never generated. */
    shareToken: text("share_token"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("invoices_client_idx").on(t.clientId),
    index("invoices_status_idx").on(t.status),
    uniqueIndex("invoices_share_token_idx").on(t.shareToken),
  ],
);

export const invoiceLines = sqliteTable(
  "invoice_lines",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    /** Quantity in thousandths (7.5 hours -> 7500). */
    qtyMilli: integer("qty_milli").notNull().default(1000),
    /** Unit label shown on the invoice ("hr", "item", ...). */
    unit: text("unit").notNull().default("item"),
    /** Price per unit in minor units. */
    rateMinor: integer("rate_minor").notNull(),
    /** Per-line tax in basis points (0 = untaxed). */
    taxBps: integer("tax_bps").notNull().default(0),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId)],
);

export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    /** Null while the timer is running. */
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    description: text("description"),
    billable: integer("billable", { mode: "boolean" }).notNull().default(true),
    /** Set once the entry is included in an invoice. */
    invoiceId: text("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("time_entries_project_idx").on(t.projectId),
    index("time_entries_invoice_idx").on(t.invoiceId),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    /** "bank_transfer" | "card" | "cash" | "upi" | "other" (free-form ok). */
    method: text("method"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
);
