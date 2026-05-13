#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "Missing .env in $ROOT_DIR" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Docker Compose is not installed." >&2
  exit 1
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

echo "Pulling portal image..."
$SUDO $COMPOSE pull portal

echo "Starting services..."
$SUDO $COMPOSE up -d

echo "Current containers:"
$SUDO $COMPOSE ps

if command -v curl >/dev/null 2>&1; then
  echo "Checking portal health..."
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS http://127.0.0.1:3000/api/health; then
      echo
      echo "Deployment healthy."
      exit 0
    fi
    echo "Health check attempt $attempt failed; retrying..."
    sleep 3
  done

  echo "Deployment finished, but health check did not pass." >&2
  exit 1
fi

echo "curl is not installed; skipped health check."
