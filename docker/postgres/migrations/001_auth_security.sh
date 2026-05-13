#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${ALEX_PIN:?ALEX_PIN is required}"
: "${EMINE_PIN:?EMINE_PIN is required}"

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

UPDATE users
SET pin_hash = crypt('${ALEX_PIN}', gen_salt('bf'))
WHERE name = 'Alex';

UPDATE users
SET pin_hash = crypt('${EMINE_PIN}', gen_salt('bf'))
WHERE name = 'Emine';
SQL
