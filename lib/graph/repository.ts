/**
 * lib/graph/repository.ts
 *
 * Backend-agnostic graph access layer.
 *
 * See ARCHITECTURE.md and agentic_es_graph/docs/graph/SPEC.md for design rationale.
 * Quick summary:
 *
 *   TenantContext    carries (tenantId, tier) through every operation
 *   GraphRepository  abstract base — two concrete implementations:
 *                      AGERepository     (starter tier, Apache AGE on Postgres)
 *                      NebulaRepository  (growth/enterprise tier, NebulaGraph)
 *   GraphSession     unit of work scoped to one tenant
 *   GraphFactory     picks backend by tenant.tier
 *
 * Domain code calls repo.withSession(tenant, async (s) => { ... }) and never
 * imports AGERepository or NebulaRepository directly.
 *
 * merge_node() is the portable upsert primitive — domain code uses this instead
 * of raw MERGE because NebulaGraph has no MERGE.
 *
 * Implementation phases:
 *   Phase 1 — AGERepository (current)
 *   Phase 2 — Schema DDL validation against live instances
 *   Phase 3 — NebulaRepository (stubs below)
 *   Phase 4 — Migration tooling
 *   Phase 5 — Multi-tenant cutover, GraphFactory in app bootstrap
 */

import { randomUUID } from "crypto"
import type { PoolClient } from "pg"
import { getPool, bootstrapAge, parseAgtypeValue } from "./pool"
import { DEFAULT_SCHEMA } from "./schema"

// ---------------------------------------------------------------------------
// Tier
// ---------------------------------------------------------------------------

export enum Tier {
  STARTER = "starter",
  GROWTH = "growth",
  ENTERPRISE = "enterprise",
}

// ---------------------------------------------------------------------------
// TenantContext
// ---------------------------------------------------------------------------

export class TenantContext {
  constructor(
    readonly tenantId: string,
    readonly tier: Tier = Tier.STARTER
  ) {
    if (!tenantId || !/^[\w-]+$/.test(tenantId)) {
      throw new Error(`unsafe tenantId: ${JSON.stringify(tenantId)}`)
    }
  }

  /** AGE graph name: t_<id with hyphens replaced> */
  get graphName(): string {
    return `t_${this.tenantId.replace(/-/g, "_")}`
  }

  /** Nebula space name: same format */
  get spaceName(): string {
    return `t_${this.tenantId.replace(/-/g, "_")}`
  }
}

// ---------------------------------------------------------------------------
// CypherQuery
// ---------------------------------------------------------------------------

export interface CypherQuery {
  cypher: string
  params?: Record<string, unknown>
  /**
   * Column aliases from the RETURN clause, in order.
   * Required so AGE can build its AS (...) clause.
   * Omit (or pass []) for mutations — result is discarded.
   */
  returnAliases?: string[]
}

// ---------------------------------------------------------------------------
// GraphResult
// ---------------------------------------------------------------------------

export class GraphResult {
  constructor(readonly rows: Record<string, unknown>[]) {}

  single(): Record<string, unknown> | null {
    return this.rows[0] ?? null
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GraphError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GraphError"
  }
}

export class UnsupportedDialectError extends GraphError {
  constructor(message: string) {
    super(message)
    this.name = "UnsupportedDialectError"
  }
}

export class TenantIsolationError extends GraphError {
  constructor(message: string) {
    super(message)
    this.name = "TenantIsolationError"
  }
}

// ---------------------------------------------------------------------------
// GraphSession
// ---------------------------------------------------------------------------

export interface GraphSession {
  readonly tenant: TenantContext
  run(query: CypherQuery): Promise<GraphResult>
  commit(): Promise<void>
  rollback(): Promise<void>
}

// ---------------------------------------------------------------------------
// GraphRepository — abstract base
// ---------------------------------------------------------------------------

export abstract class GraphRepository {
  /**
   * Run a unit of work scoped to one tenant. The callback receives a session.
   * On success: the transaction is committed. On error: rolled back.
   *
   *   await repo.withSession(tenant, async (s) => {
   *     await s.run({ cypher: "MATCH (n:Manuscript) RETURN n", returnAliases: ["n"] })
   *   })
   */
  abstract withSession<T>(
    tenant: TenantContext,
    fn: (session: GraphSession) => Promise<T>
  ): Promise<T>

