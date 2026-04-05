import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"
import { getDownloadUrl } from "@/lib/storage"

interface ManuscriptFile {
  file_key: string
  file_name: string
  journal_id: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Fetch file metadata
  const rows = await sql<ManuscriptFile>(
    `SELECT file_key, file_name, journal_id
     FROM manuscript.manuscripts
     WHERE id = $1`,
    [id]
  )
  const manuscript = rows[0]
  if (!manuscript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!manuscript.file_key) {
    return NextResponse.json({ error: "No file attached" }, { status: 404 })
  }

  // Verify the requesting user has a person record for this journal
  // (covers authors, reviewers, and all editorial roles)
  const personRows = await sql<{ id: string }>(
    `SELECT id FROM manuscript.people
     WHERE auth_user_id = $1 AND journal_id = $2`,
    [session.user.id, manuscript.journal_id]
  )
  if (!personRows[0]) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = await getDownloadUrl(manuscript.file_key)
  return NextResponse.redirect(url)
}
