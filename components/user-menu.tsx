"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { signOut } from "@/lib/auth-client"
import { useRouter } from "next/navigation"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")
}

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { resolvedTheme, setTheme } = useTheme()
  const router = useRouter()

  useEffect(() => setMounted(true), [])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function handleSignOut() {
    await signOut()
    router.push("/login")
  }

  const avatar = (
    <button
      onClick={() => setOpen((v) => !v)}
      className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-xs font-semibold shrink-0 hover:opacity-80 transition-opacity"
      aria-label="User menu"
    >
      {initials(name)}
    </button>
  )

  return (
    <div ref={ref} className="relative shrink-0">
      {avatar}

      {open && (
        <div className="absolute right-0 top-9 w-56 rounded-xl border border-input bg-card shadow-lg py-1 z-50">
          {/* User info */}
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-foreground truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            {mounted && resolvedTheme === "dark" ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
                Switch to light mode
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
                Switch to dark mode
              </>
            )}
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
