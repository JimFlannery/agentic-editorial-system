"use server"

import { cypherMutate } from "@/lib/graph"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

export async function addEmailTemplate(acronym: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim()
  const subject = (formData.get("subject") as string)?.trim()
  const description = (formData.get("description") as string)?.trim() || null
  const body = (formData.get("body") as string)?.trim()

  if (!name) throw new Error("Name is required")
  if (!subject) throw new Error("Subject is required")
  if (!body) throw new Error("Body is required")

  const id = randomUUID()

  // Single-quoted strings only in AGE Cypher; escape any single quotes in values
  const escape = (s: string) => s.replace(/'/g, "\\'")

  const descProp = description
    ? `, description: '${escape(description)}'`
    : ""

  await cypherMutate(
    `CREATE (:EmailTemplate {
      id: '${escape(id)}',
      name: '${escape(name)}',
      subject: '${escape(subject)}',
      body: '${escape(body)}'
      ${descProp}
    })`
  )

  revalidatePath(`/journal-admin/${acronym}/email-templates`)
}

export async function editEmailTemplate(acronym: string, id: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim()
  const subject = (formData.get("subject") as string)?.trim()
  const description = (formData.get("description") as string)?.trim() || ""
  const body = (formData.get("body") as string)?.trim()

  if (!name) throw new Error("Name is required")
  if (!subject) throw new Error("Subject is required")
  if (!body) throw new Error("Body is required")

  const escape = (s: string) => s.replace(/'/g, "\\'")

  await cypherMutate(
    `MATCH (t:EmailTemplate {id: '${escape(id)}'})
     SET t.name = '${escape(name)}',
         t.subject = '${escape(subject)}',
         t.body = '${escape(body)}',
         t.description = '${escape(description)}'`
  )

  revalidatePath(`/journal-admin/${acronym}/email-templates`)
}
