/**
 * Manuscript detail page — E2E tests
 *
 * Runs as ae@test.example.com (Assistant Editor) against the TEST journal.
 * Verifies the manuscript detail page renders correctly — metadata, checklist
 * panel, and activity timeline.
 */

import { test, expect } from "@playwright/test"

const JOURNAL = "TEST"

test.describe("Manuscript detail", () => {
  let manuscriptHref: string

  test.beforeEach(async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/queue`)
    const link = page.locator("a[href*='/manuscripts/']").first()
    await expect(link).toBeVisible({ timeout: 10_000 })
    manuscriptHref = (await link.getAttribute("href"))!
  })

  test("manuscript detail page loads without error", async ({ page }) => {
    await page.goto(manuscriptHref)
    await expect(page).not.toHaveURL(/\/404|error/)
    // Title should render
    await expect(page.locator("h1")).toBeVisible()
  })

  test("shows manuscript metadata panel", async ({ page }) => {
    await page.goto(manuscriptHref)

    // Journal, author, and submitted date are always present
    await expect(page.getByText(/journal/i, { exact: false }).first()).toBeVisible()
    await expect(page.getByText(/submitted/i, { exact: false }).first()).toBeVisible()
    await expect(page.getByText(/author/i,    { exact: false }).first()).toBeVisible()
  })

  test("shows checklist panel", async ({ page }) => {
    await page.goto(manuscriptHref)

    // ChecklistPanel renders a heading with "Checklist" in it
    await expect(page.getByText(/checklist/i).first()).toBeVisible()
  })

  test("shows activity timeline", async ({ page }) => {
    await page.goto(manuscriptHref)

    // ActivityTimeline renders an "Activity" heading
    await expect(page.getByText(/activity/i, { exact: false }).first()).toBeVisible()

    // TEST seed has at least a manuscript.submitted event
    await expect(page.getByText(/submitted/i, { exact: false }).first()).toBeVisible()
  })

  test("breadcrumb links back to queue", async ({ page }) => {
    await page.goto(manuscriptHref)

    // Navigate via href to avoid dev overlay blocking the click
    const queueLink = page.getByRole("link", { name: /checklist queue/i }).first()
    await expect(queueLink).toBeVisible()
    const href = await queueLink.getAttribute("href")
    await page.goto(href!)
    await expect(page).toHaveURL(/\/editorial\/queue/)
  })
})
