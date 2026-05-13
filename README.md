# Household Portal

Private, self-hosted household management portal built with Next.js, local
PostgreSQL, Docker Compose, and Cloudflare Tunnel.

The intended production shape is:

1. Code is pushed to `main`.
2. GitHub Actions builds a container image in GitHub Container Registry.
3. The NAS pulls the prebuilt image.
4. PostgreSQL data and all secrets stay local on the NAS.
5. Cloudflare Tunnel routes a private domain to the app container.

Start here for future maintenance:

- [Current state](docs/current-state.md)
- [Deployment runbook](docs/deployment.md)

## Local Development

```sh
npm install
npm run dev
```

Local development needs a database connection and secrets in `.env.local`.
Do not commit real `.env` files.

## Production Deployment

Normal production deploys should run from the project directory on the NAS:

```sh
sh scripts/deploy.sh
```

The deploy script pulls the latest image, starts the database, applies database
migrations, starts all services, and checks `/api/health`.

