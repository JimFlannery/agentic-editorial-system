import { redirect } from "next/navigation"
import { sql } from "@/lib/graph"

export default async function JournalAdminRootPage() {
  const journals = await sql<{ acronym: string }>(
    "SELECT acronym FROM manuscript.journals ORDER BY name LIMIT 1"
  )
  if (journals.length === 0) redirect("/admin/journals")
  redirect(`/journal-admin/${journals[0].acronym}`)
}
