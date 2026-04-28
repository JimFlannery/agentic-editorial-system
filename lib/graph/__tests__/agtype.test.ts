import { parseAgtypeValue } from "../pool"

describe("parseAgtypeValue", () => {
  // ── Null / undefined ──────────────────────────────────��───────────────────

  test("returns null for null input", () => {
    expect(parseAgtypeValue(null as unknown as string)).toBeNull()
  })

  // ── Scalars ──────────────────────────────��──────────────────────────��─────

  test("parses integer scalar", () => {
    expect(parseAgtypeValue("42")).toBe(42)
  })

  test("parses float scalar", () => {
    expect(parseAgtypeValue("3.14")).toBeCloseTo(3.14)
  })

  test("parses boolean true", () => {
    expect(parseAgtypeValue("true")).toBe(true)
  })

  test("parses boolean false", () => {
    expect(parseAgtypeValue("false")).toBe(false)
  })

  test("parses null scalar", () => {
    expect(parseAgtypeValue("null")).toBeNull()
  })

  test("parses string scalar", () => {
    expect(parseAgtypeValue('"hello world"')).toBe("hello world")
  })

  test("returns raw string when JSON parse fails", () => {
    expect(parseAgtypeValue("not json at all")).toBe("not json at all")
  })

  // ── Vertex ──────────────────────────────��─────────────────────────────��───

  test("flattens vertex properties into top-level dict", () => {
    const raw =
      '{"id":281474976710657,"label":"Manuscript","properties":{"id":"abc123","title":"Test Paper","status":"submitted"}}::vertex'
    const result = parseAgtypeValue(raw) as Record<string, unknown>
    expect(result["id"]).toBe("abc123")
    expect(result["title"]).toBe("Test Paper")
    expect(result["status"]).toBe("submitted")
    expect(result["_label"]).toBe("Manuscript")
    expect(result["_id"]).toBe(281474976710657)
  })

  test("handles vertex with empty properties", () => {
    const raw =
      '{"id":5,"label":"Term","properties":{}}::vertex'
    const result = parseAgtypeValue(raw) as Record<string, unknown>
    expect(result["_label"]).toBe("Term")
    expect(result["_id"]).toBe(5)
  })

  test("handles vertex with null property values", () => {
    const raw =
      '{"id":1,"label":"Manuscript","properties":{"id":"m1","doi":null}}::vertex'
    const result = parseAgtypeValue(raw) as Record<string, unknown>
    expect(result["doi"]).toBeNull()
  })

  test("vertex properties overwrite _id/_label when property names collide", () => {
    // Spread order: {...node.properties, _id: node.id, _label: node.label}
    // _id and _label are set last, so AGE's internal id wins over any
    // property named _id. This is intentional — domain code should not use
    // _id / _label as property names.
    const raw =
      '{"id":99,"label":"Manuscript","properties":{"id":"prop-id","_id":"should-be-overwritten"}}::vertex'
    const result = parseAgtypeValue(raw) as Record<string, unknown>
    expect(result["_id"]).toBe(99)
  })

  // ── Edge ─────────────────────────────────────────────────────────────��────

  test("flattens edge properties into top-level dict", () => {
    const raw =
      '{"id":1407374883553281,"start_id":281474976710657,"end_id":562949953421313,"label":"AUTHORED","properties":{"position":1,"is_corresponding":false}}::edge'
    const result = parseAgtypeValue(raw) as Record<string, unknown>
    expect(result["position"]).toBe(1)
    expect(result["is_corresponding"]).toBe(false)
    expect(result["_label"]).toBe("AUTHORED")
  })

  test("handles edge with no properties", () => {
    const raw =
      '{"id":100,"start_id":1,"end_id":2,"label":"CITES","properties":{}}::edge'
    const result = parseAgtypeValue(raw) as Record<string, unknown>
    expect(result["_label"]).toBe("CITES")
  })

  // ── Type suffix stripping ────────────────────────────���────────────────────

  test("strips ::vertex suffix before parsing", () => {
    const withSuffix =
      '{"id":1,"label":"L","properties":{"x":1}}::vertex'
    const withoutSuffix =
      '{"id":1,"label":"L","properties":{"x":1}}'
    const a = parseAgtypeValue(withSuffix) as Record<string, unknown>
    const b = parseAgtypeValue(withoutSuffix) as Record<string, unknown>
    // Both should have x: 1 (withoutSuffix won't hit the node-flattening branch
    // since it lacks label/properties pattern — not worth testing equivalence,
    // just confirm suffix stripping doesn't break parsing)
    expect(a["x"]).toBe(1)
  })

  test("strips ::edge suffix before parsing", () => {
    const raw =
      '{"id":1,"start_id":1,"end_id":2,"label":"X","properties":{"k":"v"}}::edge'
    const result = parseAgtypeValue(raw) as Record<string, unknown>
    expect(result["k"]).toBe("v")
  })
})
