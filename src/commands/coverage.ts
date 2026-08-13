/**
 * `graphspec coverage [path]` — report spec-graph completeness against the profile.
 */

import { loadBundle } from "../core/bundle.js";
import { type CoverageReport, analyzeCoverage } from "../core/coverage.js";
import { Graph } from "../core/graph.js";
import type { Writer } from "./io.js";

/** Options accepted by the coverage command. */
export interface CoverageCommandOptions {
  json?: boolean;
  strict?: boolean;
}

/** A gap category: its human label and the offending concept IDs. */
interface Category {
  readonly label: string;
  readonly ids: string[];
}

/**
 * Run the coverage command against `path`.
 *
 * @returns process exit code: 0 on success (or when gaps exist without `--strict`), 1 when
 * `--strict` and gaps are found, 2 on I/O failure.
 */
export async function runCoverage(
  path: string,
  options: CoverageCommandOptions,
  writer: Writer,
): Promise<number> {
  let report: CoverageReport;
  try {
    const bundle = await loadBundle(path);
    report = analyzeCoverage(Graph.fromBundle(bundle));
  } catch (err) {
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  const failed = options.strict === true && report.totalGaps > 0;

  if (options.json) {
    writer.out(JSON.stringify(report, null, 2));
    return failed ? 1 : 0;
  }

  const categories: Category[] = [
    { label: "Unsatisfied requirements (no satisfies)", ids: report.unsatisfiedRequirements },
    { label: "Untested requirements (no covers)", ids: report.untestedRequirements },
    { label: "Untested journeys (no covers)", ids: report.untestedJourneys },
    { label: "Empty features (no includes)", ids: report.emptyFeatures },
    { label: "Unrealized features (no realizes)", ids: report.unrealizedFeatures },
    { label: "Dangling constraints (no constrains)", ids: report.danglingConstraints },
    { label: "Orphan concepts (no relations)", ids: report.orphanConcepts },
    {
      label: "Unresolved relation targets",
      ids: report.unresolvedTargets.map((t) => `${t.from} --${t.relation}--> ${t.target}`),
    },
  ];

  for (const category of categories) {
    writer.out(`${category.label}: ${category.ids.length}`);
    for (const id of category.ids) {
      writer.out(`  - ${id}`);
    }
  }

  const summary = `\n${report.totalGaps} gap(s)${options.strict ? " [strict]" : ""}`;
  if (failed) {
    writer.err(summary.trim());
    return 1;
  }
  writer.out(summary.trim());
  return 0;
}
