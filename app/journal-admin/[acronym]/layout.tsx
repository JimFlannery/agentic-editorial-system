import Link from "next/link"
import { notFound } from "next/navigation"
import { sql } from "@/lib/graph"
import { cn } from "@/lib/utils"
import { JournalSelector } from "./journal-selector"
import { RoleSelector } from "./role-selector"

interface Journal {
  id: string
  name: string
  acronym: string
}

export default async function JournalAcronymLayout({
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

  const base = `/journal-admin/${journal.acronym}`

  const navItems = [
    { href: base,                                  label: "Dashboard" },
    { href: `${base}/queue`,                       label: "Checklist Queue" },
    { href: `${base}/assistant-editor`,            label: "Assistant Editor" },
    { href: `${base}/editor`,                      label: "Editor" },
    { href: `${base}/editor-in-chief`,             label: "Editor-in-Chief" },
    { href: `${base}/editorial-support`,           label: "Editorial Support" },
    { href: `${base}/manuscript-types`,            label: "Manuscript Types" },
    { href: `${base}/workflows`,                   label: "Workflows" },
    { href: `${base}/workflow`,                    label: "Workflow Config" },
    { href: `${base}/email-templates`,             label: "Email Templates" },
    { href: `${base}/users`,                       label: "Users" },
    { href: `${base}/troubleshooting`,             label: "Troubleshooting" },
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-screen-xl mx-auto px-6">
        {/* Top bar */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 py-3 flex items-center gap-4">
          <Link
            href={base}
            className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight text-sm"
          >
            Agentic Editorial System
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <JournalSelector journals={allJournals} current={journal.acronym} />
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <RoleSelector acronym={journal.acronym} />
          <Link
            href="/admin"
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            System Admin
          </Link>
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ← Back to app
          </Link>
        </header>

        <div className="flex gap-8 py-8">
          {/* Sidebar */}
          <nav className="w-48 shrink-0">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              {journal.acronym}
            </p>
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
