/**
 * Diagnostics: the structured output of validation.
 */

/** Severity of a diagnostic. */
export type Severity = "error" | "warning";

/** A rule identifier namespace, for machine consumers and future suppression. */
export type DiagnosticSource = "okf" | "profile";

/** A single validation finding. */
export interface Diagnostic {
  /** Severity. OKF conformance failures are always errors. */
  readonly severity: Severity;
  /** Which layer produced it. */
  readonly source: DiagnosticSource;
  /** Stable rule code, e.g. `okf/missing-type` or `profile/filename-token-mismatch`. */
  readonly rule: string;
  /** Bundle-relative file the diagnostic concerns. */
  readonly file: string;
  /** Human-readable message. */
  readonly message: string;
  /** Optional concept ID the diagnostic concerns. */
  readonly conceptId?: string;
}

/** The outcome of validating a bundle. */
export interface ValidationResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly errorCount: number;
  readonly warningCount: number;
  /** Number of concept documents examined. */
  readonly conceptCount: number;
}

/** Build a ValidationResult from a flat diagnostic list. */
export function summarize(
  diagnostics: readonly Diagnostic[],
  conceptCount: number,
): ValidationResult {
  let errorCount = 0;
  let warningCount = 0;
  for (const d of diagnostics) {
    if (d.severity === "error") {
      errorCount++;
    } else {
      warningCount++;
    }
  }
  return { diagnostics, errorCount, warningCount, conceptCount };
}
