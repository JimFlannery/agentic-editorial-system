import { notFound } from "next/navigation"
import Link from "next/link"
import { sql } from "@/lib/graph"

interface Journal {
  id: string
  name: string
  acronym: string
  issn: string | null
  subject_area: string | null
}

interface JournalSettings {
  logo_url?: string
  description?: string
  website_url?: string
  publisher?: string
}

async function getJournal(acronym: string): Promise<Journal | null> {
  const rows = await sql<Journal>(
    `SELECT id, name, acronym, issn, subject_area
     FROM manuscript.journals
     WHERE UPPER(acronym) = UPPER($1)`,
    [acronym]
  )
  return rows[0] ?? null
}

async function getSettings(journalId: string): Promise<JournalSettings> {
  try {
    const rows = await sql<{ key: string; value: string }>(
      `SELECT key, value FROM manuscript.journal_settings
       WHERE journal_id = $1
         AND key IN ('logo_url', 'description', 'website_url', 'publisher')`,
      [journalId]
    )
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  } catch {
    return {}
  }
}

const CENTERS = [
  {
    label: "Author Center",
    description: "Submit manuscripts, track status, and respond to revision requests.",
    href: (acronym: string) => `/journal/${acronym}/author`,
    soon: false,
  },
  {
    label: "Reviewer Center",
    description: "Access assigned manuscripts, submit reviews, and manage invitations.",
    href: (acronym: string) => `/journal/${acronym}/reviewer`,
    soon: false,
  },
  {
    label: "Editorial Center",
    description: "Manage submissions, run checklists, and route manuscripts through the workflow.",
    href: (acronym: string) => `/journal/${acronym}/editorial`,
    soon: false,
  },
  {
    label: "Journal Admin",
    description: "Configure manuscript types, workflows, email templates, and journal settings.",
    href: (acronym: string) => `/journal/${acronym}/admin`,
    soon: false,
  },
]

export default async function JournalLandingPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params
  const journal = await getJournal(acronym)
  if (!journal) notFound()

  const settings = await getSettings(journal.id)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-semibold text-foreground tracking-tight text-sm"
            >
              Agentic<em style={{ color: "#4f46e5", fontStyle: "italic" }}>ES</em>
            </Link>
            <span className="text-border">·</span>
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={`${journal.name} logo`}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div className="h-8 w-8 rounded-md bg-foreground flex items-center justify-center">
                <span className="text-background text-xs font-bold leading-none">
                  {journal.acronym.slice(0, 2)}
                </span>
              </div>
            )}
            <span className="font-semibold text-foreground text-sm tracking-tight">
              {journal.name}
            </span>
          </div>
          <nav className="flex items-center gap-4">
            {settings.website_url && (
              <a
                href={settings.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Journal website ↗
              </a>
            )}
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← All journals
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6">
        {/* Hero */}
        <section className="py-16 border-b border-border/50">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted text-xs font-mono font-medium text-muted-foreground">
                {journal.acronym}
              </span>
              {journal.issn && (
                <span className="text-xs text-muted-foreground font-mono">ISSN {journal.issn}</span>
              )}
              {journal.subject_area && (
                <span className="text-xs text-muted-foreground">{journal.subject_area}</span>
              )}
            </div>
            <h1 className="text-3xl font-semibold text-foreground leading-snug mb-4">
              {journal.name}
            </h1>
            {settings.description && (
              <p className="text-base text-muted-foreground leading-relaxed">
                {settings.description}
              </p>
            )}
            {settings.publisher && (
              <p className="mt-3 text-sm text-muted-foreground">
                Published by {settings.publisher}
              </p>
            )}
          </div>
        </section>

        {/* Role Centers */}
        <section className="py-12">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-6">
            Enter your center
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CENTERS.map((c) => (
              <Link
                key={c.label}
                href={c.href(journal.acronym)}
                className="group block rounded-xl border border-border bg-card px-6 py-5 hover:border-border hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm mb-1.5">
                      {c.label}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {c.description}
                    </p>
                  </div>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
