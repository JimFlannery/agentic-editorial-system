import puppeteer, { Browser, Page } from "puppeteer"

export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000"

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
}

/**
 * Log in as a test user and return the authenticated page.
 * All TEST journal users share the password "password".
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('input[type="email"], input[name="email"]')

  await page.type('input[type="email"], input[name="email"]', email)
  await page.type('input[type="password"], input[name="password"]', "password")

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('button[type="submit"]'),
  ])
}

/**
 * Navigate to a URL and assert the response status is not 4xx/5xx.
 * Returns the page title.
 */
export async function assertPageOk(page: Page, url: string): Promise<string> {
  const response = await page.goto(url, { waitUntil: "networkidle2" })
  const status = response?.status() ?? 0
  if (status >= 400) {
    throw new Error(`${url} returned HTTP ${status}`)
  }
  return page.title()
}
