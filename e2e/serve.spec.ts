import { type ChildProcess, spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * The `visualize serve` journey: open the live view, edit a spec file, and watch the graph
 * update without losing your place.
 *
 * Runs against a throwaway copy of this repo's `spec/` bundle, because the test edits files.
 */

// Serial: these tests edit one shared bundle copy, and the concept-count assertions only
// hold in declaration order.
test.describe.configure({ mode: "serial" });

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
let bundleDir: string;
let server: ChildProcess;
let baseUrl: string;
/** Read from the running page rather than hardcoded; `spec/` grows over time. */
let conceptCount: number;

/** Start the server and resolve the URL it prints, so an auto-picked port still works. */
function startServer(dir: string): Promise<{ child: ChildProcess; url: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["dist/cli.js", "visualize", "serve", dir, "--no-open"], {
      cwd: repoRoot,
    });
    const timer = setTimeout(() => reject(new Error("server did not start in time")), 20000);
    child.stdout?.on("data", (chunk: Buffer) => {
      const match = /at (http:\/\/localhost:\d+\/)/.exec(chunk.toString());
      if (match) {
        clearTimeout(timer);
        resolve({ child, url: match[1] });
      }
    });
    child.on("error", reject);
  });
}

test.beforeAll(async () => {
  bundleDir = mkdtempSync(join(tmpdir(), "graphspec-serve-"));
  cpSync(join(repoRoot, "spec"), bundleDir, { recursive: true });
  const started = await startServer(bundleDir);
  server = started.child;
  baseUrl = started.url;
});

test.afterAll(() => {
  server?.kill("SIGINT");
  rmSync(bundleDir, { recursive: true, force: true });
});

test("serves the live view and reloads an edit without losing the user's place", async ({
  page,
}) => {
  await page.goto(baseUrl);
  await expect(page.locator("canvas.gs-canvas")).toBeVisible();
  conceptCount = Number(
    /^(\d+)/.exec((await page.getByRole("status").first().textContent()) ?? "")?.[1],
  );
  expect(conceptCount).toBeGreaterThan(0);

  // Set up a state worth preserving: a selection, a search, and a collapsed default view.
  await page.locator(".gs-result", { hasText: "Validator" }).click();
  await expect(page.locator(".gs-inspector").getByRole("heading", { level: 2 })).toHaveText(
    "Validator",
  );

  // Edit the bundle the way an author would: rename a concept.
  const file = join(bundleDir, "architecture", "parser.component.md");
  const before = readFileSync(file, "utf8");
  writeFileSync(file, before.replace("title: OKF Parser", "title: OKF Parser Renamed"), "utf8");

  // The rename arrives over SSE and lands in the list without a page reload.
  await expect(page.locator(".gs-result", { hasText: "OKF Parser Renamed" })).toBeVisible({
    timeout: 15000,
  });

  // The point of hot reload: the page did not navigate, so the selection is still there.
  await expect(page.locator(".gs-inspector").getByRole("heading", { level: 2 })).toHaveText(
    "Validator",
  );
  await expect(page.locator(".gs-result-on")).toContainText("Validator");
});

test("a new concept appears in the graph on the next save", async ({ page }) => {
  await page.goto(baseUrl);
  await expect(page.getByRole("status").first()).toHaveText(`${conceptCount} concepts`);

  writeFileSync(
    join(bundleDir, "specification", "hot-reload.requirement.md"),
    "---\ntype: Requirement\ntitle: Hot Reload\nstatus: proposed\n---\n# Acceptance Criteria\nEdits appear without a page reload.\n",
    "utf8",
  );

  await expect(page.getByRole("status").first()).toHaveText(`${conceptCount + 1} concepts`, {
    timeout: 15000,
  });
  await expect(page.locator(".gs-result", { hasText: "Hot Reload" })).toBeVisible();
});

test("serves the payload as JSON for the viewer to re-fetch", async ({ request }) => {
  const response = await request.get(`${baseUrl}payload.json`);

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  const payload = await response.json();
  expect(payload.version).toBe(1);
  expect(payload.nodes.length).toBeGreaterThan(0);
});

test("returns 404 for an unknown path rather than the page", async ({ request }) => {
  const response = await request.get(`${baseUrl}nope`);
  expect(response.status()).toBe(404);
});
