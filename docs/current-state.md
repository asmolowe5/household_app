# Current State

Last reviewed: 2026-05-13

This project is the local-first foundation for a private household portal. The
current goal is a stable authenticated dashboard hosted on a NAS, with local
data storage and room to add finance, camera, calendar, and smart-home modules.

## Runtime Architecture

Production runs through Docker Compose on the NAS:

- `portal`: Next.js standalone production server on port `3000`.
- `db`: PostgreSQL 16 with a named Docker volume for persistent data.
- `tunnel`: Cloudflare Tunnel, routing the public/private hostname to
  `http://portal:3000` inside the Docker network.

The NAS owns all persistent state:

- Database data lives in the Docker `pgdata` volume.
- Secrets live only in the NAS `.env` file.
- Optional database backups are written by `scripts/backup.sh`.

## Request Flow

1. Browser opens the configured hostname.
2. Cloudflare Tunnel forwards traffic to the `portal` service.
3. The app redirects unauthenticated users to `/login`.
4. `/api/auth/login` checks the 8-digit PIN against bcrypt hashes in Postgres.
5. A successful login creates an `iron-session` cookie.
6. Authenticated users reach `/dashboard`.

The app currently keeps sessions for 30 days. To force every browser to log in
again, rotate `IRON_SESSION_SECRET` in the NAS `.env` and redeploy.

## Auth State

The current app-level auth model is intentionally small:

- Two local users seeded in Postgres.
- 8-digit PINs read from `.env` during database initialization and deploy-time
  auth migrations.
- Bcrypt-hashed PINs stored in the `users` table.
- Failed login attempts tracked by IP in `login_attempts`.
- Five failed attempts within ten minutes locks that IP/device out for ten
  minutes.

Cloudflare Access can still be added in front of the app later. Keep the app
PIN auth even if Cloudflare Access is enabled.

## Database State

The active database is local PostgreSQL, not Supabase. The schema currently
includes:

- `users`
- `login_attempts`
- `plaid_items`
- `accounts`
- `categories`
- `category_rules`
- `transactions`

`docker/postgres/init/001_schema.sh` initializes a fresh database volume.
`docker/postgres/migrations/*` scripts are rerun by `scripts/deploy.sh`; the
current auth migration is intentionally repeatable so PIN rotation can be
applied by changing `.env` and redeploying.

## Deployment Pipeline

The normal pipeline is:

1. Merge or push code to `main`.
2. GitHub Actions runs `.github/workflows/docker-image.yml`.
3. The workflow builds the Docker image and pushes:
   - `latest`
   - `sha-<short-sha>`
4. NAS operator pulls code with `sudo git pull`.
5. NAS operator runs `sh scripts/deploy.sh`.
6. The script pulls the configured image and checks:
   - `http://127.0.0.1:3000/api/health`

The image name and container names are controlled by `.env`, so the public repo
does not need to expose local naming choices.

## Secrets Boundary

Tracked files may include variable names and placeholders only. Real values
belong in `.env` on the NAS or `.env.local` for local development.

Do not commit or paste these values:

- `DB_PASSWORD`
- `IRON_SESSION_SECRET`
- `PRIMARY_USER_PIN`
- `SECONDARY_USER_PIN`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `CRON_SECRET`
- `CLOUDFLARE_TOKEN`

To confirm values exist without printing them:

```sh
awk -F= '/^(DB_PASSWORD|IRON_SESSION_SECRET|PRIMARY_USER_PIN|SECONDARY_USER_PIN|PLAID_CLIENT_ID|PLAID_SECRET|CRON_SECRET|CLOUDFLARE_TOKEN)=/ {
  print $1, length($2) " chars"
}' .env
```

## Current Product Surface

Working:

- `/login`
- `/dashboard`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/health`
- Docker/GHCR/NAS deploy pipeline

Partially built but not fully wired as a product flow:

- Finance module components and Plaid API routes exist.
- A `/finance` layout exists, but there is no committed `/finance/page.tsx`.
- Plaid sync and transaction review code should be verified end to end before
  connecting production financial data.

Not built yet:

- Security camera module.
- Smart-home controls.
- Calendar module.
- Cloudflare Access policy in front of the app.
- Automated NAS cron for Plaid sync.

## Refactor And Cleanup Backlog

Recommended next engineering passes, in order:

1. Add a real module shell/navigation decision.
   The repo has an unused `PortalShell`/sidebar/mobile-tab layout, while the
   active portal layout is a simpler header. Pick one direction before adding
   multiple modules.

2. Finish or remove the finance route.
   The finance components are present, but `/finance` does not yet render a
   page. Add a page and verify Plaid sandbox end to end before using production
   Plaid.

3. Add NAS scheduled jobs.
   Configure Synology Task Scheduler for database backups and, later, Plaid
   sync. Keep commands documented in `docs/deployment.md`.

4. Add camera integration behind server-side routes.
   Do not expose camera URLs or credentials to the browser. The app should act
   as the authenticated gateway.

5. Add app-level audit events before expanding controls.
   For cameras and smart-home actions, store who did what and when.

6. Add tests around auth and deployment-sensitive behavior.
   Good first tests: PIN lockout, session creation, health check database
   failure, and Plaid route authorization.

