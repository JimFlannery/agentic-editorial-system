import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  const { journalAcronym } = await req.json() as { journalAcronym: string }
  if (!journalAcronym) {
    return NextResponse.json({ error: "journalAcronym required" }, { status: 400 })
  }

  const journalRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [journalAcronym]
  )
  const journal = journalRows[0]
  if (!journal) {
    return NextResponse.json({ error: "Journal not found" }, { status: 404 })
  }

  // Idempotent — no-op if already provisioned for this journal
  const existing = await sql<{ id: string }>(
    "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journal.id]
  )

  let personId: string

  if (existing[0]) {
    personId = existing[0].id
  } else {
    const inserted = await sql<{ id: string }>(
      `INSERT INTO manuscript.people (journal_id, email, full_name, auth_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [journal.id, session.user.email, session.user.name, session.user.id]
    )
    personId = inserted[0].id
  }

  // Assign author role (idempotent)
  await sql(
    `INSERT INTO manuscript.person_roles (person_id, journal_id, role)
     VALUES ($1, $2, 'author')
     ON CONFLICT (person_id, journal_id, role) DO NOTHING`,
    [personId, journal.id]
  )

  return NextResponse.json({ ok: true })
}
