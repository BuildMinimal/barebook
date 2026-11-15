# Architecture

*Decided 2026-11-15. The design constraint that shapes everything: a non-developer
clicks "Deploy" and gets a working CRM. Lightness is a feature, not a preference.*

## Topology - one container, one volume

```
docker-compose.yml
└── barebook
    ├── Next.js 15 (standalone output) on node:22-alpine
    │   ├── React server components + server actions (no separate API tier)
    │   ├── node-cron, in-process: overdue-invoice reminders
    │   └── @react-pdf/renderer (in-process PDF generation)
    └── /data volume
        ├── barebook.db      ← SQLite (WAL mode) - the entire business
        └── uploads/         ← logo, attachments
```

No Redis. No workers. No Postgres. No mail server. One healthcheck, one volume.

## Stack decisions and why

| Choice | Why |
|---|---|
| **Next.js 15 + TypeScript** | Biggest ecosystem for polished minimal UI, server actions collapse client/server glue, largest future contributor pool. Chosen over Angular/NestJS and Go+HTMX for fastest path to a polished product; over Laravel for a single-language TypeScript stack. |
| **SQLite (WAL) via Drizzle ORM** | Single-tenant product: one freelancer = one deployment = one user. SQLite in WAL mode serves that trivially (<5 ms reads at this scale). Collapses the deploy to one container + one volume. Backups = copy one file. Drizzle gives typed schema + migrations. |
| **Custom Tailwind components + Radix primitives** | Own token layer + hand-styled components own the visual layer: a distinctive design language doubles as OSS differentiation, and it avoids shadcn's known fork-drift failure mode (once you override its internals, you maintain a fork with upstream guilt). Radix Primitives supply headless behavior + ARIA for the genuinely hard parts: dialog focus traps, combobox typeahead, popover positioning, keyboard nav. shadcn/ui is pattern *reference only* (form/zod composition, dialog patterns) - never a dependency. |
| **@react-pdf/renderer** | Pure JS, no extra binaries in the image, composes like React components. Upgrade path: Typst binary (print-grade typography) post-v1 if needed. |
| **nodemailer + owner's SMTP** | Works with Gmail app-passwords, Resend, Mailgun, anything. No vendor relationship, no keys we hold. |
| **node-cron in-process** | One instance, one process - a scheduler library is all "background jobs" needs. If a job is missed (restart), reminders recalculate from state (overdue days), not from a queue. |
| **Stripe via BYOK** | Owner's own Stripe key stored in DB; "Pay now" creates a Checkout Session server-side. Same trust pattern as BuildMinimal/aeoscope. Optional in settings. |

## Auth model

- **One owner account.** Credentials (bcrypt) + server-side session table in SQLite
  (revocable, no JWT state). Session cookie, HttpOnly, SameSite=Lax.
- **Clients never authenticate.** Every invoice gets a tokened share URL
  (`/i/<token>`), revocable from the invoice page. Public routes are only:
  share links + the setup wizard (when no owner exists) + healthcheck.
- Setup wizard is reachable only while zero owner accounts exist - first click wins,
  then it locks.

## Data model sketch

```
settings        (key, value)                  - wizard output, SMTP, Stripe, branding
sessions        (id, owner_id, expires_at)
owners          (id, email, password_hash)
clients         (id, name, company, email, address, tax_id, currency, notes)
projects        (id, client_id, name, hourly_rate, status, notes)
time_entries    (id, project_id, started_at, ended_at, minutes, description, billable, invoice_id)
invoices        (id, client_id, kind[draft|quote|invoice], number, status, currency,
                 fx_rate, issue_date, due_date, discount_*, tax_*, notes, share_token)
invoice_lines   (id, invoice_id, description, qty, unit, rate, tax_rate)
payments        (id, invoice_id, paid_at, amount, method, note)
```

Money stored as integer minor units (paise/cents). Dates UTC, rendered in the
business timezone (wizard step 2).

## Deployment contract (Hostinger Docker Manager)

- `docker-compose.yml` at repo root, single service
- Volume: `barebook-data:/data`
- Env: none required (`DATA_DIR` defaults `/data`; `PORT` defaults `3000`)
- `HEALTHCHECK`: `GET /api/health` → 200 (checks DB open + migrations applied)
- Image: multi-stage build → `node:22-alpine` runtime, **target < 200 MB**
- First-run wizard appears on first HTTP visit when no owner exists
- Upgrade path: `docker compose pull && docker compose up -d` - migrations run on boot

## Performance envelope

- RAM: ~150–250 MB steady state → comfortable on a KVM 1 VPS, leaving headroom
- Cold start: < 1 s (standalone Next.js, SQLite open, migrations idempotent)
- Reads: server components straight off SQLite WAL - no client-fetch waterfalls
- PDF: generated on demand per invoice (~100 ms), cached in `uploads/pdf/`

## Security notes

- Only owner-authenticated routes mutate data; share links are read-only single-invoice
- Stripe secret key + SMTP password stored in SQLite; exported backups include them -
  export UI must warn, and encrypt-with-passphrase is a post-v1 candidate
- Rate-limit login + share-link token brute force (simple in-memory limiter)
- No telemetry by default; if deploy-count ever exists, it is opt-in
