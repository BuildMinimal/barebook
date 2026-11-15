# Deploying Barebook

Barebook ships as **one container with one volume**. Any compose-capable host
works; the steps below use Hostinger's VPS + Docker Manager, which is also
where the "Deploy to Hostinger" button lands.

## What a deploy looks like

```
docker-compose.yml          # one service, one volume, no required env
└── barebook (node:22-alpine, ~200 MB image)
    ├── migrations run automatically on every boot
    └── /data               ← barebook.db + uploads (mount this)
```

## Hostinger VPS (Docker Manager)

1. Create a VPS (KVM 1 is plenty — Barebook idles around 200 MB RAM).
2. Open **Docker Manager → Deploy** and point it at this repository, or SSH in
   and run:
   ```bash
   git clone https://github.com/BuildMinimal/barebook.git && cd barebook
   docker compose up -d --build
   ```
3. Open `http://<vps-ip>:3000` — the first-run setup wizard creates your
   account, business profile, currency, and invoice numbering.
4. Put a domain on it (Hostinger's panel or any reverse proxy) so clients get
   a clean link, and terminate TLS at the proxy. Barebook serves plain HTTP
   on port 3000; it sets `Secure` cookies only when `NODE_ENV=production`
   **and** it is reached over HTTPS by the proxy.

## Environment variables

None are required. Optional overrides:

| Variable | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `/data` (container) / `./data` (dev) | Where `barebook.db` + uploads live |
| `PORT` | `3000` | HTTP port |
| `DRIZZLE_DIR` | `./drizzle` | Migration folder (baked into the image) |
| `BAREBOOK_DISABLE_CRON` | unset | Set to `1` to disable the reminder scheduler |

## Upgrades

```bash
git pull
docker compose up -d --build
```

Migrations are idempotent and run on boot — no manual step, no downtime
beyond the restart. Your data stays on the `barebook-data` volume.

## Backups

Everything that matters is `/data`: one SQLite file + uploads.

- **In-app**: Settings → Your data → *Download backup (.zip)* — a consistent
  snapshot (safe against concurrent writes) plus uploads.
- **Off-site, automated**: cron on any second machine:
  ```bash
  0 4 * * * sqlite3 /path/on/vps/barebook.db ".backup /mnt/backups/barebook-$(date +\%F).db"
  ```
  (or copy the zip from the app's endpoint with curl and an auth cookie).
- **Restore**: stop the container, replace `/data/barebook.db` (and
  `uploads/`), start it. Migrations will bring an older snapshot forward.

## Health

`GET /api/health` → `200 {"status":"ok"}` when the DB is open and the schema
is migrated; `503` otherwise. The Dockerfile wires this into a HEALTHCHECK.

## Security notes

- Only the owner session mutates data; client share links (`/i/<token>`) are
  read-only and revocable.
- Rate-limited login (10 attempts / 15 min, in-memory).
- No telemetry. Nothing leaves the box except the emails you send.
