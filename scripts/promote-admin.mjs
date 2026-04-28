#!/usr/bin/env node
// Promote an existing user to system admin.
//
// Usage:
//   npm run admin:promote -- --email=user@example.org
//
// Notes:
//   - Promote-only. The user must already exist (registered via the Sign up tab on /login).
//   - Reads DATABASE_URL from the environment. For local dev this is in .env.local;
//     load it via `node --env-file=.env.local` or run via `npm run admin:promote`
//     after exporting DATABASE_URL.
//   - Safe to run multiple times. Idempotent.

import { Pool } from "pg"

function parseEmailArg() {
  const args = process.argv.slice(2)
  for (const arg of args) {
    if (arg.startsWith("--email=")) return arg.slice("--email=".length).trim()
    if (arg === "--email") {
      const next = args[args.indexOf(arg) + 1]
      if (next) return next.trim()
    }
  }
  return null
}

async function main() {
  const email = parseEmailArg()
  if (!email) {
    console.error("Error: --email=<address> is required")
    console.error("Usage: npm run admin:promote -- --email=user@example.org")
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set in the environment")
    console.error("Tip: run via `node --env-file=.env.local scripts/promote-admin.mjs --email=...`")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const result = await pool.query(
      'UPDATE "user" SET system_admin = true WHERE LOWER(email) = LOWER($1) RETURNING id, email, system_admin',
      [email]
    )

    if (result.rowCount === 0) {
      console.error(`Error: no user found with email "${email}"`)
      console.error("Register the account via the Sign up tab on /login first, then re-run this command.")
      process.exit(2)
    }

    const user = result.rows[0]
    console.log(`Promoted ${user.email} (id: ${user.id}) to system admin.`)
  } catch (err) {
    console.error("Error promoting user:", err.message)
    process.exit(3)
  } finally {
    await pool.end()
  }
}

main()
