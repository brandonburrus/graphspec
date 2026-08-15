import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end config for the `visualize` viewer.
 *
 * These specs exist because nothing in the vitest suite can prove the generated page actually
 * works: those tests assert the HTML is well-formed, not that a graph renders, a click
 * selects, or a hot reload keeps its place. Only a real browser shows that.
 *
 * Chromium only. The output is one static file with no vendor-specific APIs, so a second
 * engine would multiply CI time without covering new risk.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
