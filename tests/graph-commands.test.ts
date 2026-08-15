import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCoverage } from "../src/commands/coverage.js";
import { runGraph } from "../src/commands/graph.js";
import { BufferWriter } from "../src/commands/io.js";
import { runOrder } from "../src/commands/order.js";

describe("graph command", () => {
  it("emits JSON nodes and edges by default", async () => {
    const w = new BufferWriter();
    const code = await runGraph("spec", {}, w);
    expect(code).toBe(0);
    const parsed = JSON.parse(w.outText);
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(Array.isArray(parsed.edges)).toBe(true);
    expect(parsed.nodes.length).toBeGreaterThan(0);
    expect(parsed.edges.some((e: { relation: string }) => e.relation === "depends-on")).toBe(true);
    // Structural child edges are excluded by default.
    expect(parsed.edges.some((e: { relation: string }) => e.relation === "child")).toBe(false);
  });

  it("includes structural edges with --structure", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-graph-"));
    try {
      await writeFile(join(dir, "auth.system.md"), "---\ntype: System\ntitle: Auth\n---\n", "utf8");
      await mkdir(join(dir, "auth"), { recursive: true });
      await writeFile(
        join(dir, "auth", "login.component.md"),
        "---\ntype: Component\ntitle: Login\n---\n",
        "utf8",
      );
      const w = new BufferWriter();
      await runGraph(dir, { structure: true }, w);
      const parsed = JSON.parse(w.outText);
      expect(parsed.edges.some((e: { relation: string }) => e.relation === "child")).toBe(true);
      // Without --structure the same bundle has no edges.
      const w2 = new BufferWriter();
      await runGraph(dir, {}, w2);
      expect(JSON.parse(w2.outText).edges).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("renders a mermaid diagram", async () => {
    const w = new BufferWriter();
    const code = await runGraph("spec", { format: "mermaid" }, w);
    expect(code).toBe(0);
    expect(w.outText.startsWith("graph LR")).toBe(true);
    expect(w.outText).toContain("-->|");
  });

  it("renders a dot digraph", async () => {
    const w = new BufferWriter();
    const code = await runGraph("spec", { format: "dot" }, w);
    expect(code).toBe(0);
    expect(w.outText).toContain("digraph graphspec {");
    expect(w.outText.trimEnd().endsWith("}")).toBe(true);
  });

  it("selects a subgraph with --from and --depth", async () => {
    const w = new BufferWriter();
    const code = await runGraph(
      "spec",
      { from: "architecture/validator.component", depth: "1" },
      w,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(w.outText);
    const ids = parsed.nodes.map((n: { id: string }) => n.id);
    expect(ids).toContain("architecture/validator.component");
    expect(ids).toContain("architecture/graph-model.component");
    // parser is two hops away, beyond depth 1.
    expect(ids).not.toContain("architecture/parser.component");
  });

  it("accepts --from in relation-reference form, matching the bare concept id", async () => {
    const baseline = new BufferWriter();
    expect(
      await runGraph("spec", { from: "architecture/validator.component", depth: "1" }, baseline),
    ).toBe(0);

    // The leading-slash, `.md`-suffixed form is what the profile mandates for relation
    // targets in frontmatter, so it is the form a user has in hand when they go to traverse.
    for (const ref of [
      "/architecture/validator.component.md",
      "/architecture/validator.component",
      "architecture/validator.component.md",
    ]) {
      const w = new BufferWriter();
      expect(await runGraph("spec", { from: ref, depth: "1" }, w)).toBe(0);
      expect(w.outText).toBe(baseline.outText);
    }
  });

  it("reports the reference as typed when --from does not resolve", async () => {
    const w = new BufferWriter();
    const code = await runGraph("spec", { from: "/does/not/exist.md" }, w);
    expect(code).toBe(2);
    expect(w.errText).toContain("concept not found");
    expect(w.errText).toContain("/does/not/exist.md");
  });

  it("--direction out (default) misses a constrains edge pointing at --from", async () => {
    const w = new BufferWriter();
    const code = await runGraph(
      "spec",
      { from: "architecture/graphspec-cli.system", rel: "constrains", depth: "1" },
      w,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(w.outText);
    // constrains originates at the Constraint, not the System, so the default (out) direction
    // finds no edges even though `specification/zero-format-awareness.constraint` constrains it.
    expect(parsed.edges).toHaveLength(0);
  });

  it("--direction in finds the previously-missing constrains edge", async () => {
    const w = new BufferWriter();
    const code = await runGraph(
      "spec",
      {
        from: "architecture/graphspec-cli.system",
        rel: "constrains",
        depth: "1",
        direction: "in",
      },
      w,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(w.outText);
    expect(parsed.edges).toContainEqual({
      from: "specification/zero-format-awareness.constraint",
      to: "architecture/graphspec-cli.system",
      relation: "constrains",
    });
  });

  it("--direction in finds a covers edge pointing at --from", async () => {
    const w = new BufferWriter();
    const code = await runGraph(
      "spec",
      {
        from: "architecture/validator.component",
        rel: "covers",
        depth: "1",
        direction: "in",
      },
      w,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(w.outText);
    expect(parsed.edges).toContainEqual({
      from: "specification/validate-golden.test-scenario",
      to: "architecture/validator.component",
      relation: "covers",
    });
  });

  it("rejects an unknown --direction value", async () => {
    const w = new BufferWriter();
    const code = await runGraph(
      "spec",
      { from: "architecture/validator.component", direction: "sideways" },
      w,
    );
    expect(code).toBe(2);
    expect(w.errText).toContain("--direction must be one of out, in, both");
  });

  it("notes --direction is ignored without --from but still succeeds", async () => {
    const w = new BufferWriter();
    const code = await runGraph("spec", { direction: "in" }, w);
    expect(code).toBe(0);
    expect(w.errText).toContain("--direction is ignored without --from");
    expect(() => JSON.parse(w.outText)).not.toThrow();
  });

  it("errors clearly on an unresolved --from id", async () => {
    const w = new BufferWriter();
    const code = await runGraph("spec", { from: "does/not/exist" }, w);
    expect(code).toBe(2);
    expect(w.errText).toContain("concept not found");
  });

  it("rejects an unknown format", async () => {
    const w = new BufferWriter();
    const code = await runGraph("spec", { format: "svg" }, w);
    expect(code).toBe(2);
    expect(w.errText).toContain("unknown format");
  });

  it("rejects an unknown relation", async () => {
    const w = new BufferWriter();
    const code = await runGraph("spec", { rel: "bogus" }, w);
    expect(code).toBe(2);
    expect(w.errText).toContain("unknown relation");
  });
});

describe("coverage command", () => {
  it("prints a readable summary and exits 0 by default", async () => {
    const w = new BufferWriter();
    const code = await runCoverage("spec", {}, w);
    expect(code).toBe(0);
    expect(w.outText).toContain("Unsatisfied requirements");
    expect(w.outText).toContain("gap(s)");
  });

  it("emits JSON with all gap categories", async () => {
    const w = new BufferWriter();
    await runCoverage("spec", { json: true }, w);
    const parsed = JSON.parse(w.outText);
    expect(parsed).toHaveProperty("unsatisfiedRequirements");
    expect(parsed).toHaveProperty("unresolvedTargets");
    expect(typeof parsed.totalGaps).toBe("number");
  });

  // Anchored on a purpose-built gappy fixture rather than on `spec/`, so that closing a
  // real gap in the dogfood bundle cannot flip this test's meaning.
  it("exits non-zero under --strict when gaps exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-coverage-"));
    try {
      // A Requirement nothing satisfies and no TestScenario covers: two gaps by construction.
      await writeFile(
        join(dir, "login.requirement.md"),
        "---\ntype: Requirement\ntitle: Login\nstatus: accepted\n---\n",
        "utf8",
      );
      const w = new BufferWriter();
      const code = await runCoverage(dir, { strict: true }, w);
      expect(code).toBe(1);
      expect(w.errText).toContain("gap(s)");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("exits 0 under --strict when the bundle has no gaps", async () => {
    const w = new BufferWriter();
    const code = await runCoverage("spec", { strict: true }, w);
    expect(code).toBe(0);
  });
});

describe("order command", () => {
  it("prints the topological order against the spec bundle", async () => {
    const w = new BufferWriter();
    const code = await runOrder("spec", {}, w);
    expect(code).toBe(0);
    expect(w.outText).toContain("node(s).");
    const text = w.outText;
    expect(text.indexOf("architecture/parser.component")).toBeLessThan(
      text.indexOf("architecture/graph-model.component"),
    );
  });

  it("emits JSON with order and empty cycles", async () => {
    const w = new BufferWriter();
    await runOrder("spec", { json: true }, w);
    const parsed = JSON.parse(w.outText);
    expect(Array.isArray(parsed.order)).toBe(true);
    expect(parsed.cycles).toEqual([]);
  });

  describe("with a dependency cycle", () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), "graphspec-order-"));
      await writeFile(
        join(dir, "a.component.md"),
        "---\ntype: Component\nrelations:\n  depends-on:\n    - /b.component.md\n---\n",
        "utf8",
      );
      await writeFile(
        join(dir, "b.component.md"),
        "---\ntype: Component\nrelations:\n  depends-on:\n    - /a.component.md\n---\n",
        "utf8",
      );
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it("reports the cycle and exits non-zero", async () => {
      const w = new BufferWriter();
      const code = await runOrder(dir, {}, w);
      expect(code).toBe(1);
      expect(w.errText).toContain("dependency cycle");
    });

    it("exits non-zero in JSON mode too", async () => {
      const w = new BufferWriter();
      const code = await runOrder(dir, { json: true }, w);
      expect(code).toBe(1);
      const parsed = JSON.parse(w.outText);
      expect(parsed.cycles.length).toBeGreaterThan(0);
    });
  });

  it("returns exit 2 for a missing path", async () => {
    const w = new BufferWriter();
    const code = await runOrder("does/not/exist", {}, w);
    expect(code).toBe(2);
    expect(w.errText).toContain("error:");
  });
});
