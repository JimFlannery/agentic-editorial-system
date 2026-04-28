/**
 * lib/graph/domain/manuscript.ts
 *
 * ManuscriptRepository — the canonical example of domain repository pattern.
 *
 * Domain repositories:
 *   - Take a GraphRepository in the constructor
 *   - Use repo.withSession(tenant, ...) for every operation
 *   - Never import AGERepository or NebulaRepository directly
 *   - Validate that entity.tenantId matches the session tenant
 *   - Always pass tenant_id on writes, always filter by it on reads
 *
 * Follow this pattern for Author, Reviewer, Editor, Decision, etc.
 */

import {
  GraphRepository,
  TenantContext,
  CypherQuery,
  mergeNode,
  newId,
} from "../repository"

// ---------------------------------------------------------------------------
// Domain entity
// ---------------------------------------------------------------------------

export interface Manuscript {
  id: string
  tenantId: string
  title: string
  status: "submitted" | "in_review" | "accepted" | "rejected" | "withdrawn" | string
  doi?: string | null
  abstract?: string | null
  submittedAt?: Date | null
}

export function newManuscript(
  tenantId: string,
  title: string,
  abstract?: string
): Manuscript {
  return {
    id: newId(),
    tenantId,
    title,
    status: "submitted",
    abstract: abstract ?? null,
    submittedAt: new Date(),
  }
}

// ---------------------------------------------------------------------------
// ManuscriptRepository
// ---------------------------------------------------------------------------

export class ManuscriptRepository {
  constructor(private readonly graph: GraphRepository) {}

  // ── Writes ──────────────────────────────────────────────────────────────

  async create(tenant: TenantContext, m: Manuscript): Promise<void> {
    if (m.tenantId !== tenant.tenantId) {
      throw new Error("manuscript tenantId does not match session tenant")
    }
    await this.graph.withSession(tenant, async (s) => {
      await s.run({
        cypher: `
          CREATE (m:Manuscript {
            id:           $id,
            tenant_id:    $tenant_id,
            title:        $title,
            status:       $status,
            doi:          $doi,
            abstract:     $abstract,
            submitted_at: $submitted_at,
            created_at:   timestamp()
          })
        `,
        params: {
          id:           m.id,
          tenant_id:    m.tenantId,
          title:        m.title,
          status:       m.status,
          doi:          m.doi ?? null,
          abstract:     m.abstract ?? null,
          submitted_at: m.submittedAt?.toISOString() ?? null,
        },
        returnAliases: [],
      })
    })
  }

  /** Idempotent create-or-update via portable mergeNode(). */
  async upsert(tenant: TenantContext, m: Manuscript): Promise<void> {
    await this.graph.withSession(tenant, async (s) => {
      await mergeNode(s, "Manuscript", "id", {
        id:           m.id,
        tenant_id:    m.tenantId,
        title:        m.title,
        status:       m.status,
        doi:          m.doi ?? null,
        abstract:     m.abstract ?? null,
        submitted_at: m.submittedAt?.toISOString() ?? null,
      })
    })
  }

  async setStatus(
    tenant: TenantContext,
    manuscriptId: string,
    status: string
  ): Promise<void> {
    await this.graph.withSession(tenant, async (s) => {
      await s.run({
        cypher: `
          MATCH (m:Manuscript {id: $id, tenant_id: $tenant_id})
          SET m.status = $status
        `,
        params: { id: manuscriptId, tenant_id: tenant.tenantId, status },
        returnAliases: [],
      })
    })
  }

  async linkAuthor(
    tenant: TenantContext,
    manuscriptId: string,
    authorId: string,
    position: number,
    isCorresponding = false
  ): Promise<void> {
    await this.graph.withSession(tenant, async (s) => {
      await s.run({
        cypher: `
          MATCH (m:Manuscript {id: $mid, tenant_id: $tenant_id}),
                (a:Author     {id: $aid, tenant_id: $tenant_id})
          CREATE (a)-[:AUTHORED {
            position:         $position,
            is_corresponding: $is_corresponding,
            created_at:       timestamp()
          }]->(m)
        `,
        params: {
          mid:              manuscriptId,
          aid:              authorId,
          tenant_id:        tenant.tenantId,
          position,
          is_corresponding: isCorresponding,
        },
        returnAliases: [],
      })
    })
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  async findById(
    tenant: TenantContext,
    manuscriptId: string
  ): Promise<Manuscript | null> {
    return this.graph.withSession(tenant, async (s) => {
      const result = await s.run({
        cypher: `
          MATCH (m:Manuscript {id: $id, tenant_id: $tenant_id})
          RETURN m
        `,
        params: { id: manuscriptId, tenant_id: tenant.tenantId },
        returnAliases: ["m"],
      })
      const row = result.single()
      return row ? hydrate(row["m"] as Record<string, unknown>) : null
    })
  }

  async listByStatus(
    tenant: TenantContext,
    status: string,
    limit = 50
  ): Promise<Manuscript[]> {
    return this.graph.withSession(tenant, async (s) => {
      const result = await s.run({
        cypher: `
          MATCH (m:Manuscript {tenant_id: $tenant_id, status: $status})
          RETURN m
          ORDER BY m.submitted_at DESC
          LIMIT $limit
        `,
        params: { tenant_id: tenant.tenantId, status, limit },
        returnAliases: ["m"],
      })
      return result.rows.map((r) => hydrate(r["m"] as Record<string, unknown>))
    })
  }
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

function hydrate(node: Record<string, unknown>): Manuscript {
  return {
    id:          node["id"] as string,
    tenantId:    node["tenant_id"] as string,
    title:       node["title"] as string,
    status:      node["status"] as string,
    doi:         (node["doi"] as string | null) ?? null,
    abstract:    (node["abstract"] as string | null) ?? null,
    submittedAt: node["submitted_at"]
      ? new Date(node["submitted_at"] as string)
      : null,
  }
}
