import type { Config } from "jest"

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/puppeteer/**/*.test.ts"],
  testTimeout: 60_000,   // puppeteer page loads can be slow
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "commonjs" } }],
  },
}

export default config
