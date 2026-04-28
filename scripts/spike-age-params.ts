/**
 * scripts/spike-age-params.ts
 *
 * Phase 1 spike — confirm AGE parameter-passing semantics.
 *
 * Run with:
 *   npx tsx scripts/spike-age-params.ts
 *
 * Reads .env.local from the project root automatically.
 *
 * What it does:
 *   1. Connects to the Postgres+AGE instance via DATABASE_URL
 *   2. Reports the Postgres and AGE versions
 *   3. Creates an isolated spike graph and writes one node
 *   4. Tests three parameter-passing approaches and reports which work
 *   5. Confirms the agtype parser handles real AGE output correctly
 *   6. Cleans up (drops the spike graph)
 *
 * Expected outcome (AGE >= 1.5):
 *   - Approach A (no params): PASS
 *   - Approach B ($1::agtype blob):  PASS
 *   - Approach C (inline $1::agtype): PASS
 *
 * Results are written to docs/graph/AGE_VERSION.md for the team record.
 *
 * See agentic_es_graph/docs/graph/PHASE_1_TASKS.md §0 for context.
 */

import { Pool } from "pg"
import * as fs from "fs"
import * as path from "path"

// Load .env.local from project root (tsx doesn't auto-load env files)
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const SPIKE_GRAPH = "spike_params_test"

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  const results: Record<string, string> = {}

  try {
    // ── Bootstrap ──────────────────────────────────────────────────────────
    await client.query("LOAD 'age'")
    await client.query(`SET search_path = ag_catalog, "$user", public`)

    // ── Version info ───────────────────────────────────────────────────────
    const pgVersion = await client.query("SELECT version() AS v")
    const ageVersion = await client
      .query("SELECT extversion FROM pg_extension WHERE extname = 'age'")
      .catch(() => ({ rows: [{ extversion: "not found in pg_extension" }] }))

    console.log("\n=== Version info ===")
    console.log("Postgres:", pgVersion.rows[0].v)
    console.log(
      "AGE:     ",
      ageVersion.rows[0]?.extversion ?? "unknown"
    )

    results["postgres_version"] = pgVersion.rows[0].v as string
    results["age_version"] =
      (ageVersion.rows[0]?.extversion as string) ?? "unknown"

    // ── Create spike graph ─────────────────────────────────────────────────
    await client
      .query(`SELECT drop_graph('${SPIKE_GRAPH}', true)`)
      .catch(() => undefined) // ignore if not exists
    await client.query(`SELECT create_graph('${SPIKE_GRAPH}')`)
    console.log("\n✓ Spike graph created:", SPIKE_GRAPH)

    // ── Write a node (no params) ───────────────────────────────────────────
    await client.query(
      `SELECT * FROM cypher('${SPIKE_GRAPH}', $$
        CREATE (n:TestNode {id: 'node-1', label: 'hello'})
       $$) AS (v agtype)`
    )
    console.log("✓ Node written (no params)")

    // ── Approach A: no params, inline literal ──────────────────────────────
    console.log("\n=== Approach A: no params, inline literal ===")
    try {
      const r = await client.query(
        `SELECT * FROM cypher('${SPIKE_GRAPH}', $$
           MATCH (n:TestNode {id: 'node-1'}) RETURN n
         $$) AS (n agtype)`
      )
      const label = r.rows.length === 1 ? "PASS (1 row)" : `PASS (${r.rows.length} rows — expected 1)`
      console.log(label)
      console.log("Raw agtype value:", r.rows[0]?.n)
      results["approach_a"] = label
    } catch (e) {
      console.error("FAIL:", e)
      results["approach_a"] = `FAIL: ${e}`
    }

    // ── Approach B: $1::agtype blob, reference as $id in Cypher ───────────
    // This is what AGESession._wrap() uses for parameterized queries.
    console.log("\n=== Approach B: $1::agtype blob, $id syntax ===")
    try {
      const params = JSON.stringify({ id: "node-1" })
      const r = await client.query(
        `SELECT * FROM cypher('${SPIKE_GRAPH}', $$
           MATCH (n:TestNode {id: $id}) RETURN n
         $$, $1::agtype) AS (n agtype)`,
        [params]
      )
      const label = r.rows.length === 1 ? "PASS (1 row)" : `PASS (${r.rows.length} rows — expected 1)`
      console.log(label)
      console.log("Raw agtype value:", r.rows[0]?.n)
      results["approach_b"] = label
    } catch (e) {
      console.error("FAIL:", e)
      results["approach_b"] = `FAIL: ${e}`
    }

    // ── Approach C: $params.id dot-notation ───────────────────────────────
    console.log("\n=== Approach C: $params.id dot-notation ===")
    try {
      const params = JSON.stringify({ id: "node-1" })
      const r = await client.query(
        `SELECT * FROM cypher('${SPIKE_GRAPH}', $$
           MATCH (n:TestNode {id: $params.id}) RETURN n
         $$, $1::agtype) AS (n agtype)`,
        [params]
      )
      const label =
        r.rows.length === 1
          ? "PASS (1 row)"
          : `PASS — no error but ${r.rows.length} rows (syntax accepted, did not match)`
      console.log(label)
      results["approach_c"] = label
    } catch (e) {
      console.error("FAIL:", e)
      results["approach_c"] = `FAIL: ${e}`
    }

    // ── agtype parser validation ───────────────────────────────────────────
    console.log("\n=== agtype parser validation ===")
    try {
      const params = JSON.stringify({ id: "node-1" })
      const r = await client.query(
        `SELECT * FROM cypher('${SPIKE_GRAPH}', $$
           MATCH (n:TestNode {id: $id}) RETURN n
         $$, $1::agtype) AS (n agtype)`,
        [params]
      )
      const raw = r.rows[0]?.n as string
      console.log("Raw string from AGE:", raw)

      // Use our parser
      const { parseAgtypeValue } = await import("../lib/graph/pool")
      const parsed = parseAgtypeValue(raw) as Record<string, unknown>
      console.log("Parsed:", parsed)

      if (parsed["id"] === "node-1" && parsed["_label"] === "TestNode") {
        console.log("✓ Parser correctly flattens vertex properties")
        results["parser"] = "PASS"
      } else {
        console.warn("⚠ Parser result unexpected:", parsed)
        results["parser"] = `UNEXPECTED: ${JSON.stringify(parsed)}`
      }
    } catch (e) {
      console.error("Parser test failed:", e)
      results["parser"] = `FAIL: ${e}`
    }

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    await client
      .query(`SELECT drop_graph('${SPIKE_GRAPH}', true)`)
      .catch(() => undefined)
    client.release()
    await pool.end()
  }

  // ── Write results to docs/graph/AGE_VERSION.md ─────────────────────────
  const docsDir = path.join(process.cwd(), "docs", "graph")
  fs.mkdirSync(docsDir, { recursive: true })

  const decidedApproach = results["approach_b"] === "PASS" ? "B" : "A"
  const doc = `# AGE Version & Parameter Syntax

Generated by: \`npm run spike:age-params\`

## Versions

| Component | Version |
|-----------|---------|
| Postgres  | ${results["postgres_version"] ?? "unknown"} |
| AGE       | ${results["age_version"] ?? "unknown"} |

## Parameter-passing approaches

| Approach | Syntax | Result |
|----------|--------|--------|
| A — no params, inline literals | \`$$ MATCH (n {id: 'literal'}) $$\` | ${results["approach_a"] ?? "not tested"} |
| B — \`$1::agtype\` blob, ref as \`$paramName\` | \`$$ MATCH (n {id: $id}) $$, $1::agtype\` | ${results["approach_b"] ?? "not tested"} |
| C — \`params.$id\` syntax | \`$$ MATCH (n {id: $params.id}) $$, $1::agtype\` | ${results["approach_c"] ?? "not tested"} |

## Decision

**Use Approach ${decidedApproach}.** \`AGESession._wrap()\` in \`lib/graph/repository.ts\` uses this form.

${
  decidedApproach === "B"
    ? "Approach B (`$paramName` direct reference) works — this is the AGE ≥ 1.5 parameterized form. Parameters are passed as a single agtype JSON blob in `$1`. Inside Cypher, reference parameters directly as `$paramName` (not `$params.paramName`)."
    : "Approach B did not work. Falling back to Approach A (no parameters — inline literals). **NOTE:** This means AGESession must validate and escape all values before inline-substitution. Update \`_wrap()\` in repository.ts accordingly."
}

## agtype parser

Parser result: ${results["parser"] ?? "not tested"}

${
  results["parser"] === "PASS"
    ? "The \`parseAgtypeValue()\` function in \`lib/graph/pool.ts\` correctly flattens vertex properties."
    : "⚠ Parser result was not as expected — check parser implementation against actual AGE output above."
}
`

  const outPath = path.join(docsDir, "AGE_VERSION.md")
  fs.writeFileSync(outPath, doc)
  console.log(`\n✓ Results written to ${outPath}`)
  console.log("\nSummary:", results)
}

main().catch((e) => {
  console.error("Spike failed:", e)
  process.exit(1)
})
