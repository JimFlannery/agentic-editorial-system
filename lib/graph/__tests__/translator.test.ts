import { translateCypherToNgql, UnsupportedDialectError } from "../repository"

describe("translateCypherToNgql", () => {
  // ── Pass-through ──────────────────────────────────────────────────────────

  test("passes through a plain MATCH/RETURN query unchanged", () => {
    const q = "MATCH (m:Manuscript {id: $id}) RETURN m"
    expect(translateCypherToNgql(q)).toBe(q)
  })

  test("passes through a CREATE query", () => {
    const q = "CREATE (m:Manuscript {id: $id, title: $title})"
    expect(translateCypherToNgql(q)).toBe(q)
  })

  test("passes through SET and RETURN", () => {
    const q = "MATCH (m:Manuscript {id: $id}) SET m.status = $status RETURN m"
    expect(translateCypherToNgql(q)).toBe(q)
  })

  // ── timestamp() → now() ───────────────────────────────────────────────────

  test("replaces timestamp() with now()", () => {
    const q = "CREATE (m:Manuscript {created_at: timestamp()})"
    expect(translateCypherToNgql(q)).toBe(
      "CREATE (m:Manuscript {created_at: now()})"
    )
  })

  test("replaces multiple timestamp() occurrences", () => {
    const q = "SET m.created_at = timestamp(), m.updated_at = timestamp()"
    expect(translateCypherToNgql(q)).toBe(
      "SET m.created_at = now(), m.updated_at = now()"
    )
  })

  test("replacement is case-insensitive", () => {
    expect(translateCypherToNgql("TIMESTAMP()")).toBe("now()")
    expect(translateCypherToNgql("Timestamp()")).toBe("now()")
  })

  // ── MERGE → UnsupportedDialectError ──────────────────────────────────────

  test("throws on MERGE keyword", () => {
    expect(() =>
      translateCypherToNgql("MERGE (n:Manuscript {id: $id})")
    ).toThrow(UnsupportedDialectError)
  })

  test("MERGE detection is case-insensitive", () => {
    expect(() => translateCypherToNgql("merge (n:Manuscript {id: $id})")).toThrow(
      UnsupportedDialectError
    )
    expect(() => translateCypherToNgql("Merge (n:Manuscript {id: $id})")).toThrow(
      UnsupportedDialectError
    )
  })

  test("does not false-positive on identifiers containing 'merge'", () => {
    // 'emergeFrom' contains 'merge' but is not the keyword
    const q = "MATCH (n {name: 'emergeFrom'}) RETURN n"
    expect(() => translateCypherToNgql(q)).not.toThrow()
  })

  // ── Unsupported patterns ──────────────────────────────────────────────────

  test("throws on size(( pattern", () => {
    expect(() =>
      translateCypherToNgql("RETURN size((n)-[]->(m))")
    ).toThrow(UnsupportedDialectError)
  })

  test("throws on list comprehension [r IN  pattern", () => {
    expect(() =>
      translateCypherToNgql("RETURN [r IN rels | r.x]")
    ).toThrow(UnsupportedDialectError)
  })

  // ── Error type ────────────────────────────────────────────────────────────

  test("UnsupportedDialectError is an instance of Error", () => {
    try {
      translateCypherToNgql("MERGE (n)")
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect(e).toBeInstanceOf(UnsupportedDialectError)
    }
  })
})
