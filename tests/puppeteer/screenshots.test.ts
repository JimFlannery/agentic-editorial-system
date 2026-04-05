/**
 * Puppeteer screenshot tests — captures key page states for visual review.
 *
 * Screenshots are written to tests/puppeteer/screenshots/.
 * Useful for catching layout regressions and documenting the UI in CI.
 *
 * Run with: npm run test:puppeteer
 */

import fs from "fs"
import path from "path"
import { Browser, Page } from "puppeteer"
import { launchBrowser, loginAs, BASE_URL } from "./helpers"

const JOURNAL = "TEST"
const SCREENSHOT_DIR = path.join(__dirname, "screenshots")

beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
})

describe("Screenshot capture — TEST journal", () => {
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
    await page.setViewport({ width: 1280, height: 900 })
  })

  afterEach(async () => {
    await page.close()
  })

  async function capture(name: string) {
    const file = path.join(SCREENSHOT_DIR, `${name}.png`)
    await page.screenshot({ path: file, fullPage: true })
  }

  test("platform landing page", async () => {
    await page.goto(BASE_URL, { waitUntil: "networkidle2" })
    await capture("01-landing")
  })

  test("login page", async () => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" })
    await capture("02-login")
  })

  test("author portal", async () => {
    await loginAs(page, "author1@test.example.com")
    await page.goto(`${BASE_URL}/journal/${JOURNAL}/author`, { waitUntil: "networkidle2" })
    await capture("03-author-portal")
  })

  test("editorial queue", async () => {
    await loginAs(page, "ae@test.example.com")
    await page.goto(`${BASE_URL}/journal/${JOURNAL}/editorial/queue`, { waitUntil: "networkidle2" })
    await capture("04-editorial-queue")
  })

  test("manuscript detail page", async () => {
    await loginAs(page, "ae@test.example.com")

    // Navigate to queue and follow the first manuscript link
    await page.goto(`${BASE_URL}/journal/${JOURNAL}/editorial/queue`, { waitUntil: "networkidle2" })
    const link = await page.$("a[href*='/manuscripts/']")
    if (link) {
      const href = await link.evaluate((el) => (el as HTMLAnchorElement).href)
      await page.goto(href, { waitUntil: "networkidle2" })
      await capture("05-manuscript-detail")
    }
  })

  test("EIC dashboard", async () => {
    await loginAs(page, "eic@test.example.com")
    await page.goto(`${BASE_URL}/journal/${JOURNAL}/editorial/editor-in-chief`, { waitUntil: "networkidle2" })
    await capture("06-eic-dashboard")
  })

  test("editorial support dashboard", async () => {
    await loginAs(page, "support@test.example.com")
    await page.goto(`${BASE_URL}/journal/${JOURNAL}/editorial/editorial-support`, { waitUntil: "networkidle2" })
    await capture("07-editorial-support")
  })
})
