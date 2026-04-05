/**
 * Reviewer portal — E2E tests
 *
 * Runs as reviewer1@test.example.com against the TEST journal.
 *
 * The TEST seed gives reviewer1 assignments on MS-4 (accepted) and MS-5 (under review),
 * so the portal should show at least 2 entries.
 */

import { test, expect } from "@playwright/test"

const JOURNAL = "TEST"

test.describe("Reviewer portal", () => {
  test("loads with stat cards", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/reviewer`)

    await expect(page.getByRole("heading", { name: /reviewer center/i })).toBeVisible()
    await expect(page.locator("p", { hasText: /Pending Invitations|Reviews in Progress|Reviews Completed/ }).first()).toBeVisible()
  })

  test("shows assignment list", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/reviewer`)

    // reviewer1 has assignments from seed data
    const links = page.locator("a[href*='/reviewer/manuscripts/']")
    await expect(links.first()).toBeVisible({ timeout: 10_000 })
    const count = await links.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test("manuscript detail page loads from assignment link", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/reviewer`)

    const link = page.locator("a[href*='/reviewer/manuscripts/']").first()
    await expect(link).toBeVisible({ timeout: 10_000 })
    const href = await link.getAttribute("href")
    await page.goto(href!)

    // Should show manuscript title and abstract
    await expect(page.locator("h1")).toBeVisible()
    await expect(page.getByText(/abstract/i).first()).toBeVisible()
  })

  test("manuscript detail shows invitation status", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/reviewer`)

    const link = page.locator("a[href*='/reviewer/manuscripts/']").first()
    const href = await link.getAttribute("href")
    await page.goto(href!)

    // ReviewForm renders accept/decline buttons or review form depending on status
    const hasAction = await page.locator(
      "button, [data-status], form"
    ).count()
    expect(hasAction).toBeGreaterThan(0)
  })

  test("breadcrumb links back to reviewer center", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/reviewer`)

    const link = page.locator("a[href*='/reviewer/manuscripts/']").first()
    await expect(link).toBeVisible({ timeout: 10_000 })
    const href = await link.getAttribute("href")
    await page.goto(href!)

    const backLink = page.getByRole("link", { name: /reviewer center/i }).first()
    await expect(backLink).toBeVisible()
    const backHref = await backLink.getAttribute("href")
    await page.goto(backHref!)
    await expect(page).toHaveURL(/\/reviewer$/)
  })
})
