# Self-Hosting Design: Smolowe Household Portal

**Date:** 2026-05-12
**Status:** Approved
**Phase:** 2 of 3

## Goal

Move the Smolowe Household Portal from Vercel + cloud Supabase to a fully
self-contained deployment on a Synology DS1618+ NAS. No third-party runtime
dependencies — just Docker containers on the NAS, a Cloudflare Tunnel for
remote access, and Dropbox for offsite backups.

## Hardware

- **NAS:** Synology DS1618+ (6-bay)
- **CPU:** Intel Atom C3538, 4 cores, 2.1 GHz
- **RAM:** 32 GB
- **DSM:** 7.1.1 Update 9
- **Docker:** Installed (DSM "Docker" package)
- **NIC:** Synology E10G18-T1 (10GbE PCIe)
- **Existing workloads:** Plex Media Server

## Architecture

### Containers

Three containers defined in a single `docker-compose.yml`:

| Container   | Image                          | Purpose                              |
|-------------|--------------------------------|--------------------------------------|
| `portal`    | Custom (Next.js 16, node:22)   | Application server (`next start`)    |
| `db`        | `postgres:16-alpine`           | PostgreSQL database                  |
| `tunnel`    | `cloudflare/cloudflared:latest`| Cloudflare Tunnel to the internet    |

Resource allocation is minimal relative to the 32 GB available:
- PostgreSQL: ~256 MB
- Next.js: ~512 MB
- cloudflared: ~64 MB
- Total: under 1 GB, leaving 31+ GB for Plex and the OS

### Docker Compose Structure

```
smolowe-portal/
  docker-compose.yml
  Dockerfile              # Multi-stage: build Next.js, then run with node:22-alpine
  .env                    # DB credentials, session secret, Cloudflare token
  backups/                # pg_dump output, synced to Dropbox via Cloud Sync
```

The `docker-compose.yml` lives in a shared folder on the NAS (e.g.,
`/volume1/docker/smolowe-portal/`). PostgreSQL data persists to a named
Docker volume.

### Networking

- `portal` and `db` communicate over a private Docker bridge network
- `tunnel` connects to `portal:3000` and exposes it as `axiominteract.com`
- On the local LAN, the portal is also reachable at `<nas-ip>:3000`
- No ports are exposed to the public internet — Cloudflare Tunnel creates
  an outbound-only connection

## Domain & DNS

