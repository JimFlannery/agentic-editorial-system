/**
 * Editorial queue — E2E tests
 *
 * Runs as ae@test.example.com (Assistant Editor) against the TEST journal.
 * The queue renders manuscript cards as <Link> elements (not table rows or list items).
 */

import { test, expect } from "@playwright/test"

const JOURNAL = "TEST"

test.describe("Editorial queue", () => {
  test("AE dashboard loads with queue stats", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/assistant-editor`)

    await expect(page.getByText(/checklist queue|submitted|queue/i).first()).toBeVisible()
  })

  test("checklist queue lists submitted manuscripts", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/queue`)

    // Queue renders manuscript cards as <a> elements
    const cards = page.locator("a[href*='/manuscripts/']")
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test("queue rows link to manuscript detail", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/queue`)

    const firstLink = page.locator("a[href*='/manuscripts/']").first()
    await expect(firstLink).toBeVisible({ timeout: 10_000 })

    const href = await firstLink.getAttribute("href")
    expect(href).toMatch(/\/editorial\/manuscripts\/[0-9a-f-]+/)
  })

  test("queue shows manuscript title", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/queue`)

    const firstCard = page.locator("a[href*='/manuscripts/']").first()
    await expect(firstCard).toBeVisible({ timeout: 10_000 })
    const text = await firstCard.innerText()
    expect(text.trim().length).toBeGreaterThan(0)
  })
})
