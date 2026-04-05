/**
 * Editor-in-Chief dashboard — E2E tests
 *
 * Runs as eic@test.example.com against the TEST journal.
 * Verifies the EIC dashboard loads, shows stats, and displays stalled manuscripts.
 *
 * The TEST seed intentionally has MS-4 and MS-5 with last activity 20+ days ago
 * so the stalled manuscripts widget is always populated.
 */

import { test, expect } from "@playwright/test"

const JOURNAL = "TEST"

test.describe("Editor-in-Chief dashboard", () => {
  test("EIC dashboard loads", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/editor-in-chief`)

    await expect(page.getByRole("heading", { name: /editor.in.chief/i })).toBeVisible()
  })

  test("shows four stat cards", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/editor-in-chief`)

    // Stat cards — target the <p> elements that contain the labels
    await expect(page.locator("p", { hasText: "Checklist Queue" }).first()).toBeVisible()
    await expect(page.locator("p", { hasText: "Under Review" }).first()).toBeVisible()
    await expect(page.locator("p", { hasText: "Awaiting Revision" }).first()).toBeVisible()
    await expect(page.locator("p", { hasText: /Stalled/ }).first()).toBeVisible()
  })

  test("monthly metrics panel renders", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/editor-in-chief`)

    await expect(page.getByText(/submissions this month/i)).toBeVisible()
    await expect(page.getByText(/avg.*days to decision/i)).toBeVisible()
  })

  test("stalled manuscripts section shows entries", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/editor-in-chief`)

    // The TEST seed has 2 stalled manuscripts (20d+)
    await expect(page.getByText(/stalled manuscripts/i)).toBeVisible()

    const stalledLinks = page.locator("a[href*='/manuscripts/']")
    await expect(stalledLinks.first()).toBeVisible()
  })

  test("recent decisions section renders", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/editor-in-chief`)

    await expect(page.getByText(/recent decisions/i)).toBeVisible()
    // TEST seed has an accepted and a rejected manuscript with decision.sent events
    const decisionLinks = page.locator("a[href*='/manuscripts/']")
    await expect(decisionLinks.first()).toBeVisible()
  })

  test("stalled manuscript links to detail page", async ({ page }) => {
    await page.goto(`/journal/${JOURNAL}/editorial/editor-in-chief`)

    const stalledLink = page.locator("a[href*='/manuscripts/']").first()
    const href = await stalledLink.getAttribute("href")
    await page.goto(href!)
    await expect(page).toHaveURL(/\/editorial\/manuscripts\/[0-9a-f-]+/)
  })
})
