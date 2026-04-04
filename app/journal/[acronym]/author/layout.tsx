import Link from "next/link"
import { notFound } from "next/navigation"
import { sql } from "@/lib/graph"
import { cn } from "@/lib/utils"
import { requireRole } from "@/lib/auth-helpers"
import { UserMenu } from "@/components/user-menu"
import { JournalSelector } from "./journal-selector"
import { RoleSelector } from "../editorial/role-selector"

interface Journal {
  id: string
  name: string
  acronym: string
}

export default async function AuthorLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  const [journalRows, allJournals] = await Promise.all([
    sql<Journal>(
      "SELECT id, name, acronym FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
      [acronym]
    ),
    sql<Journal>(
      "SELECT id, name, acronym FROM manuscript.journals ORDER BY name"
    ),
  ])

  const journal = journalRows[0]
  if (!journal) notFound()

  const { user } = await requireRole(journal.id, ["author"], `/journal/${acronym}/author`)

  const base = `/journal/${journal.acronym}/author`

  const navItems = [
    { href: base,              label: "My Submissions" },
    { href: `${base}/submit`,  label: "New Submission" },
    { href: `${base}/profile`, label: "My Profile" },
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-screen-xl mx-auto px-6">
        {/* Top bar */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight text-sm"
          >
            Agentic Editorial System
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <JournalSelector journals={allJournals} current={journal.acronym} />
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <RoleSelector acronym={journal.acronym} />
          <div className="ml-auto">
            <UserMenu name={user.name} email={user.email} />
          </div>
        </header>

        <div className="flex gap-8 py-8">
          {/* Sidebar */}
          <nav className="w-48 shrink-0">
            <Link
              href={`/journal/${journal.acronym}`}
              className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors block"
            >
              {journal.acronym}
            </Link>
            <ul className="space-y-0.5">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block px-3 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400",
                      "hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100",
                      "transition-colors"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Page content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  )
}
