import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BufferWriter } from "../src/commands/io.js";
import { runVisualizeServe } from "../src/commands/visualize-serve.js";
import { runVisualize } from "../src/commands/visualize.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const viewerBundle = join(repoRoot, "dist/viewer/viewer.js");

/**
 * The command reads the esbuild-produced viewer off disk, and `pnpm test` does not run
 * `pnpm build`. Build just the viewer if it is missing so the suite works on a clean
 * checkout; esbuild takes milliseconds, and the alternative is a test that only passes
 * when someone happened to build first.
 */
beforeAll(() => {
  if (!existsSync(viewerBundle)) {
    execFileSync(
      join(repoRoot, "node_modules/.bin/esbuild"),
      [
        "src/viewer/main.ts",
        "--bundle",
        "--minify",
        "--format=iife",
        "--target=es2022",
        "--outdir=dist/viewer",
        "--entry-names=viewer",
      ],
      { cwd: repoRoot },
    );
  }
}, 60_000);

describe("visualize command", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "graphspec-visualize-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes one self-contained file and reports what it contains", async () => {
    const out = join(dir, "graph.html");
    const w = new BufferWriter();

    const code = await runVisualize("spec", { out }, w);

    expect(code).toBe(0);
    // Counts are read out of the report rather than pinned: spec/ is a live bundle, and a
    // test that hardcodes its size breaks every time a concept is legitimately added.
    expect(w.outText).toMatch(/wrote .+ \(\d+ concept\(s\), \d+ relation\(s\), [\d.]+ .?B\)/);

    const html = await readFile(out, "utf8");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('id="graphspec-payload"');
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
  });

  it("renders a bundle that has validation errors instead of refusing to", async () => {
    // The permissive-OKF stance applied to this surface: a broken graph is the one you most
    // need to look at, so problems travel into the page rather than failing the command.
    await writeFile(join(dir, "broken.component.md"), "---\ntype: [unclosed\n---\n", "utf8");
    const out = join(dir, "out.html");
    const w = new BufferWriter();

    const code = await runVisualize(dir, { out }, w);

    expect(code).toBe(0);
    const html = await readFile(out, "utf8");
    expect(html).toContain("okf/");
  });

  it("uses --title as the page title over the directory name", async () => {
    const out = join(dir, "graph.html");
    await runVisualize("spec", { out, title: "My Specs" }, new BufferWriter());

    expect(await readFile(out, "utf8")).toContain("<title>My Specs (graphspec)</title>");
  });

  it("returns exit 2 for a bundle that cannot be read", async () => {
    const w = new BufferWriter();
    const code = await runVisualize("does/not/exist", { out: join(dir, "x.html") }, w);

    expect(code).toBe(2);
    expect(w.errText).toContain("error:");
  });

  it("returns exit 2 when the output path cannot be written", async () => {
    const w = new BufferWriter();
    const code = await runVisualize("spec", { out: join(dir, "missing-dir", "x.html") }, w);

    expect(code).toBe(2);
    expect(w.errText).toContain("could not write");
  });
});

describe("visualize serve subcommand", () => {
  it("serves the page, the payload, and a 404, then shuts down cleanly", async () => {
    const w = new BufferWriter();

    const code = await runVisualizeServe(
      "spec",
      {
        port: "0",
        open: false,
        onReady: async ({ port, close }) => {
          const page = await fetch(`http://localhost:${port}/`);
          expect(page.status).toBe(200);
          expect(page.headers.get("content-type")).toContain("text/html");
          // Served pages ask the server for updates; written files never do.
          expect(await page.text()).toContain('{"serve":true}');

          const payload = await fetch(`http://localhost:${port}/payload.json`);
          expect(payload.status).toBe(200);
          expect((await payload.json()).nodes.length).toBeGreaterThan(0);

          expect((await fetch(`http://localhost:${port}/nope`)).status).toBe(404);
          await close();
        },
      },
      w,
    );

    expect(code).toBe(0);
    expect(w.outText).toContain("serving spec at http://localhost:");
  }, 20_000);

  it("pushes a reload event when a concept file changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-serve-"));
    await writeFile(join(dir, "a.component.md"), "---\ntype: Component\ntitle: A\n---\n", "utf8");
    const w = new BufferWriter();

    try {
      await runVisualizeServe(
        dir,
        {
          port: "0",
          open: false,
          onReady: async ({ port, close }) => {
            const response = await fetch(`http://localhost:${port}/events`);
            const reader = response.body?.getReader();
            expect(reader).toBeDefined();

            await writeFile(
              join(dir, "b.component.md"),
              "---\ntype: Component\ntitle: B\n---\n",
              "utf8",
            );

            // Read until the reload event arrives; the first chunk is the open comment.
            let seen = "";
            while (!seen.includes("event: reload")) {
              const chunk = await reader?.read();
              if (chunk?.done !== false) {
                break;
              }
              seen += new TextDecoder().decode(chunk.value);
            }
            expect(seen).toContain("event: reload");

            await reader?.cancel();
            await close();
          },
        },
        w,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("rejects a nonsense port before binding anything", async () => {
    const w = new BufferWriter();
    const code = await runVisualizeServe("spec", { port: "not-a-port", open: false }, w);

    expect(code).toBe(2);
    expect(w.errText).toContain("--port must be an integer");
  });

  it("returns exit 2 for a bundle that cannot be read", async () => {
    const w = new BufferWriter();
    const code = await runVisualizeServe("does/not/exist", { port: "0", open: false }, w);

    expect(code).toBe(2);
    expect(w.errText).toContain("error:");
  });
});
