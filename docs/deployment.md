# NAS Deployment

The NAS should run containers and hold local data. It should not build the
Next.js app for normal deployments.

## Flow

1. Push to `main`.
2. GitHub Actions builds `ghcr.io/asmolowe5/household_app:latest`.
3. The NAS pulls that image and restarts the `portal` container.
4. Postgres data remains in the local Docker volume on the NAS.

## First-Time GHCR Login On The NAS

If `docker-compose pull portal` says the image is unauthorized, create a GitHub
personal access token with `read:packages`, then run:

```sh
echo "YOUR_TOKEN" | sudo docker login ghcr.io -u asmolowe5 --password-stdin
```

## Deploy

From `/volume1/docker/smolowe-portal`:

```sh
sh scripts/deploy.sh
```

The script runs:

```sh
sudo docker-compose pull portal
sudo docker-compose up -d
sudo docker-compose ps
```

It also checks:

```sh
http://127.0.0.1:3000/api/health
```

## Emergency Local Build

If GitHub Container Registry is unavailable, the NAS can still build locally:

```sh
sudo docker-compose -f docker-compose.yml -f docker-compose.build.yml up --build -d
```

Normal deployments should use the prebuilt image path.

## Cloudflare Access

Cloudflare Tunnel should continue routing `axiominteract.com` to:

```text
http://portal:3000
```

Cloudflare Access can be added later in front of the app. Keep the app PIN login
even after Access is enabled.
