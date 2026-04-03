"use client"

import { usePathname } from "next/navigation"

const ROLES = [
  { label: "Author",             path: (acronym: string) => `/author/${acronym}` },
  { label: "Reviewer",           path: (acronym: string) => `/reviewer/${acronym}` },
  { label: "Assistant Editor",   path: (acronym: string) => `/journal-admin/${acronym}/assistant-editor` },
  { label: "Editor",             path: (acronym: string) => `/journal-admin/${acronym}/editor` },
  { label: "Editor-in-Chief",    path: (acronym: string) => `/journal-admin/${acronym}/editor-in-chief` },
  { label: "Editorial Support",  path: (acronym: string) => `/journal-admin/${acronym}/editorial-support` },
]

export function RoleSelector({ acronym }: { acronym: string }) {
  const pathname = usePathname()

  const current = ROLES.find((r) => pathname.startsWith(r.path(acronym)))?.path(acronym) ?? ""

  return (
    <select
      className="appearance-none text-sm text-zinc-500 dark:text-zinc-400 bg-transparent border-none cursor-pointer focus:outline-none"
      value={current}
      onChange={(e) => { window.location.href = e.target.value }}
    >
      <option value="" disabled>Switch role…</option>
      {ROLES.map((r) => (
        <option key={r.label} value={r.path(acronym)}>{r.label}</option>
      ))}
    </select>
  )
}
