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
]

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Admin Console
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Manage journals, users, workflows, and system configuration.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-1">{s.title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
