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

/**
 * A System constrained by a Constraint (constrains: Constraint -> System), the reverse of the
 * `contains`/`satisfies`/etc. direction a System/Component typically originates. Models the
 * real-world bug: `--from` on the System with `--rel constrains` finds nothing without `in`.
 */
function constrainsGraph(): Graph {
  return graphOf([
    concept("sys.system.md", "---\ntype: System\ntitle: Sys\n---"),
    concept(
      "c.constraint.md",
      "---\ntype: Constraint\ntitle: C\nrelations:\n  constrains:\n    - /sys.system.md\n---",
    ),
  ]);
}

describe("selectSubgraph direction", () => {
  it("direction 'out' (default) does not find an incoming constrains edge", () => {
    const view = selectSubgraph(constrainsGraph(), {
      from: "sys.system",
      relations: ["constrains"],
      depth: 1,
    });
    expect(view.nodes.map((n) => n.id)).toEqual(["sys.system"]);
    expect(view.edges).toHaveLength(0);
  });

  it("direction 'in' finds the constrains edge pointing at the root", () => {
    const view = selectSubgraph(constrainsGraph(), {
      from: "sys.system",
      relations: ["constrains"],
      depth: 1,
      direction: "in",
    });
    expect(view.nodes.map((n) => n.id).sort()).toEqual(["c.constraint", "sys.system"]);
    expect(view.edges).toHaveLength(1);
    expect(view.edges[0]).toMatchObject({
      from: "c.constraint",
      to: "sys.system",
      kind: "constrains",
    });
  });

  it("direction 'both' finds edges on either side of the root", () => {
    const g = graphOf([
      concept(
        "a.component.md",
        "---\ntype: Component\ntitle: A\nrelations:\n  depends-on:\n    - /b.component.md\n---",
      ),
      concept("b.component.md", "---\ntype: Component\ntitle: B\n---"),
      concept(
        "c.constraint.md",
        "---\ntype: Constraint\ntitle: C\nrelations:\n  constrains:\n    - /a.component.md\n---",
      ),
    ]);
    // From 'a': outgoing depends-on -> b, incoming constrains <- c. 'out' alone misses c;
    // 'both' finds both neighbors in one hop.
    const out = selectSubgraph(g, { from: "a.component", direction: "out", depth: 1 });
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["a.component", "b.component"]);

    const both = selectSubgraph(g, { from: "a.component", direction: "both", depth: 1 });
    expect(both.nodes.map((n) => n.id).sort()).toEqual([
      "a.component",
      "b.component",
      "c.constraint",
    ]);
    expect(both.edges.map((e) => e.kind).sort()).toEqual(["constrains", "depends-on"]);
  });

  it("limits traversal depth when walking 'in'", () => {
    // Chain a <- b <- c (each depends-on the previous), walking backward from a.
    const g = graphOf([
      concept("a.component.md", "---\ntype: Component\n---"),
      concept(
        "b.component.md",
        "---\ntype: Component\nrelations:\n  depends-on:\n    - /a.component.md\n---",
      ),
      concept(
        "c.component.md",
        "---\ntype: Component\nrelations:\n  depends-on:\n    - /b.component.md\n---",
      ),
    ]);
    expect(
      selectSubgraph(g, { from: "a.component", direction: "in", depth: 1 }).nodes.map((n) => n.id),
    ).toEqual(["a.component", "b.component"]);
    expect(
      selectSubgraph(g, { from: "a.component", direction: "in", depth: 0 }).nodes.map((n) => n.id),
    ).toEqual(["a.component"]);
    expect(selectSubgraph(g, { from: "a.component", direction: "in" }).nodes).toHaveLength(3);
  });

  it("limits traversal depth when walking 'both'", () => {
    // b <-> a <-> c via depends-on in opposite directions; both hops are still bounded by depth.
    const g = graphOf([
      concept(
        "a.component.md",
        "---\ntype: Component\nrelations:\n  depends-on:\n    - /b.component.md\n---",
      ),
      concept("b.component.md", "---\ntype: Component\n---"),
      concept(
        "c.component.md",
        "---\ntype: Component\nrelations:\n  depends-on:\n    - /a.component.md\n---",
      ),
    ]);
    expect(
      selectSubgraph(g, { from: "a.component", direction: "both", depth: 0 }).nodes.map(
        (n) => n.id,
      ),
    ).toEqual(["a.component"]);
    expect(
      selectSubgraph(g, { from: "a.component", direction: "both", depth: 1 }).nodes.map(
        (n) => n.id,
      ),
    ).toEqual(["a.component", "b.component", "c.component"]);
  });

  it("combines --rel filtering with direction 'in'", () => {
    const g = graphOf([
      concept("sys.system.md", "---\ntype: System\ntitle: Sys\n---"),
      concept(
        "constraint.constraint.md",
        "---\ntype: Constraint\ntitle: C\nrelations:\n  constrains:\n    - /sys.system.md\n---",
      ),
      concept(
        "comp.component.md",
        "---\ntype: Component\ntitle: Comp\nrelations:\n  depends-on:\n    - /sys.system.md\n---",
      ),
    ]);
    // Both 'constrains' and 'depends-on' point at sys.system, but --rel restricts to constrains.
    const view = selectSubgraph(g, {
      from: "sys.system",
      relations: ["constrains"],
      direction: "in",
      depth: 1,
    });
    expect(view.nodes.map((n) => n.id).sort()).toEqual(["constraint.constraint", "sys.system"]);
    expect(view.edges.map((e) => e.kind)).toEqual(["constrains"]);
  });

  it("applies direction to structural child edges too", () => {
    const g = graphOf([
      concept("auth.system.md", "---\ntype: System\ntitle: Auth\n---"),
      concept("auth/login.component.md", "---\ntype: Component\ntitle: Login\n---"),
    ]);
    // 'out' (default) is parent -> child: from the System, the Component is reachable.
    const fromParent = selectSubgraph(g, { from: "auth.system", structure: true, depth: 1 });
    expect(fromParent.nodes.map((n) => n.id).sort()).toEqual([
      "auth.system",
      "auth/login.component",
    ]);

    // From the child with 'out', the parent is not reachable (child has no outgoing child edge).
    const childOut = selectSubgraph(g, {
      from: "auth/login.component",
      structure: true,
      depth: 1,
    });
    expect(childOut.nodes.map((n) => n.id)).toEqual(["auth/login.component"]);

    // From the child with 'in', walking backward finds the parent.
    const childIn = selectSubgraph(g, {
      from: "auth/login.component",
      structure: true,
      direction: "in",
      depth: 1,
    });
    expect(childIn.nodes.map((n) => n.id).sort()).toEqual(["auth.system", "auth/login.component"]);
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

  it("defaults to direction 'out' when omitted (backward-compatible signature)", () => {
    const g = constrainsGraph();
    const outIds = reachableIds(g, "sys.system", () => true);
    expect([...outIds]).toEqual(["sys.system"]);
  });

  it("accepts an explicit direction as a 5th argument", () => {
    const g = constrainsGraph();
    const inIds = reachableIds(g, "sys.system", () => true, undefined, "in");
    expect([...inIds].sort()).toEqual(["c.constraint", "sys.system"]);
  });
});
