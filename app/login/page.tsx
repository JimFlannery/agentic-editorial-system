"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, signUp } from "@/lib/auth-client"

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/"

  // Extract journal acronym from the next URL if present
  // e.g. /journal/NEJM/author  → "NEJM"
  const journalAcronym = next.match(/^\/journal\/([^/]+)/)?.[1] ?? null

  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function switchMode(m: "signin" | "signup") {
    setMode(m)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === "signin") {
      const { error } = await signIn.email({ email, password, callbackURL: next })
      if (error) {
        setError(error.message ?? "Sign-in failed. Please check your credentials.")
        setLoading(false)
      } else {
        router.push(next)
      }
    } else {
      const { error } = await signUp.email({ name, email, password, callbackURL: next })
      if (error) {
        setError(error.message ?? "Sign-up failed. Please try again.")
        setLoading(false)
        return
      }

      // Auto-provision as author for the journal they signed up from
      if (journalAcronym) {
        await fetch("/api/provision-author", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journalAcronym }),
        })
      }

      router.push(next)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agentic<em style={{ color: "#4f46e5", fontStyle: "italic" }}>ES</em>
            {journalAcronym && (
              <> &middot; <span className="font-medium">{journalAcronym}</span></>
            )}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-input p-1 mb-6">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-medium text-foreground mb-1.5"
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent"
                placeholder="Dr. Jane Smith"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-foreground mb-1.5"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-foreground mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-foreground text-background text-sm font-medium py-2.5 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? mode === "signin" ? "Signing in…" : "Creating account…"
              : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "signup" && !journalAcronym && (
          <p className="mt-4 text-xs text-center text-muted-foreground">
            To be assigned a role on a journal, contact your editorial office after
            creating your account.
          </p>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  )
}
