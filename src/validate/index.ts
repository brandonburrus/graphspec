/**
 * Validation orchestrator: run OKF conformance + graphspec profile checks over a bundle.
 */

import { Graph } from "../core/graph.js";
import type { Bundle } from "../core/types.js";
import { type Diagnostic, type ValidationResult, summarize } from "./diagnostics.js";
import { checkOkfConformance } from "./okf.js";
import { checkProfile } from "./profile.js";

export * from "./diagnostics.js";
export { checkOkfConformance } from "./okf.js";
export { checkProfile, type ProfileCheckOptions } from "./profile.js";

/** Options for {@link validateBundle}. */
export interface ValidateOptions {
  /** Promote profile warnings to errors (except unresolved targets). */
  readonly strict?: boolean;
}

/**
 * Validate a bundle: OKF hard-error conformance followed by soft graphspec profile checks.
 *
 * Diagnostics are ordered by file, then errors before warnings, for stable reporting.
 */
export function validateBundle(bundle: Bundle, options: ValidateOptions = {}): ValidationResult {
  const strict = options.strict ?? false;
  const graph = Graph.fromBundle(bundle);

  const diagnostics: Diagnostic[] = [
    ...checkOkfConformance(bundle.concepts),
    ...checkProfile(graph, { strict }),
  ];

  diagnostics.sort(compareDiagnostics);
  return summarize(diagnostics, bundle.concepts.length);
}

/** Stable ordering: by file path, then errors before warnings, then rule. */
function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  if (a.file !== b.file) {
    return a.file < b.file ? -1 : 1;
  }
  if (a.severity !== b.severity) {
    return a.severity === "error" ? -1 : 1;
  }
  return a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0;
}
