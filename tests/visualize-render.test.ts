import { describe, expect, it } from "vitest";
import { loadBundle } from "../src/core/bundle.js";
import { analyzeCoverage } from "../src/core/coverage.js";
import { Graph } from "../src/core/graph.js";
import { validateBundle } from "../src/validate/index.js";
import { type VisualizePayload, buildPayload } from "../src/visualize/payload.js";
import { PAYLOAD_ELEMENT_ID, type ViewerAssets, renderHtml } from "../src/visualize/render.js";

/**
 * Stub assets, so the renderer is exercised without a build having run. `pnpm test` does
 * not run `pnpm build`, and coupling the two would make the suite fail on a clean checkout.
 */
const ASSETS: ViewerAssets = { js: "/* viewer */", css: "/* styles */" };

async function specPayload(): Promise<VisualizePayload> {
  const bundle = await loadBundle("spec");
  const graph = Graph.fromBundle(bundle);
  return buildPayload({
    bundle,
    graph,
    diagnostics: validateBundle(bundle).diagnostics,
    coverage: analyzeCoverage(graph),
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
}

/** Pull the embedded payload back out of a rendered document, the way the viewer does. */
function extractPayload(html: string): VisualizePayload {
  const open = `<script type="application/json" id="${PAYLOAD_ELEMENT_ID}">`;
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf("</script>", start);
  return JSON.parse(html.slice(start, end));
}

describe("renderHtml", () => {
  it("produces one document with the payload and both assets inlined", async () => {
    const html = renderHtml(await specPayload(), ASSETS);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>/* styles */</style>");
    expect(html).toContain("<script>/* viewer */</script>");
    expect(html).toContain("<title>spec (graphspec)</title>");

    const parsed = extractPayload(html);
    expect(parsed.bundle.name).toBe("spec");
    expect(parsed.nodes.length).toBeGreaterThan(0);
  });

  it("stays self-contained: no external resource of any kind", async () => {
    const html = renderHtml(await specPayload(), ASSETS);

    // The invariant that makes the file portable. Asserted rather than left to review.
    expect(html).not.toMatch(/<script[^>]+\ssrc=/i);
    expect(html).not.toMatch(/<link[^>]+\srel=["']?stylesheet/i);
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
    expect(html).not.toMatch(/@import\s+url/i);
  });

  it("cannot be broken out of by a closing script tag inside a concept body", async () => {
    const payload = await specPayload();
    const hostile = {
      ...payload,
      nodes: [
        {
          ...(payload.nodes[0] as unknown as Record<string, unknown>),
          body: "</script><script>globalThis.pwned = true;</script>",
          title: "</title></head><body>",
        },
      ],
    } as unknown as VisualizePayload;

    const html = renderHtml(hostile, ASSETS);

    // Exactly three script elements: config, payload, viewer. No injected fourth, and no
    // stray closing tag, so the hostile body cannot end the block it is embedded in.
    expect(html.match(/<script/g)).toHaveLength(3);
    expect(html.match(/<\/script>/g)).toHaveLength(3);
    expect(html).toContain("\\u003c/script>");
    // ...and the escaped form still round-trips through JSON.parse untouched.
    const roundTripped = extractPayload(html);
    expect((roundTripped.nodes[0] as { body: string }).body).toBe(
      "</script><script>globalThis.pwned = true;</script>",
    );
  });

  it("escapes markup in the document title", () => {
    const payload = {
      version: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      bundle: { name: '"><img>', root: "/tmp", conceptCount: 0, ignored: [] },
      profile: { nodeTypes: [], relations: [], layers: [] },
      nodes: [],
      edges: [],
      diagnostics: [],
      coverage: {
        unsatisfiedRequirements: [],
        untestedRequirements: [],
        untestedJourneys: [],
        emptyFeatures: [],
        unrealizedFeatures: [],
        danglingConstraints: [],
        orphanConcepts: [],
        unresolvedTargets: [],
        totalGaps: 0,
      },
    } as VisualizePayload;

    const html = renderHtml(payload, ASSETS);
    expect(html).toContain("<title>&quot;&gt;&lt;img&gt; (graphspec)</title>");
    expect(html).not.toContain("<img>");
  });

  it("flags serve mode in the config block so the viewer subscribes to reloads", async () => {
    const payload = await specPayload();

    expect(renderHtml(payload, ASSETS, { serve: true })).toContain('{"serve":true}');
    expect(renderHtml(payload, ASSETS)).toContain('{"serve":false}');
  });
});
