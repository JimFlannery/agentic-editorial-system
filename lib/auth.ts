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
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
