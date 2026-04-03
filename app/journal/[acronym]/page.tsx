import { redirect } from "next/navigation"

// Per-journal landing page — redirects to the editorial workspace.
// Once auth is built this will show journal-scoped role centers instead.
export default async function JournalLandingPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params
  redirect(`/journal/${acronym}/editorial`)
}
