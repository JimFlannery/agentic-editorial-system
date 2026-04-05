/**
 * Puppeteer smoke tests — all key pages return HTTP 200
 *
 * Uses a logged-in session for each role and walks through the primary
 * pages of the TEST journal, asserting no page returns an error status.
 *
 * Run with: npm run test:puppeteer
 */

import { Browser, Page } from "puppeteer"
import { launchBrowser, loginAs, assertPageOk, BASE_URL } from "./helpers"

const JOURNAL = "TEST"

describe("Smoke tests — TEST journal", () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    browser = await launchBrowser()
  })

  afterAll(async () => {
    await browser.close()
  })

  beforeEach(async () => {
    page = await browser.newPage()
  })

  afterEach(async () => {
    await page.close()
  })

  // ── Public / unauthenticated ─────────────────────────────────────────

  test("platform landing page loads", async () => {
    const title = await assertPageOk(page, BASE_URL)
    expect(title).toBeTruthy()
  })

  test("login page loads", async () => {
    await assertPageOk(page, `${BASE_URL}/login`)
    const emailInput = await page.$('input[type="email"], input[name="email"]')
    expect(emailInput).not.toBeNull()
  })

  // ── Author role ──────────────────────────────────────────────────────

  test("author portal loads after login", async () => {
    await loginAs(page, "author1@test.example.com")
    await assertPageOk(page, `${BASE_URL}/journal/${JOURNAL}/author`)
  })

  test("author submission form loads", async () => {
    await loginAs(page, "author1@test.example.com")
    await assertPageOk(page, `${BASE_URL}/journal/${JOURNAL}/author/submit`)
  })

  // ── Assistant Editor role ────────────────────────────────────────────

  test("AE dashboard loads after login", async () => {
    await loginAs(page, "ae@test.example.com")
    await assertPageOk(page, `${BASE_URL}/journal/${JOURNAL}/editorial/assistant-editor`)
  })

  test("editorial queue loads", async () => {
    await loginAs(page, "ae@test.example.com")
    await assertPageOk(page, `${BASE_URL}/journal/${JOURNAL}/editorial/queue`)
  })

  // ── Editor-in-Chief role ─────────────────────────────────────────────

  test("EIC dashboard loads after login", async () => {
    await loginAs(page, "eic@test.example.com")
    await assertPageOk(page, `${BASE_URL}/journal/${JOURNAL}/editorial/editor-in-chief`)
  })

  // ── Editorial Support role ───────────────────────────────────────────

  test("editorial support dashboard loads", async () => {
    await loginAs(page, "support@test.example.com")
    await assertPageOk(page, `${BASE_URL}/journal/${JOURNAL}/editorial/editorial-support`)
  })

  // ── Reviewer role ────────────────────────────────────────────────────

  test("reviewer portal loads after login", async () => {
    await loginAs(page, "reviewer1@test.example.com")
    await assertPageOk(page, `${BASE_URL}/journal/${JOURNAL}/reviewer`)
  })
})