  /** Idempotent. Apply schema DDL to the tenant's graph/space. */
  abstract ensureTenantSchema(tenant: TenantContext): Promise<void>

  /** Tenant offboarding. Caller verifies backups first. */
  abstract dropTenant(tenant: TenantContext): Promise<void>
}

// ---------------------------------------------------------------------------
// Portable upsert primitive
// ---------------------------------------------------------------------------

/**
 * Portable upsert. Domain code uses this instead of raw MERGE because
 * NebulaGraph has no MERGE statement.
 *
 * On AGE: a single MERGE ... ON CREATE SET ... ON MATCH SET ...
 * On Nebula: MATCH first; CREATE if not found. Two round-trips, but
 * both are idempotent so retry is safe.
 *
 * The label parameter must be a code literal — it cannot be parameterized
 * and will be rejected if it is not a valid identifier.
 */
export async function mergeNode(
  session: GraphSession,
  label: string,
  keyProp: string,
  properties: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!(keyProp in properties)) {
    throw new GraphError(`mergeNode: properties must include keyProp "${keyProp}"`)
  }
  if (!/^\w+$/.test(label)) {
    throw new GraphError(`mergeNode: label must be an identifier, got "${label}"`)
  }

  // AGE 1.7 does not support map parameters in CREATE or SET += clauses.
  // Expand each property into a named parameter (p_<key>) to work around this.
  const prefixed: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(properties)) {
    prefixed[`p_${k}`] = v
  }
  const propList = Object.keys(properties)
    .map(k => `${k}: $p_${k}`)
    .join(", ")
  const setList = Object.keys(properties)
    .map(k => `n.${k} = $p_${k}`)
    .join(", ")

  const matched = await session.run({
    cypher: `MATCH (n:${label} {${keyProp}: $p_${keyProp}}) RETURN n`,
    params: prefixed,
    returnAliases: ["n"],
  })

  if (matched.rows.length > 0) {
    await session.run({
      cypher: `MATCH (n:${label} {${keyProp}: $p_${keyProp}}) SET ${setList} RETURN n`,
      params: prefixed,
      returnAliases: ["n"],
    })
  } else {
    await session.run({
      cypher: `CREATE (n:${label} {${propList}}) RETURN n`,
      params: prefixed,
      returnAliases: ["n"],
    })
  }

  const result = await session.run({
    cypher: `MATCH (n:${label} {${keyProp}: $p_${keyProp}}) RETURN n`,
    params: prefixed,
    returnAliases: ["n"],
  })
  const row = result.single()
  if (!row) throw new GraphError(`mergeNode: failed to retrieve node after upsert`)
  return row["n"] as Record<string, unknown>
}

/** Canonical id generator — hex UUID. Fits Nebula's FIXED_STRING(64) VID type. */
export function newId(): string {
  return randomUUID().replace(/-/g, "")
}

// ---------------------------------------------------------------------------
// AGE implementation — Phase 1
// ---------------------------------------------------------------------------

export class AGERepository extends GraphRepository {
  async withSession<T>(
    tenant: TenantContext,
    fn: (session: GraphSession) => Promise<T>
  ): Promise<T> {
    const client = await getPool().connect()
    try {
      await bootstrapAge(client)
      await client.query("BEGIN")
      const session = new AGESession(client, tenant)
      const result = await fn(session)
      await client.query("COMMIT")
      return result
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
  }

  async ensureTenantSchema(tenant: TenantContext): Promise<void> {
    const stmts = DEFAULT_SCHEMA.ageDdl(tenant.graphName)
    const client = await getPool().connect()
    try {
      await bootstrapAge(client)
      for (const stmt of stmts) {
        await client.query(stmt)
      }
    } finally {
      client.release()
    }
  }

  async dropTenant(tenant: TenantContext): Promise<void> {
    const client = await getPool().connect()
    try {
      await bootstrapAge(client)
      await client.query(
        `SELECT drop_graph($1, true)`,
        [tenant.graphName]
      )
    } catch (err: unknown) {
      // Ignore "graph does not exist" — makes this idempotent
      if (
        err instanceof Error &&
        err.message.includes("does not exist")
      ) return
      throw err
    } finally {
      client.release()
    }
  }
}

// ---------------------------------------------------------------------------
// AGESession — internal
// ---------------------------------------------------------------------------

class AGESession implements GraphSession {
  constructor(
    private readonly client: PoolClient,
    readonly tenant: TenantContext
  ) {}

