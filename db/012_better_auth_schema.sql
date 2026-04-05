-- Migration 012: Better Auth schema
--
-- Creates the auth tables that better-auth manages.
-- This mirrors what `npx @better-auth/cli@latest migrate` generates so that
-- Docker deployments can run all migrations in a single `bash db/migrate.sh`
-- call without needing the Better Auth CLI at runtime.
--
-- If you upgrade better-auth and its schema changes, regenerate this file with:
--   npx @better-auth/cli@latest generate --output /tmp/ba.sql
-- then update below accordingly.
--
-- All statements are idempotent — safe to run against a database where
-- these tables were already created by the CLI.

CREATE TABLE IF NOT EXISTS "user" (
    id           TEXT NOT NULL PRIMARY KEY,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL,
    "emailVerified"  BOOLEAN NOT NULL DEFAULT false,
    image        TEXT,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_email_unique UNIQUE (email)
);

-- Custom field: system admin flag
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS system_admin BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS session (
    id           TEXT NOT NULL PRIMARY KEY,
    "expiresAt"  TIMESTAMPTZ NOT NULL,
    token        TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "userId"     TEXT NOT NULL,
    CONSTRAINT session_token_unique UNIQUE (token),
    CONSTRAINT "session_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
    id                       TEXT NOT NULL PRIMARY KEY,
    "accountId"              TEXT NOT NULL,
    "providerId"             TEXT NOT NULL,
    "userId"                 TEXT NOT NULL,
    "accessToken"            TEXT,
    "refreshToken"           TEXT,
    "idToken"                TEXT,
    "accessTokenExpiresAt"   TIMESTAMPTZ,
    "refreshTokenExpiresAt"  TIMESTAMPTZ,
    scope                    TEXT,
    password                 TEXT,
    "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "account_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification (
    id          TEXT NOT NULL PRIMARY KEY,
    identifier  TEXT NOT NULL,
    value       TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
