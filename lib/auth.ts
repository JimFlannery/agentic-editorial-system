import { betterAuth } from "better-auth"
import { Pool } from "pg"

// Separate pool for Better Auth — it manages its own tables in the public schema.
// Uses the same DATABASE_URL as the rest of the app.
declare global {
  // eslint-disable-next-line no-var
  var _authPool: Pool | undefined
}

function getAuthPool(): Pool {
  if (!global._authPool) {
    global._authPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      keepAlive: true,
      idleTimeoutMillis: 30_000,
    })
    // Without an 'error' listener, an idle-client error crashes the Node
    // process. This logs and lets pg.Pool evict the bad client so the next
    // request gets a fresh connection.
    global._authPool.on("error", (err) => {
      console.error("[auth pool] idle client error:", err.message)
    })
  }
  return global._authPool
}

export const auth = betterAuth({
  database: getAuthPool(),

  emailAndPassword: {
    enabled: true,
  },

  user: {
    additionalFields: {
      // System administrators can access /admin and manage all journals.
      // Set manually via direct DB update or the system admin UI.
      system_admin: {
        type: "boolean",
        defaultValue: false,
        input: false,  // not user-settable
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // One-shot bootstrap: if INITIAL_ADMIN_EMAIL is set and there are no
        // system admins yet, the first user to register with that email is
        // auto-promoted. Once any admin exists, the env var is inert.
        //
        // This is the recommended first-install path. The CLI fallback
        // (`npm run admin:promote`) handles recovery and additional admins.
        after: async (user) => {
          const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
          if (!initialEmail) return
          if (user.email.trim().toLowerCase() !== initialEmail) return

          const pool = getAuthPool()
          try {
            const { rows } = await pool.query<{ count: string }>(
              'SELECT count(*)::text AS count FROM "user" WHERE system_admin = true'
            )
            // The new user is already in the table but has system_admin=false
            // (the default), so they aren't counted here. If any prior admin
            // exists, abort the auto-promote.
            if (parseInt(rows[0]?.count ?? "0", 10) > 0) return

            await pool.query(
              'UPDATE "user" SET system_admin = true WHERE id = $1',
              [user.id]
            )
            console.log(
              `[bootstrap] Promoted ${user.email} to system admin (matched INITIAL_ADMIN_EMAIL, no prior admins).`
            )
          } catch (err) {
            console.error("[bootstrap] Failed to auto-promote initial admin:", err)
          }
        },
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
