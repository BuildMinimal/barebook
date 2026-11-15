# Product scope - v1

*Decided 2026-11-15. v1 aims to be the full "self-hosted FreshBooks alternative" promise: not just invoices - the daily work loop (track → bill → get paid → nudge).*

## The user

A freelancer or solo consultant with international clients who currently juggles
a spreadsheet for clients, a notes app for hours, and a SaaS invoice tool - and
dreads "doing the books" every month. They will deploy Barebook themselves on a
VPS (or click a Deploy button) and never open a terminal.

The emotional core: **track the work, send the invoice, get paid, nudge the
late payers** - with the least admin possible.

## v1 feature set (in)

### Clients
- CRUD contact book: name, company, email, address, tax ID, currency default, notes
- Client page aggregates: projects, hours, invoices, payments, outstanding balance

### Projects & time
- Projects per client: name, rate (hourly default), status, notes
- Time entries: manual add + one-click timer (one running timer at a time)
- Mark entries billable / invoiced; uninvoiced-hours rollup per project and client

### Invoices
- Line items from uninvoiced time entries (grouped) or free-form
- Per-line tax rate, per-line description/qty/rate, invoice-level discount
- Per-invoice currency with exchange rate captured at issue time
- Numbering: configurable prefix + auto-increment (e.g. `2026-001`)
- Quote → convert to invoice (one click)
- States: draft → sent → paid / overdue / void

### Getting paid
- Payments log per invoice (date, amount, method, note); partial payments supported
- **Stripe "Pay now" (BYOK):** owner pastes their own Stripe secret key in settings;
  invoices get an optional payment button → Stripe Checkout with the invoice total
- PDF invoice generated with @react-pdf/renderer - clean, minimal, print-grade layout
- Email invoice via the owner's own SMTP (nodemailer): PDF attached + magic share link
- **Magic share links:** per-invoice client-facing URL (tokened, revocable); clients never create accounts

### Dashboard & nudges
- Outstanding balance total, overdue list, revenue this month, uninvoiced hours
- Overdue reminder: built-in node-cron sends a polite nudge email after N days (configurable, default off)

### First-run setup wizard (the non-dev story)
1. Create owner account
2. Business profile: name, logo upload, address, tax ID
3. Currency, default tax rate, invoice number prefix
4. SMTP settings (their own Gmail app-password / Resend / Mailgun…) - skippable
5. Stripe key - skippable
Everything except account + business name is skippable and editable later.

### Settings & data
- Backup: one-click export (SQLite file + uploads as a zip); restore documented
- All settings live in the DB; no required env vars beyond the data path

## Explicitly out of scope for v1

- Expenses & receipts tracking
- Recurring invoices / subscriptions
- Client portal with logins (share links only)
- Multi-user teams, roles, invites
- Passkeys / 2FA (plain credentials + session table in v1)
- Public API, webhooks, API keys
- Bank feeds / reconciliation
- Proposals/contracts beyond simple quotes
- Localization beyond English (schema carries currency + tax; UI stays EN)

## Post-v1 roadmap (rough order)

1. Expenses + attach receipts to invoices
2. Recurring invoices
3. Passkeys + 2FA
4. Public read-only API + PikaPods listing
5. Typst PDF engine option (if @react-pdf typography isn't enough)
6. Client portal

## Success signals for v1

- A non-developer can go from first click → sent invoice without touching docs
- A freelancer runs their billing on Barebook for a full month and doesn't go back
- The invoice PDF is something a user is proud to put their name on
