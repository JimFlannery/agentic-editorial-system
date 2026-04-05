import Link from "next/link"
import { notFound } from "next/navigation"
import { sql } from "@/lib/graph"
import { cn } from "@/lib/utils"
import { requireRole } from "@/lib/auth-helpers"
import { UserMenu } from "@/components/user-menu"
import { HelpPanel } from "@/components/help-panel"
import { JournalSelector } from "./journal-selector"

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

  const { user } = await requireRole(
    journal.id,
    ["journal_admin"],
    `/journal/${journal.acronym}/admin`
  )

  const base = `/journal/${journal.acronym}/admin`

  const navItems = [
    { href: base,                          label: "Dashboard" },
    { href: `${base}/manuscript-types`,    label: "Manuscript Types" },
    { href: `${base}/form-fields`,         label: "Form Fields" },
    { href: `${base}/sections`,            label: "Sections" },
    { href: `${base}/workflows`,           label: "Workflows" },
    { href: `${base}/workflow`,            label: "Workflow Config" },
    { href: `${base}/email-templates`,     label: "Email Templates" },
    { href: `${base}/users`,               label: "Users" },
    { href: `${base}/troubleshooting`,     label: "Troubleshooting" },
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
            Agentic<em style={{ color: "#4f46e5", fontStyle: "italic" }}>ES</em>
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <JournalSelector journals={allJournals} current={journal.acronym} />
          <Link
            href={`/journal/${journal.acronym}/editorial`}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ← Editorial Workspace
          </Link>
          <Link
            href="/admin"
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            System Admin
          </Link>
          <HelpPanel />
          <UserMenu name={user.name} email={user.email} />
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
