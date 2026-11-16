import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/production",
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chromium",
    headless: true,
    acceptDownloads: true,
  },
  webServer: {
    command: "node scripts/serve-export.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
