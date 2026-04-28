/**
 * lib/graph/pool.ts
 *
 * pg Pool singleton and the four backward-compatible low-level helpers:
 *   sql, cypher, cypherMutate, withTransaction
 *
 * Existing app code imports these from "@/lib/graph" via index.ts.
 * New domain code should use GraphRepository / GraphSession instead.
 */

import { Pool, PoolClient } from "pg"

// ---------------------------------------------------------------------------
// Pool singleton — safe for Next.js dev HMR
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

export function getPool(): Pool {
  if (!global._pgPool) {
    global._pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      keepAlive: true,
      idleTimeoutMillis: 30_000,
    })
    global._pgPool.on("error", (err) => {
      console.error("[pg pool] idle client error:", err.message)
    })
  }
  return global._pgPool
}

// ---------------------------------------------------------------------------
// AGE bootstrap — every connection needs LOAD + search_path before Cypher
// ---------------------------------------------------------------------------

export async function bootstrapAge(client: PoolClient): Promise<void> {
  await client.query("LOAD 'age'")
  await client.query(`SET search_path = ag_catalog, "$user", public`)
}

// ---------------------------------------------------------------------------
// sql — parameterised SQL query (backward-compat)
// ---------------------------------------------------------------------------

export async function sql<T extends object = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  const { rows } = await getPool().query<T>(query, params)
  return rows
}

// ---------------------------------------------------------------------------
// cypher — Cypher query against ems_graph (backward-compat)
//
// For multi-tenant code use AGERepository.withSession() instead.
// ---------------------------------------------------------------------------

export async function cypher(
  query: string,
  returnAliases: string[]
): Promise<Record<string, unknown>[]> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await bootstrapAge(client)
    const asClause = returnAliases.map((a) => `${a} agtype`).join(", ")
    const { rows } = await client.query(
      `SELECT * FROM cypher('ems_graph', $$ ${query} $$) AS (${asClause})`
    )
    return rows.map((row) => {
      const parsed: Record<string, unknown> = {}
      for (const alias of returnAliases) {
        const raw = row[alias] as string | null
        parsed[alias] = raw == null ? null : parseAgtypeValue(raw)
      }
      return parsed
    })
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// cypherMutate — Cypher mutation against ems_graph (backward-compat)
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
// withTransaction — SQL transaction (backward-compat)
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

// ---------------------------------------------------------------------------
// parseAgtypeValue — shared AGE agtype parser
//
// AGE returns Cypher values as strings with optional type suffixes:
//   {"id":5,"label":"Manuscript","properties":{...}}::vertex
//   {"id":5,...}::edge
//   plain JSON scalars
//
// Vertices and edges have their `properties` map flattened into the top level
// so domain code can write node["title"] instead of node["properties"]["title"].
// The internal AGE id and label are preserved as _id and _label.
// ---------------------------------------------------------------------------

export function parseAgtypeValue(raw: string): unknown {
  if (raw == null) return null
  const stripped = raw.replace(/::(?:vertex|edge|path)$/, "")
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    return raw
  }
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "properties" in parsed &&
    "label" in (parsed as Record<string, unknown>)
  ) {
    const node = parsed as {
      id: unknown
      label: string
      properties: Record<string, unknown>
    }
    return { ...node.properties, _id: node.id, _label: node.label }
  }
  return parsed
}
