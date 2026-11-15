# Barebook

> The bare-necessities freelancer CRM. Clients, work, and money in one book.

**Status: v1 feature-complete, in testing.** Deployable via Docker; not yet battle-tested in production.

Barebook is a self-hosted CRM and invoicing app for freelancers — clients,
time tracking, quotes, invoices, payments, and reminders in one place. It
deploys as a single Docker container with a single SQLite file: no Redis, no
Postgres, no terminal, and backups are copying one file.

## What it does

| Area | v1 |
|---|---|
| Clients | Contact book with notes; every invoice and hour traces back to a client |
| Work | Projects + time entries with a one-click timer; billable hours feed invoices |
| Invoices | Line items, per-line tax, discounts, per-invoice currency; quote → invoice conversion |
| Getting paid | Payments log, optional Stripe "Pay now" button (your own Stripe key), PDF invoices, email via your own SMTP |
| Clients never log in | Every invoice gets a magic share link |
| Dashboard | Outstanding invoices, revenue this month, who to nudge |
| Reminders | Overdue invoice nudges via built-in scheduler |

## Why self-host it

- **Your client and billing data stays yours** - no SaaS subscription that outlives your freelance career
- **No per-seat pricing** - it's your VPS, one user, one price
- **One-file backups** - SQLite WAL; `cp barebook.db backup.db` and you're done

## Deployment

- Single `docker-compose.yml` in repo root - built for [Hostinger's Docker Manager](https://www.hostinger.com/support/12040789-hostinger-docker-manager-for-vps-simplify-your-container-deployments) and any compose-capable host
- First-run setup wizard: owner account → business profile → currency/tax → SMTP. No terminal required.
- ~200 MB RAM - comfortable on an entry-level VPS

See [docs/deploy.md](docs/deploy.md) for the full guide: Hostinger steps, upgrades, backups, restore, and the health endpoint.

## Docs

- [Product scope - v1](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Brand](docs/brand.md)

## License

MIT (planned, at first public release).
