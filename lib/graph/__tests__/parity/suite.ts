/**
 * lib/graph/__tests__/parity/suite.ts
 *
 * BackendParityTestSuite — runs identical scenarios against any GraphRepository
 * implementation. Call runBackendParityTests() from a backend-specific test file.
 *
 * Phase 1: called from age.integration.test.ts with AGERepository.
 * Phase 3: called from nebula.integration.test.ts with NebulaRepository.
 * Both must produce identical results for every scenario.
 */

import { GraphRepository, TenantContext, Tier, mergeNode, newId } from "../../repository"
import { ManuscriptRepository, newManuscript } from "../../domain/manuscript"

export interface RepoFactory {
  /** Called once before the suite. Return the connected repository. */
  create(): Promise<GraphRepository>
  /** Called once after the suite. Close connections, stop containers, etc. */
  destroy(repo: GraphRepository): Promise<void>
}

export function runBackendParityTests(factory: RepoFactory): void {
  let repo: GraphRepository
  let tenant: TenantContext
  let manuscripts: ManuscriptRepository

  beforeAll(async () => {
    repo = await factory.create()
  })

  afterAll(async () => {
    await factory.destroy(repo)
  })

  beforeEach(async () => {
    // Fresh tenant per test — no cross-test contamination.
    tenant = new TenantContext(newId(), Tier.STARTER)
    await repo.ensureTenantSchema(tenant)
    manuscripts = new ManuscriptRepository(repo)
  })

  afterEach(async () => {
    await repo.dropTenant(tenant).catch(() => undefined)
  })

  // ── Schema management ──────────────────────────────────────────────────────

  describe("ensureTenantSchema", () => {
    it("creates the graph so writes succeed", async () => {
      // Schema was created in beforeEach. Verify by writing a node.
      await expect(
        repo.withSession(tenant, async (s) => {
          await s.run({
            cypher: "CREATE (n:Ping {id: $id})",
            params: { id: newId() },
            returnAliases: [],
          })
        })
      ).resolves.not.toThrow()
    })

    it("is idempotent — second call does not error", async () => {
      await expect(repo.ensureTenantSchema(tenant)).resolves.not.toThrow()
    })
  })

  describe("dropTenant", () => {
    it("drops a tenant that exists", async () => {
      const extra = new TenantContext(newId(), Tier.STARTER)
      await repo.ensureTenantSchema(extra)
      await expect(repo.dropTenant(extra)).resolves.not.toThrow()
    })

    it("is idempotent — dropping a non-existent tenant does not error", async () => {
      const ghost = new TenantContext(newId(), Tier.STARTER)
      await expect(repo.dropTenant(ghost)).resolves.not.toThrow()
    })
  })

  // ── ManuscriptRepository ───────────────────────────────────────────────────

  describe("ManuscriptRepository.create + findById", () => {
    it("round-trips all scalar fields", async () => {
      const m = newManuscript(tenant.tenantId, "Round-trip Paper", "An abstract.")
      await manuscripts.create(tenant, m)

      const found = await manuscripts.findById(tenant, m.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(m.id)
      expect(found!.tenantId).toBe(tenant.tenantId)
      expect(found!.title).toBe("Round-trip Paper")
      expect(found!.status).toBe("submitted")
      expect(found!.abstract).toBe("An abstract.")
    })

    it("returns null for an unknown id", async () => {
      const found = await manuscripts.findById(tenant, newId())
      expect(found).toBeNull()
    })

    it("stores null optional fields without error", async () => {
      const m = newManuscript(tenant.tenantId, "No Abstract")
      await manuscripts.create(tenant, m)
      const found = await manuscripts.findById(tenant, m.id)
      expect(found!.abstract).toBeNull()
      expect(found!.doi).toBeNull()
    })
  })

  describe("ManuscriptRepository.setStatus", () => {
    it("updates the status and the change is visible on findById", async () => {
      const m = newManuscript(tenant.tenantId, "Status Paper")
      await manuscripts.create(tenant, m)

      await manuscripts.setStatus(tenant, m.id, "in_review")

      const found = await manuscripts.findById(tenant, m.id)
      expect(found!.status).toBe("in_review")
    })

    it("setStatus on an unknown id is a no-op (does not error)", async () => {
      await expect(
        manuscripts.setStatus(tenant, newId(), "accepted")
      ).resolves.not.toThrow()
    })
  })

  describe("ManuscriptRepository.listByStatus", () => {
    it("returns manuscripts matching the given status", async () => {
      const a = newManuscript(tenant.tenantId, "Paper A")           // submitted
      const b = newManuscript(tenant.tenantId, "Paper B")
      b.status = "in_review"
      await manuscripts.create(tenant, a)
      await manuscripts.create(tenant, b)

      const submitted = await manuscripts.listByStatus(tenant, "submitted")
      expect(submitted.length).toBe(1)
      expect(submitted[0].id).toBe(a.id)
    })

    it("returns empty array when no manuscripts match", async () => {
      const results = await manuscripts.listByStatus(tenant, "accepted")
      expect(results).toEqual([])
    })

    it("returns multiple manuscripts with the same status", async () => {
      await manuscripts.create(tenant, newManuscript(tenant.tenantId, "P1"))
      await manuscripts.create(tenant, newManuscript(tenant.tenantId, "P2"))
      await manuscripts.create(tenant, newManuscript(tenant.tenantId, "P3"))

      const results = await manuscripts.listByStatus(tenant, "submitted")
      expect(results.length).toBe(3)
    })
  })

  describe("ManuscriptRepository.upsert", () => {
    it("creates a manuscript when it does not exist", async () => {
      const m = newManuscript(tenant.tenantId, "Upsert Create")
      await manuscripts.upsert(tenant, m)

      const found = await manuscripts.findById(tenant, m.id)
      expect(found!.title).toBe("Upsert Create")
    })

    it("updates an existing manuscript", async () => {
      const m = newManuscript(tenant.tenantId, "Original Title")
      await manuscripts.upsert(tenant, m)

      m.title = "Updated Title"
      await manuscripts.upsert(tenant, m)

      const found = await manuscripts.findById(tenant, m.id)
      expect(found!.title).toBe("Updated Title")
    })

    it("is idempotent — calling twice with identical data produces one node", async () => {
      const m = newManuscript(tenant.tenantId, "Idempotent Upsert")
      await manuscripts.upsert(tenant, m)
      await manuscripts.upsert(tenant, m)

      const all = await manuscripts.listByStatus(tenant, "submitted")
      expect(all.length).toBe(1)
    })
  })

  // ── mergeNode primitive ────────────────────────────────────────────────────

  describe("mergeNode", () => {
    it("creates a node when it does not exist", async () => {
      const id = newId()
      await repo.withSession(tenant, async (s) => {
        await mergeNode(s, "Manuscript", "id", {
          id,
          tenant_id: tenant.tenantId,
          title: "Merge Create",
          status: "submitted",
        })
      })

      const found = await manuscripts.findById(tenant, id)
      expect(found!.title).toBe("Merge Create")
    })

    it("updates properties on an existing node", async () => {
      const m = newManuscript(tenant.tenantId, "Before Merge")
      await manuscripts.create(tenant, m)

      await repo.withSession(tenant, async (s) => {
        await mergeNode(s, "Manuscript", "id", {
          id: m.id,
          tenant_id: tenant.tenantId,
          title: "After Merge",
          status: "submitted",
        })
      })

      const found = await manuscripts.findById(tenant, m.id)
      expect(found!.title).toBe("After Merge")
    })

    it("is idempotent — two merges with the same data produce one node", async () => {
      const id = newId()
      const props = { id, tenant_id: tenant.tenantId, title: "Idempotent Merge", status: "submitted" }

      await repo.withSession(tenant, async (s) => {
        await mergeNode(s, "Manuscript", "id", props)
        await mergeNode(s, "Manuscript", "id", props)
      })

      const all = await manuscripts.listByStatus(tenant, "submitted")
      expect(all.length).toBe(1)
    })
  })

  // ── Tenant isolation ───────────────────────────────────────────────────────

  describe("tenant isolation", () => {
    it("nodes written to tenant A are not visible from tenant B", async () => {
      const tenantB = new TenantContext(newId(), Tier.STARTER)
      await repo.ensureTenantSchema(tenantB)

      try {
        const m = newManuscript(tenant.tenantId, "Tenant A Exclusive")
        await manuscripts.create(tenant, m)

        const msCopyB = new ManuscriptRepository(repo)
        const found = await msCopyB.findById(tenantB, m.id)
        expect(found).toBeNull()
      } finally {
        await repo.dropTenant(tenantB).catch(() => undefined)
      }
    })

    it("same manuscript id in two tenants are independent nodes", async () => {
      const tenantB = new TenantContext(newId(), Tier.STARTER)
      await repo.ensureTenantSchema(tenantB)

      try {
        const sharedId = newId()
        const mA = { ...newManuscript(tenant.tenantId, "Title in A"), id: sharedId }
        const mB = { ...newManuscript(tenantB.tenantId, "Title in B"), id: sharedId }

        const msB = new ManuscriptRepository(repo)
        await manuscripts.create(tenant, mA)
        await msB.create(tenantB, mB)

        const foundA = await manuscripts.findById(tenant, sharedId)
        const foundB = await msB.findById(tenantB, sharedId)

        expect(foundA!.title).toBe("Title in A")
        expect(foundB!.title).toBe("Title in B")
      } finally {
        await repo.dropTenant(tenantB).catch(() => undefined)
      }
    })
  })

  // ── Transaction semantics ──────────────────────────────────────────────────

  describe("transaction rollback", () => {
    it("rolls back a write when the session callback throws", async () => {
      const m = newManuscript(tenant.tenantId, "Rolled Back Paper")

      await expect(
        repo.withSession(tenant, async (s) => {
          await s.run({
            cypher: `
              CREATE (m:Manuscript {
                id: $id, tenant_id: $tenant_id,
                title: $title, status: $status
              })
            `,
            params: {
              id: m.id,
              tenant_id: m.tenantId,
              title: m.title,
              status: m.status,
            },
            returnAliases: [],
          })
          throw new Error("intentional rollback")
        })
      ).rejects.toThrow("intentional rollback")

      const found = await manuscripts.findById(tenant, m.id)
      expect(found).toBeNull()
    })
  })
}
