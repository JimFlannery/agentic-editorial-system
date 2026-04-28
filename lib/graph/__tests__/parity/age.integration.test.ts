/**
 * AGE backend parity tests.
 *
 * Runs the full BackendParityTestSuite against a live Postgres+AGE instance.
 * Requires DATABASE_URL to be set (loaded from .env.local by jest setup.ts).
 * Set SKIP_GRAPH_INTEGRATION=1 to skip when no database is available.
 *
 * Phase 3: nebula.integration.test.ts will run the same suite against Nebula.
 */

import { AGERepository } from "../../repository"
import { getPool } from "../../pool"
import { runBackendParityTests } from "./suite"

const skip =
  !process.env.DATABASE_URL ||
  process.env.SKIP_GRAPH_INTEGRATION === "1"

;(skip ? describe.skip : describe)(
  "BackendParityTestSuite — AGE (Postgres 18 + AGE 1.7)",
  () => {
    runBackendParityTests({
      async create() {
        return new AGERepository()
      },
      async destroy() {
        await getPool().end()
      },
    })
  }
)
