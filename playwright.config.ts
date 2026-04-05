import { defineConfig, devices } from "@playwright/test"

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,   // tests share DB state — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Auth setup runs first; its saved state is reused by the role projects
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "author",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/author.json",
      },
      dependencies: ["setup"],
      testMatch: /.*author\.spec\.ts/,
    },
    {
      name: "assistant-editor",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/ae.json",
      },
      dependencies: ["setup"],
      testMatch: /.*queue\.spec\.ts|.*manuscript-detail\.spec\.ts/,
    },
    {
      name: "editor-in-chief",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/eic.json",
      },
      dependencies: ["setup"],
      testMatch: /.*eic\.spec\.ts/,
    },
    {
      name: "reviewer",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/reviewer.json",
      },
      dependencies: ["setup"],
      testMatch: /.*reviewer\.spec\.ts/,
    },
  ],
  webServer: process.env.CI
    ? {
        command: "npm run start",
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
})
