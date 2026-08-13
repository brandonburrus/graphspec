import { describe, expect, it } from "vitest";
import { Graph } from "../src/core/graph.js";
import { parseConcept } from "../src/core/parser.js";
import { UnknownConceptError, reachableIds, selectSubgraph } from "../src/core/traverse.js";
import type { Bundle, Concept } from "../src/core/types.js";

function concept(relPath: string, raw: string): Concept {
  return parseConcept(raw, `/abs/${relPath}`, relPath);
}

function graphOf(concepts: Concept[]): Graph {
  const bundle: Bundle = { root: "/abs", concepts, reserved: [] };
  return Graph.fromBundle(bundle);
}

/** A small connected graph: feature -> requirement, component -> requirement, plus a term. */
function sampleGraph(): Graph {
  return graphOf([
    concept(
      "f.feature.md",
      "---\ntype: Feature\ntitle: F\nrelations:\n  includes:\n    - /r.requirement.md\n---",
    ),
    concept(
      "c.component.md",
      "---\ntype: Component\ntitle: C\nrelations:\n  satisfies:\n    - /r.requirement.md\n  refers-to:\n    - /t.term.md\n---",
    ),
    concept("r.requirement.md", "---\ntype: Requirement\ntitle: R\nstatus: accepted\n---"),
    concept("t.term.md", "---\ntype: Term\ntitle: T\n---"),
  ]);
}

describe("selectSubgraph", () => {
  it("returns the whole resolved graph when no root is given", () => {
    const view = selectSubgraph(sampleGraph());
    expect(view.nodes.map((n) => n.id)).toEqual([
      "c.component",
      "f.feature",
      "r.requirement",
      "t.term",
    ]);
    // Only edges between existing nodes; all three relation edges resolve here.
    expect(view.edges).toHaveLength(3);
  });

  it("excludes structural child edges unless requested", () => {
    const g = graphOf([
      concept("auth.system.md", "---\ntype: System\ntitle: Auth\n---"),
      concept("auth/login.component.md", "---\ntype: Component\ntitle: Login\n---"),
    ]);
    expect(selectSubgraph(g).edges).toHaveLength(0);
    const withStructure = selectSubgraph(g, { structure: true });
    expect(withStructure.edges.map((e) => e.kind)).toEqual(["child"]);
  });

  it("restricts to the requested relation names", () => {
    const view = selectSubgraph(sampleGraph(), { relations: ["satisfies"] });
    expect(view.edges).toHaveLength(1);
    expect(view.edges[0].kind).toBe("satisfies");
  });

  it("selects the subgraph reachable from a root", () => {
    const view = selectSubgraph(sampleGraph(), { from: "c.component" });
    // c -> r (satisfies), c -> t (refers-to); feature is not reachable from the component.
    expect(view.nodes.map((n) => n.id)).toEqual(["c.component", "r.requirement", "t.term"]);
    expect(view.nodes.some((n) => n.id === "f.feature")).toBe(false);
  });

  it("limits traversal depth", () => {
    const g = graphOf([
      concept(
        "a.component.md",
        "---\ntype: Component\nrelations:\n  depends-on:\n    - /b.component.md\n---",
      ),
      concept(
        "b.component.md",
        "---\ntype: Component\nrelations:\n  depends-on:\n    - /c.component.md\n---",
      ),
      concept("c.component.md", "---\ntype: Component\n---"),
    ]);
    expect(selectSubgraph(g, { from: "a.component", depth: 1 }).nodes.map((n) => n.id)).toEqual([
      "a.component",
      "b.component",
    ]);
    expect(selectSubgraph(g, { from: "a.component", depth: 0 }).nodes.map((n) => n.id)).toEqual([
      "a.component",
    ]);
    expect(selectSubgraph(g, { from: "a.component" }).nodes).toHaveLength(3);
  });

  it("throws UnknownConceptError for an unresolved root", () => {
    expect(() => selectSubgraph(sampleGraph(), { from: "missing" })).toThrow(UnknownConceptError);
  });
});

describe("reachableIds", () => {
  it("does not follow unresolved edges", () => {
    const g = graphOf([
      concept(
        "a.component.md",
        "---\ntype: Component\nrelations:\n  depends-on:\n    - /gone.component.md\n---",
      ),
    ]);
    const ids = reachableIds(g, "a.component", () => true);
    expect([...ids]).toEqual(["a.component"]);
  });
});
