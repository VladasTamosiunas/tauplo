import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Vitest does not read .env into process.env, so load it here and point
// DATABASE_URL at the dedicated test database for every test worker.
const fileEnv = loadEnv("test", __dirname, "");
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL ?? "postgresql://tauplo@localhost:54329/tauplo_test";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { DATABASE_URL: testDatabaseUrl },
    // Integration tests share one Postgres database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
