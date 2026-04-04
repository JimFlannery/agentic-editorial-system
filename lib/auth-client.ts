"use client"

import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"
import type { auth } from "./auth"

export const authClient = createAuthClient({
  // In development this is http://localhost:3000
  // Set NEXT_PUBLIC_APP_URL in .env.local for other environments
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [inferAdditionalFields<typeof auth>()],
})

export const { useSession, signIn, signOut, signUp } = authClient
