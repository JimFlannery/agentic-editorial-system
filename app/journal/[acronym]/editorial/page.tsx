import { redirect } from "next/navigation"

// Root /editorial/[acronym] — redirects to assistant-editor until role-aware
// routing is wired up via Better Auth session.
export default async function EditorialRootPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params
  redirect(`/journal/${acronym}/editorial/assistant-editor`)
}