  async run(query: CypherQuery): Promise<GraphResult> {
    const { sql, sqlParams } = this._wrap(query)
    const result = await this.client.query(sql, sqlParams)
    const aliases = query.returnAliases ?? []
    const rows = result.rows.map((row) => {
      const parsed: Record<string, unknown> = {}
      for (const alias of aliases) {
        const raw = row[alias] as string | null
        parsed[alias] = raw == null ? null : parseAgtypeValue(raw)
      }
      return parsed
    })
    return new GraphResult(rows)
  }

  /**
   * Builds the SQL wrapper for a Cypher query.
   *
   * AGE constraints:
   *   1. Graph name is not parameterizable — validated as a strict identifier.
   *   2. Parameters are passed as a single agtype JSON blob ($1 slot).
   *      Inside Cypher, reference them as $paramName.
   *   3. AS clause must enumerate all RETURN aliases; mutations use AS (v agtype).
   */
  private _wrap(query: CypherQuery): { sql: string; sqlParams: unknown[] } {
    const graph = this.tenant.graphName
    if (!/^\w+$/.test(graph)) {
      throw new GraphError(`unsafe graph name: "${graph}"`)
    }

    const aliases = query.returnAliases ?? []
    const asClause =
      aliases.length > 0
        ? aliases.map((a) => `${a} agtype`).join(", ")
        : "v agtype"

    const hasParams =
      query.params && Object.keys(query.params).length > 0

    if (hasParams) {
      const sql = `SELECT * FROM cypher('${graph}', $$ ${query.cypher} $$, $1::agtype) AS (${asClause})`
      return { sql, sqlParams: [JSON.stringify(query.params)] }
    } else {
      const sql = `SELECT * FROM cypher('${graph}', $$ ${query.cypher} $$) AS (${asClause})`
      return { sql, sqlParams: [] }
    }
  }

  async commit(): Promise<void> {
    // Transaction is owned by the withSession context manager.
  }

  async rollback(): Promise<void> {
    // Same — exception in withSession triggers rollback.
  }
}

// ---------------------------------------------------------------------------
// NebulaRepository — Phase 3 stub
// ---------------------------------------------------------------------------

export class NebulaRepository extends GraphRepository {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async withSession<T>(
    _tenant: TenantContext,
    _fn: (session: GraphSession) => Promise<T>
  ): Promise<T> {
    throw new Error("NebulaRepository: Phase 3 — not yet implemented")
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async ensureTenantSchema(_tenant: TenantContext): Promise<void> {
    throw new Error("NebulaRepository: Phase 3 — not yet implemented")
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async dropTenant(_tenant: TenantContext): Promise<void> {
    throw new Error("NebulaRepository: Phase 3 — not yet implemented")
  }
}

// ---------------------------------------------------------------------------
// Cypher → nGQL dialect translator (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Translates the openCypher subset we use to nGQL for NebulaGraph.
 *
 * Rules:
 *   - Known divergences are rewritten.
 *   - Unknown divergences raise UnsupportedDialectError — fail loud in tests
 *     rather than silently emit broken nGQL.
 *
 * Currently handled:
 *   - timestamp() → now()
 *
 * See agentic_es_graph/docs/graph/SPEC.md §5 for the full divergence table.
 */
export function translateCypherToNgql(cypher: string): string {
  if (/\bMERGE\b/i.test(cypher)) {
    throw new UnsupportedDialectError(
      "MERGE has no nGQL equivalent. Use mergeNode() helper instead."
    )
  }

  let out = cypher.replace(/\btimestamp\(\)/gi, "now()")

  for (const sentinel of ["size((", "[r IN "]) {
    if (out.includes(sentinel)) {
      throw new UnsupportedDialectError(
        `Unhandled Cypher feature: "${sentinel}". Add a translator rule.`
      )
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// GraphFactory — picks backend by tenant.tier
// ---------------------------------------------------------------------------

export class GraphFactory {
  constructor(
    private readonly age: AGERepository,
    private readonly nebula: NebulaRepository
  ) {}

  forTenant(tenant: TenantContext): GraphRepository {
    return tenant.tier === Tier.STARTER ? this.age : this.nebula
  }
}
