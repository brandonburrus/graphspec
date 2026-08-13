/**
 * Coverage analysis: report spec-graph completeness against the graphspec profile.
 *
 * Each gap category names the concepts that leave the graph incomplete — requirements with
 * nothing implementing or testing them, features with no requirements or no realizer,
 * dangling constraints, orphaned concepts, and references that fail to resolve. Kept in the
 * core layer so the analysis stays independently testable and reusable by later sessions.
 */

import { CHILD_EDGE, type Graph } from "./graph.js";

/** A relation reference that does not resolve to an existing concept. */
export interface UnresolvedTarget {
  /** Source concept ID that declared the reference. */
  readonly from: string;
  /** Relation name the reference was declared under. */
  readonly relation: string;
  /** The raw (or normalized) target reference that failed to resolve. */
  readonly target: string;
}

/** The full coverage report for a bundle. */
export interface CoverageReport {
  /** Requirements with no incoming `satisfies` edge. */
  readonly unsatisfiedRequirements: string[];
  /** Requirements with no incoming `covers` edge from a TestScenario. */
  readonly untestedRequirements: string[];
  /** UserJourneys with no incoming `covers` edge. */
  readonly untestedJourneys: string[];
  /** Features with no outgoing `includes` edge. */
  readonly emptyFeatures: string[];
  /** Features with no incoming `realizes` edge. */
  readonly unrealizedFeatures: string[];
  /** Constraints with no outgoing `constrains` edge. */
  readonly danglingConstraints: string[];
  /** Non-Term concepts with zero relation edges in or out. */
  readonly orphanConcepts: string[];
  /** Relation references that do not resolve to an existing concept. */
  readonly unresolvedTargets: UnresolvedTarget[];
  /** Total number of individual gaps across all categories. */
  readonly totalGaps: number;
}

/** Analyze a graph and produce a {@link CoverageReport}. */
export function analyzeCoverage(graph: Graph): CoverageReport {
  const unsatisfiedRequirements: string[] = [];
  const untestedRequirements: string[] = [];
  const untestedJourneys: string[] = [];
  const emptyFeatures: string[] = [];
  const unrealizedFeatures: string[] = [];
  const danglingConstraints: string[] = [];
  const orphanConcepts: string[] = [];
  const unresolvedTargets: UnresolvedTarget[] = [];

  for (const concept of graph.concepts()) {
    const id = concept.id;
    switch (concept.type) {
      case "Requirement":
        if (graph.edgesTo(id, "satisfies").length === 0) {
          unsatisfiedRequirements.push(id);
        }
        if (!hasTestScenarioCover(graph, id)) {
          untestedRequirements.push(id);
        }
        break;
      case "UserJourney":
        if (!hasTestScenarioCover(graph, id)) {
          untestedJourneys.push(id);
        }
        break;
      case "Feature":
        if (graph.edgesFrom(id, "includes").length === 0) {
          emptyFeatures.push(id);
        }
        if (graph.edgesTo(id, "realizes").length === 0) {
          unrealizedFeatures.push(id);
        }
        break;
      case "Constraint":
        if (graph.edgesFrom(id, "constrains").length === 0) {
          danglingConstraints.push(id);
        }
        break;
      default:
        break;
    }

    if (concept.type !== "Term" && isOrphan(graph, id)) {
      orphanConcepts.push(id);
    }
  }

  for (const edge of graph.edges()) {
    if (edge.kind !== CHILD_EDGE && !edge.resolved) {
      unresolvedTargets.push({
        from: edge.from,
        relation: edge.kind,
        target: edge.rawTarget ?? edge.to,
      });
    }
  }

  const totalGaps =
    unsatisfiedRequirements.length +
    untestedRequirements.length +
    untestedJourneys.length +
    emptyFeatures.length +
    unrealizedFeatures.length +
    danglingConstraints.length +
    orphanConcepts.length +
    unresolvedTargets.length;

  return {
    unsatisfiedRequirements,
    untestedRequirements,
    untestedJourneys,
    emptyFeatures,
    unrealizedFeatures,
    danglingConstraints,
    orphanConcepts,
    unresolvedTargets,
    totalGaps,
  };
}

/** Whether `id` has at least one incoming `covers` edge from a TestScenario concept. */
function hasTestScenarioCover(graph: Graph, id: string): boolean {
  return graph.edgesTo(id, "covers").some((e) => graph.get(e.from)?.type === "TestScenario");
}

/** Whether `id` has no relation edges (kind other than the structural child edge) in or out. */
function isOrphan(graph: Graph, id: string): boolean {
  const outgoing = graph.edgesFrom(id).some((e) => e.kind !== CHILD_EDGE);
  const incoming = graph.edgesTo(id).some((e) => e.kind !== CHILD_EDGE);
  return !outgoing && !incoming;
}
