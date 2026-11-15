import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb, closeDb } from "../src/db/index";
import {
  clients,
  invoiceLines,
  invoices,
  payments,
  projects,
  settings,
  sessions,
  timeEntries,
  owners,
} from "../src/db/schema";

/**
 * Dev-only seed: wipes all tables and inserts a small, realistic dataset
 * (2 clients, 1 project, 6 time entries, 2 invoices, 1 partial payment).
 * Run: npm run db:seed
 */

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY);
const dateStr = (d: Date) => d.toISOString().slice(0, 10);

/** minutes -> qty in thousandths of an hour */
const minToMilli = (min: number) => Math.round((min / 60) * 1000);

const db = getDb();

db.delete(payments).run();
db.delete(timeEntries).run();
db.delete(invoiceLines).run();
db.delete(invoices).run();
db.delete(projects).run();
db.delete(clients).run();
db.delete(sessions).run();
db.delete(owners).run();
db.delete(settings).run();

// -- clients -----------------------------------------------------------------
const meridian = randomUUID();
const kavya = randomUUID();
db.insert(clients)
  .values([
    {
      id: meridian,
      name: "Meridian Studio",
      company: "Meridian Studio LLP",
      email: "accounts@meridianstudio.example",
      address: "14 Fleet Street\nLondon EC4Y 1AA\nUnited Kingdom",
      taxId: "GB123456789",
      currency: "USD",
      notes: "Quarterly design sprints. Net-14 payment terms.",
    },
    {
      id: kavya,
      name: "Kavya Rao",
      email: "kavya.rao@example.com",
      address: "22 MG Road\nBengaluru 560001\nIndia",
      currency: "EUR",
      notes: "Prefers EUR invoices. Pays via bank transfer.",
    },
  ])
  .run();

// -- project -----------------------------------------------------------------
const redesign = randomUUID();
db.insert(projects)
  .values({
    id: redesign,
    clientId: meridian,
    name: "Website redesign",
    hourlyRateMinor: 7500, // $75.00/hr
    status: "active",
    notes: "Phase 1: marketing site + component library.",
  })
  .run();

// -- time entries: three will be invoiced, three stay open --------------------
const specs = [
  { min: 150, desc: "Homepage wireframes", days: 14 },
  { min: 210, desc: "Component library setup", days: 12 },
  { min: 90, desc: "Stakeholder review call", days: 11 },
  { min: 180, desc: "Blog templates", days: 6 },
  { min: 120, desc: "Contact form + validation", days: 4 },
  { min: 240, desc: "Accessibility audit fixes", days: 2 },
];

const inserted = db
  .insert(timeEntries)
  .values(
    specs.map((e) => ({
      id: randomUUID(),
      projectId: redesign,
      startedAt: daysAgo(e.days),
      endedAt: new Date(daysAgo(e.days).getTime() + e.min * 60 * 1000),
      description: e.desc,
      billable: true,
      createdAt: daysAgo(e.days),
    })),
  )
  .returning({ id: timeEntries.id, description: timeEntries.description })
  .all();

const invoicedIds = inserted.slice(0, 3).map((r) => r.id);

// -- invoice 2026-001: built from the first three entries ---------------------
const inv1 = randomUUID();
db.insert(invoices)
  .values({
    id: inv1,
    clientId: meridian,
    kind: "invoice",
    status: "sent",
    number: "2026-001",
    currency: "USD",
    issueDate: dateStr(daysAgo(10)),
    dueDate: dateStr(daysAgo(-4)), // 4 days from now
    notes: "Thanks for your business!",
    shareToken: "demo-share-token-001",
  })
  .run();

db.insert(invoiceLines)
  .values(
    specs.slice(0, 3).map((e, i) => ({
      id: randomUUID(),
      invoiceId: inv1,
      description: e.desc,
      qtyMilli: minToMilli(e.min),
      unit: "hr",
      rateMinor: 7500,
      taxBps: 1800,
      position: i,
    })),
  )
  .run();

db.update(timeEntries)
  .set({ invoiceId: inv1 })
  .where(inArray(timeEntries.id, invoicedIds))
  .run();

// -- invoice 2026-002: free-form, EUR, 5% discount, draft ---------------------
const inv2 = randomUUID();
db.insert(invoices)
  .values({
    id: inv2,
    clientId: kavya,
    kind: "invoice",
    status: "draft",
    number: "2026-002",
    currency: "EUR",
    fxRate: 1080000, // 1.08 EUR->USD at issue
    issueDate: dateStr(daysAgo(3)),
    dueDate: dateStr(daysAgo(-11)),
    discountBps: 500,
    notes: "50% due on acceptance, 50% on delivery.",
  })
  .run();

db.insert(invoiceLines)
  .values([
    {
      id: randomUUID(),
      invoiceId: inv2,
      description: "Brand identity concepts",
      qtyMilli: 1000,
      unit: "item",
      rateMinor: 120000, // EUR 1200.00
      position: 0,
    },
    {
      id: randomUUID(),
      invoiceId: inv2,
      description: "Logo refinement round",
      qtyMilli: 2000,
      unit: "hr",
      rateMinor: 6500, // EUR 65.00/hr
      position: 1,
    },
  ])
  .run();

// -- one partial payment against 2026-001 -------------------------------------
db.insert(payments)
  .values({
    id: randomUUID(),
    invoiceId: inv1,
    paidAt: daysAgo(5),
    amountMinor: 50000, // $500.00
    method: "bank_transfer",
    note: "Advance on receipt of invoice",
  })
  .run();

console.log(
  "seeded: 2 clients, 1 project, 6 time entries, 2 invoices, 1 payment",
);

closeDb();
