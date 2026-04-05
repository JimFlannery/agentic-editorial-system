import Link from "next/link"

const sections = [
  {
    href: "/admin/journals",
    title: "Journals",
    description: "Add and configure journals hosted on this instance.",
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Manage people, roles, and journal assignments.",
  },
  {
    href: "/admin/manuscript-types",
    title: "Manuscript Types",
    description: "Define submission types with acronyms (e.g. Original Research, Case Report). Each type can have its own workflow.",
  },
  {
    href: "/admin/workflows",
    title: "Workflows",
    description: "View all workflow definitions and their steps.",
  },
  {
    href: "/admin/workflow",
    title: "Workflow Config",
    description: "Use the AI assistant to define or modify workflows in plain language.",
  },
  {
    href: "/admin/email-templates",
    title: "Email Templates",
    description: "Manage reusable email templates for workflow communications.",
  },
  {
    href: "/admin/troubleshooting",
    title: "Troubleshooting",
    description: "Describe a problem and Claude will diagnose it — querying manuscripts, gates, and the event log to find the root cause.",
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
