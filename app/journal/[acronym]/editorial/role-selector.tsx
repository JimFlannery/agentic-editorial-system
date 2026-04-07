"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ROLES = [
  { label: "Author",            path: (a: string) => `/journal/${a}/author` },
  { label: "Reviewer",          path: (a: string) => `/journal/${a}/reviewer` },
  { label: "Assistant Editor",  path: (a: string) => `/journal/${a}/editorial/assistant-editor` },
  { label: "Editor",            path: (a: string) => `/journal/${a}/editorial/editor` },
  { label: "Editor-in-Chief",   path: (a: string) => `/journal/${a}/editorial/editor-in-chief` },
  { label: "Editorial Support", path: (a: string) => `/journal/${a}/editorial/editorial-support` },
  { label: "Journal Admin",     path: (a: string) => `/journal/${a}/admin` },
]

export function RoleSelector({ acronym }: { acronym: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const currentRole = pathname
    ? ROLES.find((r) => {
        const p = r.path(acronym)
        return pathname === p || pathname.startsWith(p + "/")
      })
    : undefined

  const current = currentRole?.path(acronym) ?? ""

  return (
    <Select value={current} onValueChange={(value) => { if (value) router.push(value) }}>
      <SelectTrigger className="w-44 h-7 text-xs border-zinc-200 dark:border-zinc-700 bg-transparent">
        <SelectValue placeholder="Switch role…">{currentRole?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r.label} value={r.path(acronym)} className="text-xs">
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
