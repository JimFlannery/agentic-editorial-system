/**
 * lib/graph/schema.ts
 *
 * Declarative graph schema. Declared once here; drives:
 *   - AGE  DDL (create_graph + create_vlabel/create_elabel + CREATE INDEX)
 *   - Nebula DDL (CREATE SPACE / TAG / EDGE / INDEX) — Phase 3
 *   - Migration importer column ordering — Phase 4
 *
 * To add or change a property:
 *   1. Edit DEFAULT_SCHEMA below.
 *   2. Re-run DDL against a dev instance to verify.
 *   3. Write a migration if the change is breaking (renamed prop, new NOT NULL
 *      without default, changed type).
 *   4. Bump SCHEMA_VERSION.
 */

// ---------------------------------------------------------------------------
// Type system
// ---------------------------------------------------------------------------

export type PropType = "string" | "int64" | "double" | "bool" | "timestamp"

export interface PropertyDef {
  name: string
  type: PropType
  nullable?: boolean        // defaults true
  default?: string          // nGQL literal, e.g. "false", "''"
  indexed?: boolean         // build an index on this property
  stringLength?: number     // only relevant for Nebula string columns; default 64
}

export interface TagDef {
  name: string
  properties: PropertyDef[]
  primaryKey?: string       // property used as VID on Nebula; default "id"
}

export interface EdgeDef {
  name: string
  fromTags: string[]
  toTags: string[]
  properties?: PropertyDef[]
}

export interface GraphSchema {
  readonly version: string
  readonly tags: TagDef[]
  readonly edges: EdgeDef[]
  readonly vidType: string
  readonly partitionNum: number
  readonly replicaFactor: number

  nebulaDdl(spaceName: string): string[]
  ageDdl(graphName: string): string[]
}

// ---------------------------------------------------------------------------
// Schema builder
// ---------------------------------------------------------------------------

class Schema implements GraphSchema {
  readonly version: string
  readonly tags: TagDef[]
  readonly edges: EdgeDef[]
  readonly vidType: string
  readonly partitionNum: number
  readonly replicaFactor: number

  constructor(opts: {
    version: string
    tags: TagDef[]
    edges: EdgeDef[]
    vidType?: string
    partitionNum?: number
    replicaFactor?: number
  }) {
    this.version = opts.version
    this.tags = opts.tags
    this.edges = opts.edges
    this.vidType = opts.vidType ?? "FIXED_STRING(64)"
    this.partitionNum = opts.partitionNum ?? 10
    this.replicaFactor = opts.replicaFactor ?? 3
  }

  // ── Nebula DDL ────────────────────────────────────────────────────────────

  nebulaDdl(spaceName: string): string[] {
    const stmts: string[] = []

    stmts.push(
      `CREATE SPACE IF NOT EXISTS ${spaceName} ` +
      `(vid_type=${this.vidType}, ` +
      `partition_num=${this.partitionNum}, ` +
      `replica_factor=${this.replicaFactor});`
    )
    stmts.push(`USE ${spaceName};`)

    for (const tag of this.tags) {
      const props = tag.properties.map(nebulaPropDecl).join(", ")
      stmts.push(`CREATE TAG IF NOT EXISTS ${tag.name}(${props});`)
    }

    for (const edge of this.edges) {
      const props = edge.properties?.map(nebulaPropDecl).join(", ") ?? ""
      stmts.push(`CREATE EDGE IF NOT EXISTS ${edge.name}(${props});`)
    }

    for (const tag of this.tags) {
      for (const prop of tag.properties) {
        if (!prop.indexed) continue
        const idxName = `idx_${tag.name.toLowerCase()}_${prop.name}`
        const spec =
          prop.type === "string"
            ? `${prop.name}(${prop.stringLength ?? 64})`
            : prop.name
        stmts.push(
          `CREATE TAG INDEX IF NOT EXISTS ${idxName} ON ${tag.name}(${spec});`
        )
      }
    }

    for (const tag of this.tags) {
      for (const prop of tag.properties) {
        if (!prop.indexed) continue
        const idxName = `idx_${tag.name.toLowerCase()}_${prop.name}`
        stmts.push(`REBUILD TAG INDEX ${idxName};`)
      }
    }

    return stmts
  }

