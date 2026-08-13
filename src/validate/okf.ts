/**
 * OKF v0.1 conformance checks (spec §9). These are HARD errors.
 *
 * A bundle is conformant when every non-reserved `.md` file has a parseable YAML
 * frontmatter block containing a non-empty `type`. OKF is otherwise permissive: unknown
 * types, missing optional fields, unknown keys, and broken cross-links MUST NOT fail.
 */

import type { Concept } from "../core/types.js";
import type { Diagnostic } from "./diagnostics.js";

/**
 * Run OKF conformance checks over the concept documents.
 *
 * Emits an error for any concept lacking a parseable frontmatter block, and any concept
 * whose frontmatter has no non-empty `type` field.
 */
export function checkOkfConformance(concepts: readonly Concept[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const concept of concepts) {
    if (concept.frontmatterError !== undefined) {
      diagnostics.push({
        severity: "error",
        source: "okf",
        rule: "okf/unparseable-frontmatter",
        file: concept.relPath,
        conceptId: concept.id,
        message: `Frontmatter block failed to parse as YAML: ${concept.frontmatterError}`,
      });
      continue;
    }
    if (!concept.hasFrontmatter) {
      diagnostics.push({
        severity: "error",
        source: "okf",
        rule: "okf/missing-frontmatter",
        file: concept.relPath,
        conceptId: concept.id,
        message: "File has no parseable YAML frontmatter block (OKF requires one).",
      });
      // Without frontmatter there is no type to check; move on.
      continue;
    }
    if (concept.type === undefined || concept.type === "") {
      diagnostics.push({
        severity: "error",
        source: "okf",
        rule: "okf/missing-type",
        file: concept.relPath,
        conceptId: concept.id,
        message: "Frontmatter is missing a non-empty `type` field (required by OKF).",
      });
    }
  }
  return diagnostics;
}
