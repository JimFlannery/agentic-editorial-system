import { redirect } from "next/navigation"
import { sql } from "@/lib/graph"

// /journal root — redirects to the first journal's workspace.
// With auth this will route to the user's assigned journals.
export default async function JournalRootPage() {
  try {
    const rows = await sql<{ acronym: string }>(
      "SELECT acronym FROM manuscript.journals ORDER BY name LIMIT 1"
    )
    if (rows.length > 0) redirect(`/journal/${rows[0].acronym}`)
  } catch {
    // DB not ready yet
  }
  redirect("/admin/journals")
}
