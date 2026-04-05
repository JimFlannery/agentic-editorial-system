/**
 * Global auth setup — runs once before any role-specific tests.
 *
 * Authenticates via the Better Auth API directly (POST /api/auth/sign-in/email)
 * rather than through the browser UI. This avoids the Next.js dev overlay
 * (<nextjs-portal>) which intercepts pointer events in development mode and
 * makes button clicks unreliable.
 *
 * The resulting session cookie is saved to tests/.auth/ and reused by all
 * role-specific test projects.
 */

import { test as setup } from "@playwright/test"
import path from "path"

const USERS = [
  { email: "author1@test.example.com",   file: "author.json"   },
  { email: "ae@test.example.com",        file: "ae.json"       },
  { email: "eic@test.example.com",       file: "eic.json"      },
  { email: "reviewer1@test.example.com", file: "reviewer.json" },
]

for (const { email, file } of USERS) {
  setup(`authenticate: ${email}`, async ({ page }) => {
    // Use page.request so the session cookie from Better Auth lands in the
    // page's browser context (the standalone `request` fixture has its own
    // isolated cookie jar and does NOT share with the page).
    const res = await page.request.post("/api/auth/sign-in/email", {
      data: { email, password: "password" },
      headers: { "Content-Type": "application/json" },
    })

    if (!res.ok()) {
      const body = await res.text()
      throw new Error(`Sign-in failed for ${email}: HTTP ${res.status()} — ${body}`)
    }

    // Navigate to home to confirm we have a valid session before saving state.
    await page.goto("/")
    if (page.url().includes("/login")) {
      throw new Error(`Session cookie not applied for ${email} — still on /login after sign-in`)
    }

    const stateFile = path.join(__dirname, "../.auth", file)
    await page.context().storageState({ path: stateFile })
  })
}
