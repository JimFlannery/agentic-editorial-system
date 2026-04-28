/**
 * Jest setup file for the graph test suite.
 * Loads .env.local so integration tests can reach the live Postgres+AGE instance.
 * Run with SKIP_GRAPH_INTEGRATION=1 to skip integration tests without a database.
 */
import * as fs from "fs"
import * as path from "path"

const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim()
      if (!(key in process.env)) process.env[key] = val
    }
  }
}
