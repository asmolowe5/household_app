#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${PRIMARY_USER_PIN:?PRIMARY_USER_PIN is required}"
: "${SECONDARY_USER_PIN:?SECONDARY_USER_PIN is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_address text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

WITH ranked_users AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS position
  FROM users
)
UPDATE users
SET pin_hash = crypt('${PRIMARY_USER_PIN}', gen_salt('bf'))
FROM ranked_users
WHERE users.id = ranked_users.id
  AND ranked_users.position = 1;

WITH ranked_users AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS position
  FROM users
)
UPDATE users
SET pin_hash = crypt('${SECONDARY_USER_PIN}', gen_salt('bf'))
FROM ranked_users
WHERE users.id = ranked_users.id
  AND ranked_users.position = 2;
SQL
