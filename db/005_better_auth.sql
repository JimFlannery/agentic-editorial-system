-- =============================================================================
-- Migration 005 — Better Auth tables + auth_user_id link
-- =============================================================================
-- Better Auth manages these tables in the public schema.
-- Run AFTER the Better Auth tables are generated via:
--   npx better-auth@latest generate --schema
-- Or apply this file directly — it matches the pg adapter schema.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Better Auth core tables (public schema)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public."user" (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    email             TEXT NOT NULL UNIQUE,
    "emailVerified"   BOOLEAN NOT NULL DEFAULT false,
    image             TEXT,
    "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
    -- custom field: system administrators can access /admin
    system_admin      BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.session (
    id              TEXT PRIMARY KEY,
    "expiresAt"     TIMESTAMP NOT NULL,
    token           TEXT NOT NULL UNIQUE,
    "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
    "ipAddress"     TEXT,
    "userAgent"     TEXT,
    "userId"        TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.account (
    id                          TEXT PRIMARY KEY,
    "accountId"                 TEXT NOT NULL,
    "providerId"                TEXT NOT NULL,
    "userId"                    TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    "accessToken"               TEXT,
    "refreshToken"              TEXT,
    "idToken"                   TEXT,
    "accessTokenExpiresAt"      TIMESTAMP,
    "refreshTokenExpiresAt"     TIMESTAMP,
    scope                       TEXT,
    password                    TEXT,
    "createdAt"                 TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"                 TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verification (
    id              TEXT PRIMARY KEY,
    identifier      TEXT NOT NULL,
    value           TEXT NOT NULL,
    "expiresAt"     TIMESTAMP NOT NULL,
    "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Link auth user to editorial identity
-- ---------------------------------------------------------------------------
-- One person can have accounts across multiple journals.
-- The auth_user_id links the Better Auth user to their manuscript.people record.

ALTER TABLE manuscript.people
    ADD COLUMN IF NOT EXISTS auth_user_id TEXT UNIQUE REFERENCES public."user"(id);