- **Domain:** `axiominteract.com`
- **Registrar:** Porkbun
- **DNS:** Cloudflare (change nameservers in Porkbun to Cloudflare's)
- **HTTPS:** Handled by Cloudflare edge — no SSL certificates on the NAS

Setup steps:
1. Create a free Cloudflare account (or use existing)
2. Add `axiominteract.com` as a site in Cloudflare
3. Update nameservers in Porkbun to the two Cloudflare nameservers
4. Create a Cloudflare Tunnel in the Zero Trust dashboard
5. Map the tunnel's public hostname to `http://portal:3000`
6. Copy the tunnel token into `.env`

## Authentication

Replace Supabase Auth with a PIN-based login. This is a private household
app for two people — no email/password complexity needed.

### Login Flow

1. User visits `axiominteract.com`
2. If no valid session cookie → redirect to `/login`
3. Login page shows a full-screen 4-digit PIN keypad
4. User enters their PIN → POST to `/api/auth/login`
5. Server hashes the PIN, matches against the `users` table
6. On match → create a signed/encrypted session cookie via `iron-session`
7. Redirect to `/dashboard`

### Session Management

- **Library:** `iron-session` (encrypted cookies, no server-side session store)
- **Cookie:** `portal-session`, HttpOnly, Secure, SameSite=Lax, 30-day expiry
- **Middleware:** Check for valid session cookie on every request. Invalid or
  missing → redirect to `/login`. Exclude `/login`, `/api/auth/*`, static assets.
- **Logout:** Clear the cookie

### Users

Two users, stored in a `users` table:

| Field        | Type    | Notes                        |
|--------------|---------|------------------------------|
| id           | uuid    | Primary key                  |
| name         | text    | "Alex" or "Emine"            |
| pin_hash     | text    | bcrypt hash of 4-digit PIN   |
| role         | text    | "admin" (both users)         |
| created_at   | timestamp | Default now()              |

PINs are never stored in plaintext. Hashed with bcrypt on initial seed.

## Database Migration

### ORM: Drizzle

Replace all `supabase.from().select()` calls with Drizzle ORM queries.

**Why Drizzle:**
- TypeScript-first, generates types from schema
- SQL-like syntax (close to what Supabase's PostgREST does)
- Lightweight — no heavy runtime like Prisma's query engine
- Built-in migration support (`drizzle-kit`)

### Schema

Define Drizzle schema files matching the existing Supabase tables:
- `users` (new — replaces Supabase auth.users)
- `transactions`
- `categories`
- `category_rules`
- `accounts`
- `plaid_items`

Each table gets a Drizzle schema definition in `src/db/schema/`.

### Migration Strategy

1. Export cloud Supabase data with `pg_dump` (data only, no auth schema)
2. Generate Drizzle migrations from the schema definitions
3. Run migrations against the local PostgreSQL container
4. Import the dumped data with `psql`
5. Seed the `users` table with Alex and Emine (hashed PINs)

### Code Changes

Files that currently import from `@/shared/lib/supabase/*`:
- Replace `createClient()` with a Drizzle database instance
- Replace `supabase.from("table").select()` with `db.select().from(table)`
- Replace `supabase.auth.getUser()` with session cookie lookup
- Remove `@supabase/ssr`, `@supabase/supabase-js` dependencies
- Remove `middleware.ts` Supabase session refresh, replace with
  `iron-session` cookie check

### Database Connection

- Drizzle connects via `postgres` (postgres-js by porsager) using a
  connection string from the `DATABASE_URL` environment variable
- NPM packages: `drizzle-orm`, `postgres`, `drizzle-kit` (dev)
- Connection string: `postgresql://portal:$PASSWORD@db:5432/portal`
- postgres-js handles connection pooling internally (default max 10,
  more than enough for 2 users)

## Backups

### Daily pg_dump

Use Synology Task Scheduler (DSM Control Panel → Task Scheduler) to run
a backup script daily at 3:00 AM Pacific:
  ```
  docker exec smolowe-db pg_dump -U portal portal | gzip > /volume1/backups/portal/portal-$(date +%Y%m%d).sql.gz
  ```
- Retention: keep last 7 days. The same script deletes dumps older than
  7 days with `find ... -mtime +7 -delete`

### Offsite Sync

- Install Synology **Cloud Sync** package from Package Center
- Connect to Dropbox
- Sync `/volume1/backups/portal/` → Dropbox folder `Backups/portal/`
- Direction: upload only (NAS → Dropbox)
- Cloud Sync runs continuously — new dump files sync within minutes

## PWA

Update the existing PWA configuration for the new domain:

- **`src/app/manifest.ts`:** Update `start_url`, `scope`, `name` fields
- **Icons:** Generate PWA icon set (192x192, 512x512) from
  `smolowe_app_logo.png`
- **Theme color:** Match `--bg-primary` from the design system (`#0A0A0B`)
- **`next.config.ts`:** Add `output: "standalone"` for Docker builds

After deployment, Alex and Emine add to iPhone home screen:
Safari → Share → Add to Home Screen

## Dockerfile

Multi-stage build for minimal image size:

```
Stage 1: node:22-alpine — install deps, run `next build`
Stage 2: node:22-alpine — copy standalone output, run `next start`
```

Using `output: "standalone"` in Next.js config produces a self-contained
server that doesn't need `node_modules` at runtime.

## Environment Variables

Stored in `.env` on the NAS (never committed to git):

| Variable              | Purpose                          |
|-----------------------|----------------------------------|
| `DATABASE_URL`        | PostgreSQL connection string     |
| `IRON_SESSION_SECRET` | 32-character secret for cookies  |
| `CLOUDFLARE_TOKEN`    | Tunnel authentication token      |
| `PLAID_CLIENT_ID`     | Plaid API (existing)             |
| `PLAID_SECRET`        | Plaid API (existing)             |
| `PLAID_ENV`           | Plaid environment (sandbox/prod) |

## Deployment Workflow

After initial setup, updating the portal:

1. Push code changes to `main` on GitHub
2. SSH into the NAS (or use DSM terminal)
3. `cd /volume1/docker/smolowe-portal && git pull`
4. `docker compose up --build -d`

This could later be automated with a GitHub Actions workflow that builds
the Docker image and pushes to a registry, but manual deployment is fine
for a household app.

## Decommission Checklist

After the self-hosted portal is verified working:

1. Verify `axiominteract.com` loads the portal from the NAS
2. Verify both PINs work on phones
3. Verify data matches cloud Supabase
4. Verify backups are landing in Dropbox
5. Delete the Vercel project
6. Pause or delete the cloud Supabase project
7. Remove Vercel-specific config from the codebase if any

## Out of Scope

- **Phase 3 (cameras):** PoE cameras, Frigate, motion detection — future work
- **Custom domain email:** No email sending from this domain
- **CI/CD pipeline:** Manual deploy is sufficient for now
- **Multi-device sync / Realtime:** Not needed for 2 users
- **HTTPS on LAN:** Cloudflare handles HTTPS for external access; local
  LAN access is HTTP on port 3000 (acceptable for a private network)
