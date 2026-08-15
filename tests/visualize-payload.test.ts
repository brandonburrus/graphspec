import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadBundle } from "../src/core/bundle.js";
import { analyzeCoverage } from "../src/core/coverage.js";
import { Graph } from "../src/core/graph.js";
import type { Bundle } from "../src/core/types.js";
import { validateBundle } from "../src/validate/index.js";
import {
  PAYLOAD_VERSION,
  type PayloadGhostNode,
  type PayloadNode,
  buildPayload,
} from "../src/visualize/payload.js";

/** Build a payload the same way the command does, so tests exercise the real fold. */
function payloadFor(bundle: Bundle) {
  const graph = Graph.fromBundle(bundle);
  return buildPayload({
    bundle,
    graph,
    diagnostics: validateBundle(bundle).diagnostics,
    coverage: analyzeCoverage(graph),
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
}

const concepts = (p: ReturnType<typeof payloadFor>) =>
  p.nodes.filter((n): n is PayloadNode => !n.ghost);
const ghosts = (p: ReturnType<typeof payloadFor>) =>
  p.nodes.filter((n): n is PayloadGhostNode => n.ghost);

describe("buildPayload", () => {
  it("captures the whole spec bundle: nodes, edges, profile, and analyses", async () => {
    const payload = payloadFor(await loadBundle("spec"));

    expect(payload.version).toBe(PAYLOAD_VERSION);
    expect(payload.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(payload.bundle.name).toBe("spec");
    expect(payload.bundle.conceptCount).toBeGreaterThan(0);
    expect(concepts(payload).length).toBe(payload.bundle.conceptCount);

    // The profile travels with the payload so the viewer holds no vocabulary of its own.
    expect(payload.profile.nodeTypes.length).toBe(13);
    expect(payload.profile.relations.length).toBe(16);
    expect(payload.profile.layers).toEqual([
      "product",
      "architecture",
      "specification",
      "glossary",
    ]);

    expect(payload.edges.some((e) => e.relation === "depends-on")).toBe(true);
    expect(payload.coverage.totalGaps).toBe(0);
  });

  it("carries unknown frontmatter keys through to the inspector", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-payload-"));
    try {
      await writeFile(
        join(dir, "thing.component.md"),
        "---\ntype: Component\ntitle: Thing\nowner: platform-team\njira: PLAT-42\n---\n# Responsibility\nDoes a thing.\n",
        "utf8",
      );
      const payload = payloadFor(await loadBundle(dir));
      const node = concepts(payload)[0];

      expect(node.frontmatter.owner).toBe("platform-team");
      expect(node.frontmatter.jira).toBe("PLAT-42");
      expect(node.sections).toEqual([{ heading: "Responsibility", content: "Does a thing." }]);
      expect(node.unknownType).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("renders an unresolved relation target as a deduped ghost node", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-payload-"));
    try {
      await writeFile(
        join(dir, "a.component.md"),
        "---\ntype: Component\ntitle: A\nrelations:\n  satisfies:\n    - /missing.requirement.md\n---\n",
        "utf8",
      );
      await writeFile(
        join(dir, "b.component.md"),
        "---\ntype: Component\ntitle: B\nrelations:\n  satisfies:\n    - /missing.requirement.md\n---\n",
        "utf8",
      );
      const payload = payloadFor(await loadBundle(dir));

      const ghostList = ghosts(payload);
      expect(ghostList).toHaveLength(1);
      expect(ghostList[0].id).toBe("missing.requirement");
      expect([...ghostList[0].referencedBy].sort()).toEqual(["a.component", "b.component"]);
      expect(payload.edges.filter((e) => !e.resolved)).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("flags an unknown type rather than dropping the concept", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-payload-"));
    try {
      await writeFile(join(dir, "odd.widget.md"), "---\ntype: Widget\ntitle: Odd\n---\n", "utf8");
      const payload = payloadFor(await loadBundle(dir));
      const node = concepts(payload)[0];

      expect(node.type).toBe("Widget");
      expect(node.unknownType).toBe(true);
      expect(payload.diagnostics.some((d) => d.severity === "warning")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("survives a concept whose frontmatter fails to parse", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-payload-"));
    try {
      await writeFile(join(dir, "bad.component.md"), "---\ntype: [unclosed\n---\nbody\n", "utf8");
      const payload = payloadFor(await loadBundle(dir));
      const node = concepts(payload)[0];

      expect(node.frontmatterError).not.toBeNull();
      expect(payload.diagnostics.some((d) => d.severity === "error")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("handles an empty bundle without throwing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-payload-"));
    try {
      const payload = payloadFor(await loadBundle(dir));
      expect(payload.nodes).toEqual([]);
      expect(payload.edges).toEqual([]);
      expect(payload.coverage.totalGaps).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports skipped non-concept markdown so it is visible in the UI", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-payload-"));
    try {
      await mkdir(join(dir, "sub"), { recursive: true });
      await writeFile(join(dir, "AGENTS.md"), "# agent notes\n", "utf8");
      await writeFile(join(dir, "sub", "x.term.md"), "---\ntype: Term\n---\n", "utf8");
      const payload = payloadFor(await loadBundle(dir));

      expect(payload.bundle.ignored).toContain("AGENTS.md");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("payload node degree", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "graphspec-degree-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("counts relation edges in both directions and ignores structural ones", async () => {
    await writeFile(
      join(dir, "sys.system.md"),
      "---\ntype: System\ntitle: Sys\nrelations:\n  contains:\n    - /sys/comp.component.md\n---\n",
      "utf8",
    );
    await mkdir(join(dir, "sys"), { recursive: true });
    await writeFile(
      join(dir, "sys", "comp.component.md"),
      "---\ntype: Component\ntitle: Comp\n---\n",
      "utf8",
    );

    const payload = payloadFor(await loadBundle(dir));
    const byId = new Map(concepts(payload).map((n) => [n.id, n]));

    // One `contains` relation each way; the implicit child edge must not inflate either.
    expect(byId.get("sys.system")?.degree).toBe(1);
    expect(byId.get("sys/comp.component")?.degree).toBe(1);

    // Structural edges are always carried and flagged, because the UI can toggle them
    // where the CLI's text output had to choose via --structure.
    const structural = payload.edges.filter((e) => e.structural);
    expect(structural).toHaveLength(1);
    expect(structural[0]).toMatchObject({ from: "sys.system", to: "sys/comp.component" });
  });
});
