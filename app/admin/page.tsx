import Link from "next/link"

// System-level admin sections. Per-journal configuration (Manuscript Types,
// Workflows, Email Templates, Troubleshooting) lives under
// /journal/[acronym]/admin/... and is reached by opening a journal.
//
// System-level versions of those per-journal sections are still planned
// but not yet built. See project_next_steps memory.
const sections = [
  {
    href: "/admin/journals",
    title: "Journals",
    description: "Add and configure journals hosted on this instance.",
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Manage system admins and editorial roles across all journals. Search by name or email; filter by role.",
  },
  {
    href: "/admin/graph",
    title: "Graph View",
    description: "Read-only visualisation of the workflow graph. Inspect nodes and relationships to verify Claude's mutations produced the expected structure.",
  },
]

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">
        Admin Console
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Manage journals, users, workflows, and system configuration.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block rounded-xl border border-border bg-card px-5 py-4 hover:border-border transition-colors"
          >
            <p className="font-medium text-foreground text-sm mb-1">{s.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
