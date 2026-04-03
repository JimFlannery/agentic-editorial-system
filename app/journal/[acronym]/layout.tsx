import { notFound } from "next/navigation"
import { sql } from "@/lib/graph"

interface JournalTheme {
  primary_color?: string
  accent_color?: string
}

async function getJournalTheme(acronym: string): Promise<JournalTheme> {
  try {
    const rows = await sql<{ key: string; value: string }>(
      `SELECT key, value FROM manuscript.journal_settings
       WHERE journal_id = (
         SELECT id FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)
       )
       AND key IN ('primary_color', 'accent_color')`,
      [acronym]
    )
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  } catch {
    return {}
  }
}

async function journalExists(acronym: string): Promise<boolean> {
  try {
    const rows = await sql<{ id: string }>(
      "SELECT id FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
      [acronym]
    )
    return rows.length > 0
  } catch {
    return false
  }
}

export default async function JournalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  const exists = await journalExists(acronym)
  if (!exists) notFound()

  const theme = await getJournalTheme(acronym)

  // Inject journal-specific CSS custom properties for theming.
  // Child layouts (editorial, admin) inherit these automatically.
  // Defaults fall back to globals.css values when not set.
  const themeVars = [
    theme.primary_color && `--color-primary: ${theme.primary_color};`,
    theme.accent_color  && `--color-accent: ${theme.accent_color};`,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      {themeVars && (
        <style>{`:root { ${themeVars} }`}</style>
      )}
      {children}
    </>
  )
}
