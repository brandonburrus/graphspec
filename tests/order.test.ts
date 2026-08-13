import { describe, expect, it } from "vitest";
import { Graph } from "../src/core/graph.js";
import { buildOrder } from "../src/core/order.js";
import { parseConcept } from "../src/core/parser.js";
import type { Bundle, Concept } from "../src/core/types.js";

function concept(relPath: string, raw: string): Concept {
  return parseConcept(raw, `/abs/${relPath}`, relPath);
}

function graphOf(concepts: Concept[]): Graph {
  const bundle: Bundle = { root: "/abs", concepts, reserved: [] };
  return Graph.fromBundle(bundle);
}

function dependsOn(name: string, type: string, deps: string[]): Concept {
  const rel =
    deps.length > 0
      ? `relations:\n  depends-on:\n${deps.map((d) => `    - /${d}.md`).join("\n")}\n`
      : "";
  return concept(`${name}.md`, `---\ntype: ${type}\n${rel}---`);
}

describe("buildOrder", () => {
  it("orders dependencies before their dependents", () => {
    const g = graphOf([
      dependsOn("validator.component", "Component", ["graph-model.component"]),
      dependsOn("graph-model.component", "Component", ["parser.component"]),
      dependsOn("parser.component", "Component", []),
    ]);
    const { order, cycles } = buildOrder(g);
    expect(cycles).toEqual([]);
    expect(order.indexOf("parser.component")).toBeLessThan(order.indexOf("graph-model.component"));
    expect(order.indexOf("graph-model.component")).toBeLessThan(
      order.indexOf("validator.component"),
    );
  });

  it("only orders System and Component concepts", () => {
    const g = graphOf([
      dependsOn("cli.system", "System", ["core.component"]),
      dependsOn("core.component", "Component", []),
      concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
    ]);
    const { order } = buildOrder(g);
    expect(order).toEqual(["core.component", "cli.system"]);
    expect(order).not.toContain("r.requirement");
  });

  it("breaks ties alphabetically for deterministic output", () => {
    const g = graphOf([
      dependsOn("b.component", "Component", []),
      dependsOn("a.component", "Component", []),
      dependsOn("c.component", "Component", []),
    ]);
    expect(buildOrder(g).order).toEqual(["a.component", "b.component", "c.component"]);
  });

  it("detects a dependency cycle and reports it", () => {
    const g = graphOf([
      dependsOn("a.component", "Component", ["b.component"]),
      dependsOn("b.component", "Component", ["a.component"]),
    ]);
    const { cycles, order } = buildOrder(g);
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0])).toEqual(new Set(["a.component", "b.component"]));
    // Neither cyclic node can be ordered.
    expect(order).not.toContain("a.component");
    expect(order).not.toContain("b.component");
  });

  it("orders the acyclic portion even when a separate cycle exists", () => {
    const g = graphOf([
      dependsOn("x.component", "Component", []),
      dependsOn("a.component", "Component", ["b.component"]),
      dependsOn("b.component", "Component", ["a.component"]),
    ]);
    const { order, cycles } = buildOrder(g);
    expect(order).toContain("x.component");
    expect(cycles).toHaveLength(1);
  });

  it("returns an empty order when there is nothing to order", () => {
    const g = graphOf([concept("t.term.md", "---\ntype: Term\n---")]);
    expect(buildOrder(g)).toEqual({ order: [], cycles: [] });
  });
});
