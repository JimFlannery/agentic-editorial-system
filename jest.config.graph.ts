import type { Config } from "jest"

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/lib/graph/__tests__/**/*.test.ts"],
  setupFiles: ["<rootDir>/lib/graph/__tests__/setup.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "commonjs" } }],
  },
}

export default config
