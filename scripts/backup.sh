#!/bin/bash
# Daily pg_dump backup with 7-day retention
# Schedule via Synology DSM Task Scheduler at 3:00 AM

BACKUP_DIR="/volume1/backups/portal"
CONTAINER="smolowe-db"
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
