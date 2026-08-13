/**
 * graphspec profile checks.
 *
 * These enforce the graphspec profile layered on top of OKF. They are SOFT (warnings) by
 * default and promoted to errors under `--strict` — with one deliberate exception:
 * unresolved relation targets remain warnings even under `--strict`, because OKF explicitly
 * tolerates broken cross-links (reference-first authoring).
 *
 * Checks:
 *  - filename token `<name>.<token>.md` matches the frontmatter `type`;
 *  - the `type` is part of the graphspec profile vocabulary;
 *  - required frontmatter fields are present with allowed enum values;
 *  - each relation name is in the vocabulary;
 *  - the source concept's type is an allowed source for the relation;
 *  - each relation target resolves to a concept whose type is an allowed target.
 */

import type { Graph } from "../core/graph.js";
import type { Concept } from "../core/types.js";
import { nodeTypeByName, tokenForType } from "../profile/node-types.js";
import { relationByName, typeAllowed } from "../profile/relations.js";
import type { Diagnostic, Severity } from "./diagnostics.js";

/** Options controlling how profile diagnostics are graded. */
export interface ProfileCheckOptions {
  /** When true, profile warnings are promoted to errors (except unresolved targets). */
  readonly strict: boolean;
}

/** The base severity for a profile check given strictness. */
function base(strict: boolean): Severity {
  return strict ? "error" : "warning";
}

/** Whether a frontmatter value is present and non-empty. */
function present(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  return true;
}

/**
 * Run graphspec profile checks over the graph's concepts.
 *
 * The {@link Graph} is used to resolve relation targets and inspect their types.
 */
export function checkProfile(graph: Graph, options: ProfileCheckOptions): Diagnostic[] {
  const severity = base(options.strict);
  const diagnostics: Diagnostic[] = [];

  for (const concept of graph.concepts()) {
    // Concepts with no/empty type are already flagged by OKF conformance; skip here.
    if (!concept.type) {
      continue;
    }

    checkType(concept, severity, diagnostics);
    checkFilenameToken(concept, severity, diagnostics);
    checkRequiredFields(concept, severity, diagnostics);
    checkRelations(concept, graph, severity, diagnostics);
  }

  return diagnostics;
}

/** Warn when a concept's type is not part of the graphspec profile. */
function checkType(concept: Concept, severity: Severity, out: Diagnostic[]): void {
  if (!nodeTypeByName(concept.type as string)) {
    out.push({
      severity,
      source: "profile",
      rule: "profile/unknown-type",
      file: concept.relPath,
      conceptId: concept.id,
      message: `Type "${concept.type}" is not part of the graphspec profile vocabulary.`,
    });
  }
}

/** Warn when the filename token doesn't match the frontmatter type's token. */
function checkFilenameToken(concept: Concept, severity: Severity, out: Diagnostic[]): void {
  const expected = tokenForType(concept.type as string);
  // Unknown types are handled by checkType; no expected token to compare against.
  if (expected === undefined) {
    return;
  }
  if (concept.fileToken === undefined) {
    out.push({
      severity,
      source: "profile",
      rule: "profile/missing-filename-token",
      file: concept.relPath,
      conceptId: concept.id,
      message: `Filename is missing a type token; expected "<name>.${expected}.md".`,
    });
    return;
  }
  if (concept.fileToken !== expected) {
    out.push({
      severity,
      source: "profile",
      rule: "profile/filename-token-mismatch",
      file: concept.relPath,
      conceptId: concept.id,
      message: `Filename token ".${concept.fileToken}" does not match type "${concept.type}" (expected ".${expected}").`,
    });
  }
}

/** Check that required frontmatter fields are present with allowed enum values. */
function checkRequiredFields(concept: Concept, severity: Severity, out: Diagnostic[]): void {
  const nodeType = nodeTypeByName(concept.type as string);
  if (!nodeType) {
    return;
  }
  for (const field of nodeType.requiredFields) {
    const value = concept.frontmatter[field.key];
    if (!present(value)) {
      out.push({
        severity,
        source: "profile",
        rule: "profile/missing-required-field",
        file: concept.relPath,
        conceptId: concept.id,
        message: `${concept.type} requires a non-empty "${field.key}" frontmatter field.`,
      });
      continue;
    }
    if (field.values && !field.values.includes(String(value))) {
      out.push({
        severity,
        source: "profile",
        rule: "profile/invalid-field-value",
        file: concept.relPath,
        conceptId: concept.id,
        message: `Field "${field.key}"="${String(value)}" is invalid; expected one of: ${field.values.join(", ")}.`,
      });
    }
  }
}

/** Check relation names, source-type eligibility, and target resolution/type. */
function checkRelations(
  concept: Concept,
  graph: Graph,
  severity: Severity,
  out: Diagnostic[],
): void {
  for (const rel of concept.relations) {
    const relation = relationByName(rel.name);
    if (!relation) {
      out.push({
        severity,
        source: "profile",
        rule: "profile/unknown-relation",
        file: concept.relPath,
        conceptId: concept.id,
        message: `Relation "${rel.name}" is not part of the graphspec profile vocabulary.`,
      });
      continue;
    }

    // Source type eligibility (skip if the source type is unknown — already flagged).
    if (
      nodeTypeByName(concept.type as string) &&
      !typeAllowed(relation.sourceTypes, concept.type as string)
    ) {
      out.push({
        severity,
        source: "profile",
        rule: "profile/invalid-relation-source",
        file: concept.relPath,
        conceptId: concept.id,
        message: `${concept.type} may not be a source of "${rel.name}" (allowed sources: ${relation.sourceTypes.join(", ")}).`,
      });
    }

    const target = graph.get(rel.targetId);
    if (!target) {
      // Broken links are tolerated by OKF: always a warning, even under --strict.
      out.push({
        severity: "warning",
        source: "profile",
        rule: "profile/unresolved-target",
        file: concept.relPath,
        conceptId: concept.id,
        message: `Relation "${rel.name}" target "${rel.rawTarget}" does not resolve to a concept.`,
      });
      continue;
    }

    // Target type eligibility (skip if the target's type is unknown/missing).
    if (
      target.type &&
      nodeTypeByName(target.type) &&
      !typeAllowed(relation.targetTypes, target.type)
    ) {
      out.push({
        severity,
        source: "profile",
        rule: "profile/invalid-relation-target",
        file: concept.relPath,
        conceptId: concept.id,
        message: `"${rel.name}" target ${target.id} is a ${target.type}; allowed targets: ${relation.targetTypes.join(", ")}.`,
      });
    }
  }
}
