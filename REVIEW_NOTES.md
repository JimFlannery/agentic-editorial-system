# Graph Subsystem — Review Notes

> Captured from a pre-Phase-1 design review. Each item below is a risk
> raised during scaffold review, the chosen disposition, and the follow-up
> action. This file lives alongside `SPEC.md §9 (Open questions)` but
> covers a different category: §9 is *decisions still to make*; this file
> is *risks already triaged with an action queued*.
>
> **Intended location:** `docs/graph/REVIEW_NOTES.md`

## 1. `merge_node()` race on Nebula

**Risk.** `merge_node()` on Nebula is implemented as MATCH-then-CREATE
(see `repository.py`). Two concurrent calls with the same key can both
miss the MATCH and both proceed to CREATE. The UUID `id` *should* cause
the second CREATE to fail on VID conflict rather than silently produce a
duplicate vertex — but Nebula's actual behavior on VID collision needs
to be confirmed by test, not assumed.

**Status.** Acknowledged. May need to tweak the helper.

**Next action.** During Phase 3 (Nebula backend), add a concurrency test
to `BackendParityTestSuite` that fires two simultaneous `merge_node()`
calls with the same key against a clean space. Assert exactly one
succeeds and the resulting graph contains exactly one vertex. If Nebula
is permissive (writes both, last-write-wins on properties), wrap the
CREATE branch in optimistic retry: catch the conflict, re-run the MATCH
path, treat as merge.

## 2. Source AGE retention after cutover

**Risk.** SPEC §6 drops the source AGE graph seven days after cutover.
That window is tight for a tenant-impacting operation — regrets surfaced
on day 8 are unrecoverable without a parallel backup pipeline.

**Status.** Agreed. Push the export bundle to S3 Glacier for
longer-term archival retention before allowing the AGE graph to be
dropped.

**Next action.** Before the Phase 5 cutover runbook ships:

- Add an S3 Glacier snapshot step between export and Nebula import in
  `migration.py`. Snapshot writes the same CSVs that feed nebula-importer,
  plus the `ExportManifest` and a checksum file. Pick a Glacier tier
  (Glacier Instant / Flexible / Deep Archive) based on the recovery-time
  expectation set in the runbook — Deep Archive is cheapest but has a
  12-hour-ish retrieval window, which is fine for "tenant regrets" but
  not for an active rollback.
- Make the AGE-graph retention window configurable per tenant tier. The
  seven-day default in SPEC §6 is a sketch — update it to a longer value
  once the snapshot pipeline exists, and consider keeping AGE indefinitely
  until first storage cost pressure.
- Document the restore-from-Glacier procedure in `docs/graph/RUNBOOK.md`
  (TBD as of this writing).

## 3. Online schema migration story

**Risk.** SPEC §4 mentions bumping the schema version string in
`ExportManifest` for breaking changes, but there is no story for what
happens to live tenants when the schema evolves. AGE is forgiving — it
stores everything as JSONB and ignores most schema constraints at the
storage layer. Nebula is strict and will reject writes that violate a
newly-added `NOT NULL` or a narrowed type. The two backends will not
behave the same way under a v0.1 → v0.2 schema bump, and a tenant on
the growth tier could fail writes that would have been silently
accepted on starter.

**Status.** Noted. Requires a deep dive before any breaking schema
change ships.

**Next action.** Deep-dive task before Phase 5. Decide between two
postures and document the choice in SPEC.md:

- **Additive-only rule.** Schema changes can only add new tags/edges
  or new nullable properties. Anything else (rename, type change, new
  NOT NULL without default) requires a major version bump and a
  per-tenant migration job. Cheap to operate; probably correct for v0.x.
- **Per-tenant online migration.** Each schema version has a forward
  migration script; tenants are upgraded individually, with the domain
  layer carrying both schemas during the transition window. Unavoidable
  eventually but expensive to build right.

Until this is decided, treat all schema changes as additive-only by
convention.

## 4. Nebula `merge_node()` round-trip cost

**Risk.** On Nebula, `merge_node()` issues three statements (MATCH →
CREATE/SET → MATCH-to-return) where AGE issues one MERGE. For editorial
workflow throughput this is invisible. For bulk-import workloads —
seeding citation graphs from a DOI dump, ingesting historical manuscript
archives, importing reviewer pools from a third-party system — the 3×
cost is real and will dominate ingest time.

**Status.** Deferred. The hope is a better primitive (native Nebula
upsert support, or a different approach altogether) becomes available
before bulk-import is on the critical path.

**Next action.** Track as a performance backlog item. Revisit when the
first bulk-import use case lands (most likely a DOI/citations ingest).
Mitigations to evaluate at that point:

- Parse the CREATE response directly to skip the trailing MATCH (saves
  one round-trip).
- Pipeline batches of MATCHes ahead of CREATEs (latency hiding via
  concurrency).
- Add a separate `bulk_upsert_nodes()` primitive that bypasses the
  per-node helper and uses Nebula's `INSERT VERTEX` with `IF NOT EXISTS`.
- Re-check the Nebula release notes for native upsert support — this is
  the path of least resistance if it lands.

## 5. AGE → Nebula cutover trigger

**Risk.** "When does a tenant get migrated to the growth tier" needs to
be a metric-driven decision, not a judgment call made under operational
pressure. Without an explicit trigger, the upgrade either happens too
late (after pain) or too early (paying for Nebula without needing it).

**Status.** Agreed. The real-world cutover threshold will be set
empirically from performance metrics gathered against live traffic.

**Next action.** Capture the following metrics from Phase 1 onward so
the threshold can be derived from data rather than guessed:

- Graph size per tenant: node count, edge count, total bytes on disk.
- p95 / p99 read query latency, broken down by query shape (point
  lookups, 1-hop, 2-hop, multi-hop).
- Write QPS per tenant, both peak and sustained.
- Postgres connection-pool saturation across all tenants on the shared
  AGE instance.
- AGE catalog-bloat indicators: `pg_class` row count growth over time,
  planner latency on schema-introspection queries, vacuum lag on the
  `ag_catalog` schema.

Once one or more starter tenants are running production workloads,
review the distribution and write named threshold values into SPEC §3,
replacing the current narrative description with concrete numbers
(e.g. "trigger evaluation at >X nodes OR >Y write QPS sustained for
Z days").
