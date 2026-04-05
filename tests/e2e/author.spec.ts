/**
 * Author portal — E2E tests
 *
 * Runs as author1@test.example.com against the TEST journal.
 */

import { test, expect } from "@playwright/test"

const JOURNAL = "TEST"

test.describe("Author portal", () => {
  test("shows manuscript list with stat cards", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/author`)

    // Stat card labels from STATUS_META
    await expect(page.getByText(/active submissions|awaiting revision|decisions received/i).first()).toBeVisible()
  })

  test("manuscript list links to detail pages", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/author`)

    // Links go to /author/manuscripts/<id>
    const firstLink = page.locator("a[href*='/author/manuscripts/']").first()
    await expect(firstLink).toBeVisible({ timeout: 10_000 })

    const href = await firstLink.getAttribute("href")
    expect(href).toMatch(/\/author\/manuscripts\/[0-9a-f-]+/)
  })

  test("submission form loads", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/author/submit`)

    // Form has a "Manuscript type" label and a Title input
    await expect(page.getByText(/manuscript type/i).first()).toBeVisible()
    await expect(page.locator('input[name="title"]')).toBeVisible()
  })

  test("submit form requires a title", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/author/submit`)

    // Click submit without filling anything — HTML5 validation or server error keeps us here
    const submitBtn = page.locator('button[type="submit"]').first()
    await submitBtn.click({ force: true })

    await expect(page).toHaveURL(/submit/)
  })
})
