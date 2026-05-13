# Deployment Runbook

This app is deployed as a prebuilt Docker image to a NAS. The NAS should run
containers and hold local data. It should not build the Next.js app during
normal deployments.

## Normal Flow

1. Push to `main`.
2. GitHub Actions builds and pushes a GitHub Container Registry image.
3. Wait for the GitHub Actions build to finish successfully.
4. SSH into the NAS.
5. Pull the latest repo changes.
6. Run `scripts/deploy.sh`.
7. Confirm `/api/health` returns `ok: true`.

## NAS Project Directory

Use the directory where the repo is checked out on the NAS:

```sh
cd /volume1/docker/household-portal
```

If the local folder has a different name, use that folder instead.

## Required NAS `.env`

The NAS `.env` file must contain real values for these keys:

```sh
PORTAL_IMAGE=ghcr.io/YOUR_GITHUB_USER/YOUR_REPO:latest
DB_CONTAINER_NAME=household-db
PORTAL_CONTAINER_NAME=household-portal
TUNNEL_CONTAINER_NAME=household-tunnel

DB_PASSWORD=...
IRON_SESSION_SECRET=...
PRIMARY_USER_PIN=...
SECONDARY_USER_PIN=...
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox
CRON_SECRET=...
CLOUDFLARE_TOKEN=...
MEDIAMTX_CONTAINER_NAME=household-mediamtx
MEDIAMTX_PUBLISH_SECRET=...
```

Do not commit the real `.env`.

Confirm required values exist without printing secrets:

```sh
awk -F= '/^(PORTAL_IMAGE|DB_CONTAINER_NAME|PORTAL_CONTAINER_NAME|TUNNEL_CONTAINER_NAME|DB_PASSWORD|IRON_SESSION_SECRET|PRIMARY_USER_PIN|SECONDARY_USER_PIN|PLAID_CLIENT_ID|PLAID_SECRET|CRON_SECRET|CLOUDFLARE_TOKEN)=/ {
  print $1, length($2) " chars"
}' .env
```

## First-Time GHCR Login On The NAS

Public packages usually do not need login. If `docker-compose pull portal`
says the image is unauthorized, create a GitHub personal access token with
`read:packages`, then run:

```sh
echo "YOUR_TOKEN" | sudo docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## Deploy

From the project directory on the NAS:

```sh
sudo git pull
sh scripts/deploy.sh
```

The script:

- Checks required `.env` keys.
- Confirms both PINs are exactly 8 digits.
- Pulls the configured `portal` image.
- Starts the database.
- Applies repeatable database migration scripts.
- Starts all services.
- Prints container status.
- Checks `http://127.0.0.1:3000/api/health`.

## Health Check

Expected healthy response shape:

```json
{
  "ok": true,
  "app": "household-portal",
  "version": "git-sha-or-unknown",
  "database": "ok"
}
```

If health fails, inspect:

```sh
sudo docker-compose ps
sudo docker-compose logs --tail=100 portal
sudo docker-compose logs --tail=100 db
sudo docker-compose logs --tail=100 tunnel
sudo docker-compose logs --tail=100 mediamtx
```

## PIN Rotation

Change PIN values in `.env`:

```sh
PRIMARY_USER_PIN=12345678
SECONDARY_USER_PIN=87654321
```

Then deploy:

```sh
sh scripts/deploy.sh
```

The repeatable auth migration updates the stored bcrypt hashes.

To force all browsers to log in again, also rotate `IRON_SESSION_SECRET`.

## Database Backups

Run a manual backup from the NAS project directory:

```sh
bash scripts/backup.sh
```

The script reads `DB_CONTAINER_NAME` from `.env`, writes a compressed dump to
`/volume1/backups/portal`, and deletes backups older than seven days.

Suggested Synology Task Scheduler command:

```sh
cd /volume1/docker/household-portal && bash scripts/backup.sh
```

Use the real NAS project path if it differs.

## Emergency Local Build

If GitHub Container Registry is unavailable, the NAS can still build locally:

```sh
sudo docker-compose -f docker-compose.yml -f docker-compose.build.yml up --build -d
```

Normal deployments should use the prebuilt image path.

## Cloudflare Tunnel

Cloudflare Tunnel should route the configured hostname to:

```text
http://portal:3000
```

Cloudflare Access can be added later in front of the app. Keep the app PIN login
even after Access is enabled.

## Camera Streaming

The portal's camera streaming pipeline depends on the `mediamtx` container.
See `docs/streaming.md` for the end-to-end runbook (Windows-side setup,
starting streams, troubleshooting).

To verify MediaMTX is up:

```sh
sudo docker-compose ps mediamtx
sudo docker-compose logs --tail=20 mediamtx
```

MediaMTX listens for RTSP publishes on `:8554` (LAN-only) and serves HLS on
`:8888` (Docker-network-only — never exposed to the host or to Cloudflare).
The portal proxies HLS through `/api/streams/<name>/...` and applies session
auth.
