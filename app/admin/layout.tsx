import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cn } from "@/lib/utils"
import { auth } from "@/lib/auth"
import { UserMenu } from "@/components/user-menu"

const navItems = [
  { href: "/admin/journals", label: "Journals" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/manuscript-types", label: "Manuscript Types" },
  { href: "/admin/email-templates", label: "Email Templates" },
  { href: "/admin/workflows", label: "Workflows" },
  { href: "/admin/workflow", label: "Workflow Config" },
  { href: "/admin/troubleshooting", label: "Troubleshooting" },
  { href: "/admin/graph", label: "Graph View" },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login?next=/admin")
  if (!session.user.system_admin) redirect("/unauthorized")

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto px-6">
        {/* Top bar */}
        <header className="border-b border-border py-3 flex items-center gap-4">
          <Link
            href="/admin"
            className="font-semibold text-foreground tracking-tight text-sm"
          >
            Agentic<em style={{ color: "#4f46e5", fontStyle: "italic" }}>ES</em>
          </Link>
          <span className="text-border">·</span>
          <span className="text-xs text-muted-foreground">Admin</span>
          <div className="ml-auto">
            <UserMenu name={session.user.name} email={session.user.email} />
          </div>
        </header>

        <div className="flex gap-8 py-8">
          {/* Sidebar */}
          <nav className="w-48 shrink-0">
            <Link
              href="/admin"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors block"
            >
              Admin
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
