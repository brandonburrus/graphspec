import { describe, expect, it } from "vitest";
import { loadBundle } from "../src/core/bundle.js";
import { CHILD_EDGE, Graph } from "../src/core/graph.js";
import { parseConcept } from "../src/core/parser.js";
import type { Bundle, Concept } from "../src/core/types.js";

/** Build a Concept from a bundle-relative path and raw markdown. */
function concept(relPath: string, raw: string): Concept {
  return parseConcept(raw, `/abs/${relPath}`, relPath);
}

/** Assemble an in-memory bundle from concepts. */
function bundleOf(concepts: Concept[]): Bundle {
  return { root: "/abs", concepts, reserved: [] };
}

describe("Graph", () => {
  it("indexes concepts as nodes keyed by id", () => {
    const g = Graph.fromBundle(
      bundleOf([
        concept("a.feature.md", "---\ntype: Feature\n---"),
        concept("b.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
      ]),
    );
    expect(g.size).toBe(2);
    expect(g.has("a.feature")).toBe(true);
    expect(g.get("b.requirement")?.type).toBe("Requirement");
  });

  it("materializes typed edges from relations and marks resolution", () => {
    const g = Graph.fromBundle(
      bundleOf([
        concept(
          "f.feature.md",
          "---\ntype: Feature\nrelations:\n  includes:\n    - /r.requirement.md\n    - /missing.requirement.md\n---",
        ),
        concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
      ]),
    );
    const includes = g.edgesFrom("f.feature", "includes");
    expect(includes).toHaveLength(2);
    const resolved = includes.find((e) => e.to === "r.requirement");
    const broken = includes.find((e) => e.to === "missing.requirement");
    expect(resolved?.resolved).toBe(true);
    expect(broken?.resolved).toBe(false);
    // Neighbors only include resolved targets.
    expect(g.neighbors("f.feature", "includes").map((c) => c.id)).toEqual(["r.requirement"]);
  });

  it("adds implicit parent/child edges from the directory hierarchy", () => {
    const g = Graph.fromBundle(
      bundleOf([
        concept("auth.system.md", "---\ntype: System\n---"),
        concept("auth/login.component.md", "---\ntype: Component\n---"),
      ]),
    );
    const children = g.edgesFrom("auth.system", CHILD_EDGE);
    expect(children).toHaveLength(1);
    expect(children[0].to).toBe("auth/login.component");
    expect(g.edgesTo("auth/login.component", CHILD_EDGE)).toHaveLength(1);
  });

  it("records incoming edges for reverse traversal", () => {
    const g = Graph.fromBundle(
      bundleOf([
        concept(
          "c.component.md",
          "---\ntype: Component\nrelations:\n  satisfies:\n    - /r.requirement.md\n---",
        ),
        concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
      ]),
    );
    const incoming = g.edgesTo("r.requirement", "satisfies");
    expect(incoming).toHaveLength(1);
    expect(incoming[0].from).toBe("c.component");
  });
});

describe("loadBundle", () => {
  it("loads the dogfood spec bundle and separates reserved files", async () => {
    const bundle = await loadBundle("spec");
    expect(bundle.concepts.length).toBeGreaterThanOrEqual(20);
    expect(bundle.reserved.some((r) => r.kind === "index" && r.dir === "")).toBe(true);
    // No reserved file is ever treated as a concept.
    expect(bundle.concepts.some((c) => c.relPath.endsWith("index.md"))).toBe(false);
  });
});
