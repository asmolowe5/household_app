#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

read_env_value() {
  if [ -f .env ]; then
    grep "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '\r'
  fi
}

# Daily pg_dump backup with 7-day retention
# Schedule via Synology DSM Task Scheduler at 3:00 AM

BACKUP_DIR="/volume1/backups/portal"
CONFIGURED_DB_CONTAINER="$(read_env_value DB_CONTAINER_NAME)"
CONTAINER="${DB_CONTAINER_NAME:-${CONFIGURED_DB_CONTAINER:-household-db}}"
DB_USER="portal"
DB_NAME="portal"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

FILENAME="portal-$(date +%Y%m%d).sql.gz"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
  echo "Backup saved: $BACKUP_DIR/$FILENAME"
else
  echo "Backup FAILED" >&2
  exit 1
fi

find "$BACKUP_DIR" -name "portal-*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "Cleaned backups older than $RETENTION_DAYS days"
