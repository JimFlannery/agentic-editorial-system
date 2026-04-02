import Link from "next/link"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/admin/journals",          label: "Journals" },
  { href: "/admin/users",             label: "Users" },
  { href: "/admin/manuscript-types",  label: "Manuscript Types" },
  { href: "/admin/workflows",         label: "Workflows" },
  { href: "/admin/workflow",          label: "Workflow Config" },
  { href: "/admin/email-templates",   label: "Email Templates" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-screen-xl mx-auto px-6">
        {/* Top bar */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 py-3 flex items-center gap-4">
          <Link
            href="/admin"
            className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight text-sm"
          >
            Agentic Editorial System
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span className="text-xs text-zinc-400">Admin</span>
          <Link
            href="/"
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ← Back to app
          </Link>
        </header>

        <div className="flex gap-8 py-8">
          {/* Sidebar */}
          <nav className="w-48 shrink-0">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Admin
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
