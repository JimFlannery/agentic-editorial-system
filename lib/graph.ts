/**
 * lib/graph.ts
 *
 * Database client for PostgreSQL + Apache AGE.
 *
 * Two exports:
 *   sql(query, params?)  — parameterised SQL query, returns typed rows
 *   cypher(query)        — Cypher query against ems_graph, returns raw agtype rows
 *
 * Usage:
 *   import { sql, cypher } from "@/lib/graph"
 *
 *   // Relational
 *   const journals = await sql<{ id: string; name: string }>(
 *     "SELECT id, name FROM manuscript.journals WHERE id = $1",
 *     [journalId]
 *   )
 *
 *   // Graph
 *   const rows = await cypher(
 *     `MATCH (p:Person {role: 'reviewer'})-[:ASSIGNED_TO]->(m:Manuscript)
 *      RETURN p.name, m.title`
 *   )
 */

import { Pool, PoolClient } from "pg"

// ---------------------------------------------------------------------------
// Connection pool (singleton, safe for Next.js dev HMR)
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

function getPool(): Pool {
  if (!global._pgPool) {
    global._pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  }
  return global._pgPool
}

// ---------------------------------------------------------------------------
// AGE bootstrap — every connection needs LOAD + search_path before Cypher
// ---------------------------------------------------------------------------

async function bootstrapAge(client: PoolClient): Promise<void> {
  await client.query("LOAD 'age'")
  await client.query(
    `SET search_path = ag_catalog, "$user", public`
  )
}

// ---------------------------------------------------------------------------
// sql — parameterised SQL query
// ---------------------------------------------------------------------------

export async function sql<T extends object = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool()
  const { rows } = await pool.query<T>(query, params)
  return rows
}

// ---------------------------------------------------------------------------
// cypherMutate — Cypher CREATE/MERGE/SET/DELETE with no RETURN
//
// AGE requires at least one column in the AS clause even for mutations.
// This helper always uses AS (v agtype) and discards the (empty) result.
// ---------------------------------------------------------------------------

export async function cypherMutate(query: string): Promise<void> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await bootstrapAge(client)
    await client.query(
      `SELECT * FROM cypher('ems_graph', $$ ${query} $$) AS (v agtype)`
    )
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// cypher — Cypher query against ems_graph
//
// Returns an array of plain objects keyed by the RETURN aliases.
// agtype values are parsed from JSON where possible; raw strings otherwise.
//
// Example: MATCH (p:Person) RETURN p.name AS name, p.role AS role
// Returns: [{ name: "Dr. Aiko Tanaka", role: "author" }, ...]
// ---------------------------------------------------------------------------

export async function cypher(
  query: string,
  returnAliases: string[]
): Promise<Record<string, unknown>[]> {
  const pool = getPool()
  const client = await pool.connect()

  try {
    await bootstrapAge(client)

    // Build the AS clause from caller-supplied aliases
    const asClause = returnAliases
      .map((alias) => `${alias} agtype`)
      .join(", ")

    const { rows } = await client.query(
      `SELECT * FROM cypher('ems_graph', $$ ${query} $$) AS (${asClause})`
    )

    // Parse each agtype value from its JSON string representation
    return rows.map((row) => {
      const parsed: Record<string, unknown> = {}
      for (const alias of returnAliases) {
        const raw = row[alias] as string | null
        if (raw === null || raw === undefined) {
          parsed[alias] = null
          continue
        }
        try {
          parsed[alias] = JSON.parse(raw)
        } catch {
          parsed[alias] = raw
        }
      }
      return parsed
    })
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// withTransaction — run multiple operations in a single SQL transaction
// ---------------------------------------------------------------------------

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}
