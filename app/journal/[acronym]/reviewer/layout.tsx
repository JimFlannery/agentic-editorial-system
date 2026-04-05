import Link from "next/link"
import { notFound } from "next/navigation"
import { sql } from "@/lib/graph"
import { cn } from "@/lib/utils"
import { requireRole } from "@/lib/auth-helpers"
import { UserMenu } from "@/components/user-menu"
import { HelpPanel } from "@/components/help-panel"
import { JournalSelector } from "./journal-selector"
import { RoleSelector } from "../editorial/role-selector"

interface Journal {
  id: string
  name: string
  acronym: string
}

export default async function ReviewerLayout({
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

  const { user } = await requireRole(journal.id, ["reviewer"], `/journal/${acronym}/reviewer`)

  const base = `/journal/${journal.acronym}/reviewer`

  const navItems = [
    { href: base,               label: "My Reviews" },
    { href: `${base}/profile`,  label: "My Profile" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto px-6">
        {/* Top bar */}
        <header className="border-b border-border py-3 flex items-center gap-4">
          <Link
            href="/"
            className="font-semibold text-foreground tracking-tight text-sm"
          >
            Agentic<em style={{ color: "#4f46e5", fontStyle: "italic" }}>ES</em>
          </Link>
          <span className="text-border">·</span>
          <JournalSelector journals={allJournals} current={journal.acronym} />
          <span className="text-border">·</span>
          <RoleSelector acronym={journal.acronym} />
          <div className="ml-auto flex items-center gap-3">
            <HelpPanel />
            <UserMenu name={user.name} email={user.email} />
          </div>
        </header>

        <div className="flex gap-8 py-8">
          {/* Sidebar */}
          <nav className="w-48 shrink-0">
            <Link
              href={`/journal/${journal.acronym}`}
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors block"
            >
              {journal.acronym}
            </Link>
            <ul className="space-y-0.5">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block px-3 py-2 rounded-lg text-sm text-muted-foreground",
                      "hover:bg-muted hover:text-foreground",
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
