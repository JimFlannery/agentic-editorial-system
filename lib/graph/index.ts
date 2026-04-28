/**
 * lib/graph/index.ts
 *
 * Public API for the graph layer. All imports of "@/lib/graph" resolve here.
 *
 * Backward-compatible exports (used by existing app code — do not remove):
 *   sql, cypher, cypherMutate, withTransaction
 *
 * New repository API (use for new domain code):
 *   TenantContext, Tier, GraphRepository, GraphSession, GraphResult
 *   CypherQuery, GraphError, UnsupportedDialectError, TenantIsolationError
 *   AGERepository, NebulaRepository, GraphFactory
 *   mergeNode, newId
 *   translateCypherToNgql
 *
 * Schema:
 *   TagDef, EdgeDef, PropertyDef, GraphSchema, DEFAULT_SCHEMA, SCHEMA_VERSION
 *
 * Domain repositories:
 *   ManuscriptRepository, newManuscript (from ./domain/manuscript)
 */

// ── Backward-compat (existing app code) ─────────────────────────────────────
export { sql, cypher, cypherMutate, withTransaction, parseAgtypeValue } from "./pool"

// ── Repository layer ─────────────────────────────────────────────────────────
export {
  Tier,
  TenantContext,
  GraphResult,
  GraphError,
  UnsupportedDialectError,
  TenantIsolationError,
  GraphRepository,
  AGERepository,
  NebulaRepository,
  GraphFactory,
  mergeNode,
  newId,
  translateCypherToNgql,
} from "./repository"

export type {
  CypherQuery,
  GraphSession,
} from "./repository"

// ── Schema ────────────────────────────────────────────────────────────────────
export { DEFAULT_SCHEMA, SCHEMA_VERSION } from "./schema"

export type {
  PropType,
  PropertyDef,
  TagDef,
  EdgeDef,
  GraphSchema,
} from "./schema"

// ── Domain repositories ───────────────────────────────────────────────────────
export { ManuscriptRepository, newManuscript } from "./domain/manuscript"
export type { Manuscript } from "./domain/manuscript"
