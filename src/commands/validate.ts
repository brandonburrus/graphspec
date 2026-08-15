/**
 * `graphspec validate [path]` — OKF conformance + graphspec profile checks.
 */

import { loadBundle } from "../core/bundle.js";
import type { Diagnostic } from "../validate/diagnostics.js";
import { validateBundle } from "../validate/index.js";
import type { Writer } from "./io.js";

/** Options accepted by the validate command. */
export interface ValidateCommandOptions {
  strict?: boolean;
  json?: boolean;
}

/**
 * Run the validate command against `path`.
 *
 * @returns process exit code: 0 when no errors, 1 when errors are present, 2 on I/O failure.
 */
export async function runValidate(
  path: string,
  options: ValidateCommandOptions,
  writer: Writer,
): Promise<number> {
  let result: ReturnType<typeof validateBundle>;
  let ignored: readonly string[];
  try {
    const bundle = await loadBundle(path);
    ignored = bundle.ignored;
    result = validateBundle(bundle, { strict: options.strict ?? false });
  } catch (err) {
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  if (options.json) {
    writer.out(
      JSON.stringify(
        {
          path,
          strict: options.strict ?? false,
          errorCount: result.errorCount,
          warningCount: result.warningCount,
          conceptCount: result.conceptCount,
          ignored,
          diagnostics: result.diagnostics,
        },
        null,
        2,
      ),
    );
    return result.errorCount > 0 ? 1 : 0;
  }

  for (const d of result.diagnostics) {
    writer.out(formatDiagnostic(d));
  }

  // Report skipped files so a concept mis-named without its `.<type-token>` segment is
  // visibly absent rather than silently missing from the graph.
  const ignoredNote =
    ignored.length > 0
      ? `\n${ignored.length} file(s) ignored (no type token): ${ignored.join(", ")}`
      : "";
  const summary = `${ignoredNote}\n\n${result.conceptCount} concept(s), ${result.errorCount} error(s), ${result.warningCount} warning(s)${options.strict ? " [strict]" : ""}`;
  if (result.errorCount > 0) {
    writer.err(summary.trim());
    return 1;
  }
  writer.out(summary.trim());
  return 0;
}

/** Format a diagnostic as `file: severity [rule]: message`. */
function formatDiagnostic(d: Diagnostic): string {
  return `${d.file}: ${d.severity} [${d.rule}]: ${d.message}`;
}
