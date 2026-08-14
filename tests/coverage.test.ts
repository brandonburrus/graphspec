import { describe, expect, it } from "vitest";
import { analyzeCoverage } from "../src/core/coverage.js";
import { Graph } from "../src/core/graph.js";
import { parseConcept } from "../src/core/parser.js";
import type { Bundle, Concept } from "../src/core/types.js";

function concept(relPath: string, raw: string): Concept {
  return parseConcept(raw, `/abs/${relPath}`, relPath);
}

function graphOf(concepts: Concept[]): Graph {
  const bundle: Bundle = { root: "/abs", concepts, reserved: [] };
  return Graph.fromBundle(bundle);
}

describe("analyzeCoverage", () => {
  it("reports no gaps for a fully covered graph", () => {
    const g = graphOf([
      concept(
        "f.feature.md",
        "---\ntype: Feature\nrelations:\n  includes:\n    - /r.requirement.md\n---",
      ),
      concept(
        "c.component.md",
        "---\ntype: Component\nrelations:\n  realizes:\n    - /f.feature.md\n  satisfies:\n    - /r.requirement.md\n---",
      ),
      concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
      concept(
        "t.test-scenario.md",
        "---\ntype: TestScenario\nlevel: unit\nrelations:\n  covers:\n    - /r.requirement.md\n---",
      ),
    ]);
    const report = analyzeCoverage(g);
    expect(report.totalGaps).toBe(0);
  });

  it("flags unsatisfied and untested requirements", () => {
    const g = graphOf([
      concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
    ]);
    const report = analyzeCoverage(g);
    expect(report.unsatisfiedRequirements).toEqual(["r.requirement"]);
    expect(report.untestedRequirements).toEqual(["r.requirement"]);
    // A lone requirement with no edges is also an orphan.
    expect(report.orphanConcepts).toEqual(["r.requirement"]);
  });

  it("flags empty and unrealized features", () => {
    const g = graphOf([concept("f.feature.md", "---\ntype: Feature\n---")]);
    const report = analyzeCoverage(g);
    expect(report.emptyFeatures).toEqual(["f.feature"]);
    expect(report.unrealizedFeatures).toEqual(["f.feature"]);
  });

  it("flags untested journeys and dangling constraints", () => {
    const g = graphOf([
      concept(
        "j.user-journey.md",
        "---\ntype: UserJourney\nrelations:\n  exercises:\n    - /f.feature.md\n---",
      ),
      concept(
        "f.feature.md",
        "---\ntype: Feature\nrelations:\n  includes:\n    - /r.requirement.md\n---",
      ),
      concept(
        "r.requirement.md",
        "---\ntype: Requirement\nstatus: accepted\nrelations:\n  refines:\n    - /r.requirement.md\n---",
      ),
      concept("k.constraint.md", "---\ntype: Constraint\ncategory: perf\n---"),
    ]);
    const report = analyzeCoverage(g);
    expect(report.untestedJourneys).toContain("j.user-journey");
    expect(report.danglingConstraints).toEqual(["k.constraint"]);
  });

  it("excludes Term nodes from the orphan check", () => {
    const g = graphOf([concept("t.term.md", "---\ntype: Term\n---")]);
    expect(analyzeCoverage(g).orphanConcepts).toEqual([]);
  });

  it("reports unresolved relation targets with source and relation", () => {
    const g = graphOf([
      concept(
        "c.component.md",
        "---\ntype: Component\nrelations:\n  satisfies:\n    - /missing.requirement.md\n---",
      ),
    ]);
    const report = analyzeCoverage(g);
    expect(report.unresolvedTargets).toHaveLength(1);
    expect(report.unresolvedTargets[0]).toMatchObject({
      from: "c.component",
      relation: "satisfies",
    });
    expect(report.unresolvedTargets[0].target).toContain("missing.requirement");
  });

  it("does not require covers from a non-TestScenario source", () => {
    // A `covers` edge only counts when it originates from a TestScenario.
    const g = graphOf([
      concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
    ]);
    expect(analyzeCoverage(g).untestedRequirements).toEqual(["r.requirement"]);
  });
});
