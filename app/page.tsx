import Link from "next/link"
import { sql } from "@/lib/graph"
import { ThemeToggle } from "@/components/theme-toggle"
import { JournalGrid } from "@/components/journal-grid"

interface Journal {
  id: string
  name: string
  acronym: string
  issn: string | null
  subject_area: string | null
}

async function getJournals(): Promise<Journal[]> {
  try {
    return await sql<Journal>(
      "SELECT id, name, acronym, issn, subject_area FROM manuscript.journals ORDER BY name"
    )
  } catch {
    return []
  }
}

const features = [
  {
    title: "Graph-native workflows",
    description:
      "Every workflow — gates, decisions, escalations — is stored as a property graph. Infinitely configurable without code changes.",
  },
  {
    title: "AI-assisted configuration",
    description:
      "Describe your review process in plain language. Claude translates it into the graph and waits for your confirmation before applying changes.",
  },
  {
    title: "Multi-journal tenancy",
    description:
      "Host multiple journals on one instance. Each journal has its own editorial team, reviewer pool, and workflow — fully isolated.",
  },
  {
    title: "Per-journal custom domains",
    description:
      "Each journal can be accessed via its own subdomain (e.g. AgenticES.NEJM.com) with independent theming and branding.",
  },
  {
    title: "Open source, AGPLv3",
    description:
      "Self-host on any VPS, Railway, or Azure. No vendor lock-in. Swap object storage, email provider, and auth via environment variables.",
  },
  {
    title: "Full audit trail",
    description:
      "Every gate evaluation, state transition, and agent action is recorded in an append-only event log — queryable and exportable.",
  },
]

export default async function Home() {
  const journals = await getJournals()

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-4">
          <span className="font-semibold text-foreground tracking-tight text-sm">
            Agentic<em style={{ color: "#4f46e5", fontStyle: "italic" }}>ES</em>
          </span>
          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
            >
              System Admin
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6">
        {/* Hero */}
        <section className="py-20 max-w-2xl">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="text-5xl font-bold tracking-tight text-foreground">
              Agentic<em style={{ color: "#4f46e5", fontStyle: "italic" }}>ES</em>
            </span>
            <span className="text-lg text-muted-foreground">
              The Agentic Editorial System
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
            Open source · AGPLv3
          </p>
          <h1 className="text-4xl font-semibold text-foreground leading-tight mb-5">
            Editorial workflow management,<br />powered by a property graph.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-xl">
            An open-source editorial management system for academic journals. Workflows are stored
            as a configurable graph — not hardcoded — and Claude agents automate reviewer selection,
            conflict detection, and deadline tracking.
          </p>
          <Link
            href="/admin"
            className="rounded-lg border border-input text-foreground text-sm font-medium px-5 py-2.5 hover:bg-muted/50 transition-colors"
          >
            System Admin
          </Link>
        </section>

        <div className="border-t border-border/50" />

        {/* Journals */}
        <section className="py-16">
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
                Journals
              </h2>
              <p className="text-sm text-muted-foreground">
                Select a journal to enter its workspace.
              </p>
            </div>
            {journals.length > 0 && (
              <Link
                href="/admin/journals"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Manage journals →
              </Link>
            )}
          </div>
          <JournalGrid journals={journals} />
        </section>

        <div className="border-t border-border/50" />

        {/* Features */}
        <section className="py-16">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-10">
            Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title}>
                <p className="font-medium text-foreground text-sm mb-1.5">
                  {f.title}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-border/50" />

        <footer className="py-8 flex items-center justify-between text-xs text-muted-foreground">
          <span>Agentic<em style={{ color: "#4f46e5", fontStyle: "italic" }}>ES</em> — AGPLv3</span>
          <a
            href="https://github.com/anthropics/claude-code"
            className="hover:text-foreground transition-colors"
          >
            Built with Claude Code
          </a>
        </footer>
      </div>
    </div>
  )
}
