import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type Page, expect, test } from "@playwright/test";

/**
 * The primary user journey through a generated visualization: land, search, select, read,
 * follow a relation, focus a neighborhood, and come back via a deep link.
 *
 * Runs against the real CLI output for this repo's own `spec/` bundle over `file://`, which
 * is exactly how someone uses the file: double-clicked, offline, no server.
 */

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
let outputDir: string;
let pageUrl: string;
/**
 * Taken from the CLI's own report rather than hardcoded: `spec/` is a live bundle, and per
 * its AGENTS.md a test must pin behavior, not the bundle's incidental size.
 */
let conceptCount: number;

test.beforeAll(() => {
  outputDir = mkdtempSync(join(tmpdir(), "graphspec-e2e-"));
  const outFile = join(outputDir, "graph.html");
  const report = execFileSync("node", ["dist/cli.js", "visualize", "spec", "--out", outFile], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const match = /(\d+) concept\(s\)/.exec(report);
  if (!match) {
    throw new Error(`could not read the concept count from: ${report}`);
  }
  conceptCount = Number(match[1]);
  pageUrl = pathToFileURL(outFile).href;
});

test.afterAll(() => {
  rmSync(outputDir, { recursive: true, force: true });
});

/** Wait for the force layout to settle enough that node hit-testing is stable. */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(1200);
}

test("lands with the whole graph, the concept list, and the legend", async ({ page }) => {
  await page.goto(pageUrl);

  await expect(page.locator("canvas.gs-canvas")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "spec" })).toBeVisible();
  await expect(page.getByRole("status").first()).toHaveText(`${conceptCount} concepts`);

  // The list is the accessible equivalent of the canvas, so every concept must be in it.
  const rows = page.locator(".gs-result");
  await expect(rows).toHaveCount(conceptCount);

  await expect(page.getByText("Select a concept to inspect it.")).toBeVisible();
  await expect(page.locator(".gs-legend li")).toHaveCount(6);
});

test("search narrows the list and the keyboard shortcut focuses it", async ({ page }) => {
  await page.goto(pageUrl);

  await page.keyboard.press("/");
  await expect(page.locator(".gs-search")).toBeFocused();

  await page.locator(".gs-search").fill("validator");
  await expect(page.getByRole("status").first()).toContainText(`of ${conceptCount} match`);
  const rows = page.locator(".gs-result");
  await expect(rows.first()).toContainText("Validator");
  expect(await rows.count()).toBeLessThan(conceptCount);

  // Escape is the universal way out: it clears the query and the selection together.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status").first()).toHaveText(`${conceptCount} concepts`);
});

test("selecting a concept shows its frontmatter, body, problems and both relation directions", async ({
  page,
}) => {
  await page.goto(pageUrl);
  await page.locator(".gs-result", { hasText: "Validator" }).click();

  const inspector = page.locator(".gs-inspector");
  await expect(inspector.getByRole("heading", { level: 2 })).toHaveText("Validator");
  await expect(inspector.locator(".gs-inspect-path")).toHaveText(
    "architecture/validator.component.md",
  );

  // Frontmatter is rendered key by key, including the ones the profile does not define.
  await expect(inspector.locator(".gs-fm th", { hasText: "type" })).toBeVisible();
  await expect(inspector.locator(".gs-fm td").first()).toHaveText("Component");

  await expect(inspector.getByRole("heading", { name: "Outgoing" })).toBeVisible();
  await expect(inspector.getByRole("heading", { name: "Incoming" })).toBeVisible();
  await expect(inspector.locator(".gs-rel-name", { hasText: "satisfies" })).toBeVisible();

  // The body is rendered markdown, not a raw dump.
  await expect(inspector.locator(".gs-md h3", { hasText: "Responsibility" })).toBeVisible();

  // This bundle is the dogfood fixture and is meant to be clean.
  await expect(inspector.locator(".gs-problem")).toHaveCount(0);
});

test("a relation link navigates to the target concept and updates the deep link", async ({
  page,
}) => {
  await page.goto(pageUrl);
  await page.locator(".gs-result", { hasText: "Validator" }).click();

  await page
    .locator(".gs-rel-group", { hasText: "depends-on" })
    .getByRole("button", { name: "Graph Model" })
    .click();

  await expect(page.locator(".gs-inspector").getByRole("heading", { level: 2 })).toHaveText(
    "Graph Model",
  );
  expect(page.url()).toContain("#/architecture/graph-model.component");
});

test("a deep link selects its concept on load", async ({ page }) => {
  await page.goto(`${pageUrl}#/glossary/profile.term`);
  await settle(page);

  await expect(page.locator(".gs-inspector").getByRole("heading", { level: 2 })).toHaveText(
    "Profile",
  );
  await expect(page.locator(".gs-result-on")).toContainText("Profile");
});

test("focus mode narrows to a neighborhood and clears again", async ({ page }) => {
  await page.goto(pageUrl);
  await page.locator(".gs-result", { hasText: "Validator" }).click();
  await page.getByRole("button", { name: "Focus neighborhood" }).click();

  await expect(page.locator(".gs-focus-label")).toContainText("Validator");
  await expect(page.getByRole("button", { name: "1 hop", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "3 hops" }).click();
  await expect(page.getByRole("button", { name: "3 hops" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Clear focus" }).click();
  await expect(page.locator(".gs-focus-label")).toHaveCount(0);
});

test("clicking a node on the canvas selects it", async ({ page }) => {
  await page.goto(pageUrl);
  await settle(page);

  // Center on a known concept first so its node is under a predictable point: the canvas
  // centers the selection, so the middle of the canvas is then that node.
  await page.locator(".gs-result", { hasText: "CLI Contract" }).click();
  await settle(page);

  const box = await page.locator("canvas.gs-canvas").boundingBox();
  if (!box) {
    throw new Error("canvas has no layout box");
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator(".gs-inspector").getByRole("heading", { level: 2 })).toHaveText(
    "CLI Contract",
  );
});

test("the page is self-contained: it makes no network requests", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("file://")) {
      external.push(request.url());
    }
  });

  await page.goto(pageUrl);
  await settle(page);

  expect(external).toEqual([]);
});
