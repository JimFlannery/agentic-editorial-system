import { DEFAULT_SCHEMA } from "../schema"

const GRAPH = "t_test_tenant"
const SPACE = "t_test_tenant"

describe("DEFAULT_SCHEMA.ageDdl()", () => {
  let stmts: string[]

  beforeAll(() => {
    stmts = DEFAULT_SCHEMA.ageDdl(GRAPH)
  })

  test("produces at least one statement", () => {
    expect(stmts.length).toBeGreaterThan(0)
  })

  test("loads AGE extension", () => {
    expect(stmts.some((s) => s.includes("LOAD 'age'"))).toBe(true)
  })

  test("sets search_path", () => {
    expect(stmts.some((s) => s.includes("SET search_path"))).toBe(true)
  })

  test("creates the graph", () => {
    expect(stmts.some((s) => s.includes(`create_graph('${GRAPH}')`))).toBe(true)
  })

  test("creates a vertex label for each tag in DEFAULT_SCHEMA", () => {
    for (const tag of DEFAULT_SCHEMA.tags) {
      const found = stmts.some(
        (s) => s.includes("create_vlabel") && s.includes(`'${tag.name}'`)
      )
      expect(found).toBe(true)
    }
  })

  test("creates an edge label for each edge in DEFAULT_SCHEMA", () => {
    for (const edge of DEFAULT_SCHEMA.edges) {
      const found = stmts.some(
        (s) => s.includes("create_elabel") && s.includes(`'${edge.name}'`)
      )
      expect(found).toBe(true)
    }
  })

  test("creates an index for the Manuscript.id property", () => {
    const found = stmts.some(
      (s) =>
        s.includes("CREATE INDEX") &&
        s.includes(GRAPH) &&
        s.includes("Manuscript") &&
        s.includes("'\"id\"'")
    )
    expect(found).toBe(true)
  })

  test("creates an index for the Manuscript.status property (marked indexed)", () => {
    const found = stmts.some(
      (s) =>
        s.includes("CREATE INDEX") &&
        s.includes("Manuscript") &&
        s.includes("'\"status\"'")
    )
    expect(found).toBe(true)
  })

  test("uses the supplied graph name in index names", () => {
    const indexStmts = stmts.filter((s) => s.includes("CREATE INDEX"))
    for (const s of indexStmts) {
      expect(s).toContain(GRAPH)
    }
  })

  test("all statements are non-empty strings", () => {
    for (const s of stmts) {
      expect(typeof s).toBe("string")
      expect(s.trim().length).toBeGreaterThan(0)
    }
  })

  test("LOAD 'age' appears before create_graph", () => {
    const loadIdx = stmts.findIndex((s) => s.includes("LOAD 'age'"))
    const graphIdx = stmts.findIndex((s) => s.includes("create_graph"))
    expect(loadIdx).toBeLessThan(graphIdx)
  })

  test("vertex labels are created before indexes", () => {
    const lastVlabel = stmts.reduce(
      (acc, s, i) => (s.includes("create_vlabel") ? i : acc),
      -1
    )
    const firstIndex = stmts.findIndex((s) => s.includes("CREATE INDEX"))
    expect(lastVlabel).toBeLessThan(firstIndex)
  })
})

describe("DEFAULT_SCHEMA.nebulaDdl()", () => {
  let stmts: string[]

  beforeAll(() => {
    stmts = DEFAULT_SCHEMA.nebulaDdl(SPACE)
  })

  test("produces at least one statement", () => {
    expect(stmts.length).toBeGreaterThan(0)
  })

  test("creates the space", () => {
    expect(
      stmts.some((s) => s.includes(`CREATE SPACE IF NOT EXISTS ${SPACE}`))
    ).toBe(true)
  })

  test("selects the space with USE", () => {
    expect(stmts.some((s) => s.trim() === `USE ${SPACE};`)).toBe(true)
  })

  test("creates a TAG for each tag in DEFAULT_SCHEMA", () => {
    for (const tag of DEFAULT_SCHEMA.tags) {
      const found = stmts.some(
        (s) =>
          s.includes("CREATE TAG IF NOT EXISTS") && s.includes(tag.name)
      )
      expect(found).toBe(true)
    }
  })

  test("creates an EDGE for each edge in DEFAULT_SCHEMA", () => {
    for (const edge of DEFAULT_SCHEMA.edges) {
      const found = stmts.some(
        (s) =>
          s.includes("CREATE EDGE IF NOT EXISTS") && s.includes(edge.name)
      )
      expect(found).toBe(true)
    }
  })

  test("creates a TAG INDEX for Manuscript.id (indexed: true)", () => {
    const found = stmts.some(
      (s) =>
        s.includes("CREATE TAG INDEX") &&
        s.includes("Manuscript") &&
        s.includes("id")
    )
    expect(found).toBe(true)
  })

  test("includes REBUILD TAG INDEX for each index", () => {
    const createCount = stmts.filter((s) =>
      s.includes("CREATE TAG INDEX")
    ).length
    const rebuildCount = stmts.filter((s) =>
      s.includes("REBUILD TAG INDEX")
    ).length
    expect(rebuildCount).toBe(createCount)
  })

  test("CREATE SPACE appears before CREATE TAG statements", () => {
    const spaceIdx = stmts.findIndex((s) =>
      s.includes("CREATE SPACE IF NOT EXISTS")
    )
    const firstTagIdx = stmts.findIndex((s) =>
      s.includes("CREATE TAG IF NOT EXISTS")
    )
    expect(spaceIdx).toBeLessThan(firstTagIdx)
  })

  test("CREATE TAG appears before CREATE TAG INDEX", () => {
    const lastTagIdx = stmts.reduce(
      (acc, s, i) => (s.includes("CREATE TAG IF NOT EXISTS") ? i : acc),
      -1
    )
    const firstIndexIdx = stmts.findIndex((s) =>
      s.includes("CREATE TAG INDEX")
    )
    expect(lastTagIdx).toBeLessThan(firstIndexIdx)
  })

  test("all statements are non-empty strings", () => {
    for (const s of stmts) {
      expect(typeof s).toBe("string")
      expect(s.trim().length).toBeGreaterThan(0)
    }
  })
})

describe("DEFAULT_SCHEMA metadata", () => {
  test("has a version string", () => {
    expect(typeof DEFAULT_SCHEMA.version).toBe("string")
    expect(DEFAULT_SCHEMA.version.length).toBeGreaterThan(0)
  })

  test("has at least 7 tags", () => {
    expect(DEFAULT_SCHEMA.tags.length).toBeGreaterThanOrEqual(7)
  })

  test("has at least 8 edges", () => {
    expect(DEFAULT_SCHEMA.edges.length).toBeGreaterThanOrEqual(8)
  })

  test("every tag has an id and tenant_id property", () => {
    for (const tag of DEFAULT_SCHEMA.tags) {
      const names = tag.properties.map((p) => p.name)
      expect(names).toContain("id")
      expect(names).toContain("tenant_id")
    }
  })

  test("every tag's id property is indexed", () => {
    for (const tag of DEFAULT_SCHEMA.tags) {
      const idProp = tag.properties.find((p) => p.name === "id")
      expect(idProp?.indexed).toBe(true)
    }
  })
})