  // ── AGE / Postgres DDL ────────────────────────────────────────────────────

  /**
   * Returns ordered SQL statements to create the AGE graph, label tables, and
   * indexes for a fresh tenant.
   *
   * AGE stores each label as a Postgres table. We call create_vlabel() and
   * create_elabel() explicitly so the tables exist before we create indexes
   * (AGE creates label tables lazily on first write otherwise).
   */
  ageDdl(graphName: string): string[] {
    const stmts: string[] = []

    stmts.push(`LOAD 'age';`)
    stmts.push(`SET search_path = ag_catalog, "$user", public;`)

    // Create the graph (idempotent via exception handling)
    stmts.push(
      `DO $$ BEGIN ` +
      `  PERFORM create_graph('${graphName}'); ` +
      `EXCEPTION WHEN others THEN ` +
      `  IF SQLERRM NOT LIKE '%already exists%' THEN RAISE; END IF; ` +
      `END $$;`
    )

    // Create vertex labels (idempotent)
    for (const tag of this.tags) {
      stmts.push(
        `DO $$ BEGIN ` +
        `  PERFORM create_vlabel('${graphName}', '${tag.name}'); ` +
        `EXCEPTION WHEN others THEN ` +
        `  IF SQLERRM NOT LIKE '%already exists%' THEN RAISE; END IF; ` +
        `END $$;`
      )
    }

    // Create edge labels (idempotent)
    for (const edge of this.edges) {
      stmts.push(
        `DO $$ BEGIN ` +
        `  PERFORM create_elabel('${graphName}', '${edge.name}'); ` +
        `EXCEPTION WHEN others THEN ` +
        `  IF SQLERRM NOT LIKE '%already exists%' THEN RAISE; END IF; ` +
        `END $$;`
      )
    }

    // Create indexes on vertex label tables for hot query properties.
    // AGE stores each label as "<graphName>"."<LabelName>" in ag_catalog.
    for (const tag of this.tags) {
      const pk = tag.primaryKey ?? "id"
      for (const prop of tag.properties) {
        if (!prop.indexed && prop.name !== pk) continue
        const idxName = `idx_${graphName}_${tag.name.toLowerCase()}_${prop.name}`
        stmts.push(
          `CREATE INDEX IF NOT EXISTS "${idxName}" ` +
          `ON "${graphName}"."${tag.name}" ` +
          `USING btree ((properties->>'\"${prop.name}\"'));`
        )
      }
    }

    return stmts
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nebulaPropDecl(p: PropertyDef): string {
  const typeStr = p.type === "string" ? "string" : p.type
  const parts: string[] = [p.name, typeStr]
  if (p.nullable === false) parts.push("NOT NULL")
  if (p.default != null) parts.push(`DEFAULT ${p.default}`)
  return parts.join(" ")
}

// ---------------------------------------------------------------------------
// Common property factories
// ---------------------------------------------------------------------------

function id(): PropertyDef {
  return { name: "id", type: "string", nullable: false, indexed: true }
}

function tenantId(): PropertyDef {
  return { name: "tenant_id", type: "string", nullable: false, indexed: true }
}

function createdAt(): PropertyDef {
  return { name: "created_at", type: "timestamp", nullable: false }
}

// ---------------------------------------------------------------------------
// DEFAULT_SCHEMA — AgenticES v0.1
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = "v0.1"

const MANUSCRIPT: TagDef = {
  name: "Manuscript",
  properties: [
    id(),
    tenantId(),
    { name: "title",        type: "string",    nullable: false, stringLength: 512 },
    { name: "status",       type: "string",    nullable: false, indexed: true, stringLength: 32 },
    { name: "doi",          type: "string",    indexed: true,   stringLength: 128 },
    { name: "abstract",     type: "string",    stringLength: 4096 },
    { name: "submitted_at", type: "timestamp" },
    createdAt(),
  ],
}

const AUTHOR: TagDef = {
  name: "Author",
  properties: [
    id(),
    tenantId(),
    { name: "orcid",        type: "string",    indexed: true,   stringLength: 64 },
    { name: "display_name", type: "string",    nullable: false, stringLength: 255 },
    { name: "email",        type: "string",    indexed: true,   stringLength: 255 },
    { name: "affiliation",  type: "string",    stringLength: 512 },
    createdAt(),
  ],
}

const REVIEWER: TagDef = {
  name: "Reviewer",
  properties: [
    id(),
    tenantId(),
    { name: "display_name", type: "string",    nullable: false, stringLength: 255 },
    { name: "email",        type: "string",    indexed: true,   stringLength: 255 },
    { name: "expertise",    type: "string",    stringLength: 512 },
    createdAt(),
  ],
}

const EDITOR: TagDef = {
  name: "Editor",
  properties: [
    id(),
    tenantId(),
    { name: "display_name", type: "string",    nullable: false, stringLength: 255 },
    { name: "email",        type: "string",    indexed: true,   stringLength: 255 },
    { name: "role",         type: "string",    indexed: true,   stringLength: 64 },
    createdAt(),
  ],
}

const DECISION: TagDef = {
  name: "Decision",
  properties: [
    id(),
    tenantId(),
    { name: "outcome",     type: "string",    nullable: false, indexed: true, stringLength: 32 },
    { name: "rationale",   type: "string",    stringLength: 4096 },
    { name: "decided_at",  type: "timestamp", nullable: false },
    createdAt(),
  ],
}

const REVISION: TagDef = {
  name: "Revision",
  properties: [
    id(),
    tenantId(),
    { name: "version", type: "int64",  nullable: false },
    { name: "notes",   type: "string", stringLength: 4096 },
    createdAt(),
  ],
}

const TERM: TagDef = {
  name: "Term",
  properties: [
    id(),
    tenantId(),
    { name: "vocabulary", type: "string", nullable: false, indexed: true, stringLength: 64 },
    { name: "value",      type: "string", nullable: false, indexed: true, stringLength: 255 },
  ],
}

// ── Edges ─────────────────────────────────────────────────────────────────

const AUTHORED: EdgeDef = {
  name: "AUTHORED",
  fromTags: ["Author"],
  toTags: ["Manuscript"],
  properties: [
    { name: "position",         type: "int64",  nullable: false },
    { name: "is_corresponding", type: "bool",   default: "false" },
    createdAt(),
  ],
}

const REVIEWED: EdgeDef = {
  name: "REVIEWED",
  fromTags: ["Reviewer"],
  toTags: ["Manuscript"],
  properties: [
    { name: "recommendation", type: "string",    indexed: true, stringLength: 32 },
    { name: "submitted_at",   type: "timestamp" },
    createdAt(),
  ],
}

const ASSIGNED_TO: EdgeDef = {
  name: "ASSIGNED_TO",
  fromTags: ["Editor"],
  toTags: ["Manuscript"],
  properties: [
    { name: "role", type: "string", stringLength: 64 },
    createdAt(),
  ],
}

const DECIDED: EdgeDef = {
  name: "DECIDED",
  fromTags: ["Editor"],
  toTags: ["Decision"],
  properties: [createdAt()],
}

const DECISION_OF: EdgeDef = {
  name: "DECISION_OF",
  fromTags: ["Decision"],
  toTags: ["Manuscript"],
  properties: [createdAt()],
}

const REVISES: EdgeDef = {
  name: "REVISES",
  fromTags: ["Revision"],
  toTags: ["Manuscript"],
  properties: [createdAt()],
}

const CITES: EdgeDef = {
  name: "CITES",
  fromTags: ["Manuscript"],
  toTags: ["Manuscript"],
  properties: [createdAt()],
}

const TAGGED_WITH: EdgeDef = {
  name: "TAGGED_WITH",
  fromTags: ["Manuscript"],
  toTags: ["Term"],
  properties: [createdAt()],
}

export const DEFAULT_SCHEMA: GraphSchema = new Schema({
  version: SCHEMA_VERSION,
  tags: [MANUSCRIPT, AUTHOR, REVIEWER, EDITOR, DECISION, REVISION, TERM],
  edges: [
    AUTHORED, REVIEWED, ASSIGNED_TO, DECIDED, DECISION_OF,
    REVISES, CITES, TAGGED_WITH,
  ],
})
