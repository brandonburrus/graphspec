/**
 * Core domain types shared across the parser, graph model, and validation.
 */

import type { Section } from "./sections.js";

/** A parsed relation edge as declared in a concept's frontmatter. */
export interface RelationRef {
  /** Relation name, e.g. `satisfies`. */
  readonly name: string;
  /** Raw target reference as written in frontmatter, e.g. `/spec/x.requirement.md`. */
  readonly rawTarget: string;
  /** Normalized concept-ID candidate for the target. */
  readonly targetId: string;
}

/**
 * A single OKF concept: one non-reserved `.md` file with parseable frontmatter.
 */
export interface Concept {
  /** Concept ID: bundle-relative path minus `.md`. */
  readonly id: string;
  /** Absolute path on disk. */
  readonly filePath: string;
  /** Bundle-relative path including `.md`. */
  readonly relPath: string;
  /** Base filename without extension, e.g. `login.requirement`. */
  readonly fileName: string;
  /**
   * The kebab-case type token parsed from the filename (`<name>.<token>.md`), or undefined
   * when the filename has no token segment. Used by the profile filename check.
   */
  readonly fileToken: string | undefined;
  /** Raw frontmatter object (all keys preserved, including unknown ones). */
  readonly frontmatter: Record<string, unknown>;
  /** The `type` frontmatter value (may be empty/undefined for a malformed concept). */
  readonly type: string | undefined;
  /** The `title` frontmatter value, if present. */
  readonly title: string | undefined;
  /** The `description` frontmatter value, if present. */
  readonly description: string | undefined;
  /** The `tags` frontmatter value normalized to a string array. */
  readonly tags: readonly string[];
  /** Markdown body (everything after frontmatter). */
  readonly body: string;
  /** Extracted top-level H1 sections. */
  readonly sections: readonly Section[];
  /** Typed relations declared under `relations:`. */
  readonly relations: readonly RelationRef[];
  /** True when the file had a parseable frontmatter block with valid YAML. */
  readonly hasFrontmatter: boolean;
  /** Present when a frontmatter block existed but failed to parse as YAML. */
  readonly frontmatterError?: string;
}

/** A reserved OKF file (`index.md` or `log.md`). */
export interface ReservedFile {
  readonly kind: "index" | "log";
  readonly filePath: string;
  readonly relPath: string;
  /** Directory (bundle-relative) the file governs; "" for the bundle root. */
  readonly dir: string;
  /** Raw frontmatter, only meaningful for the root index.md (may carry okf_version). */
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
}

/** The result of loading a bundle from disk. */
export interface Bundle {
  /** Absolute path to the bundle root directory. */
  readonly root: string;
  /** All concept documents. */
  readonly concepts: readonly Concept[];
  /** All reserved files (index.md / log.md). */
  readonly reserved: readonly ReservedFile[];
  /**
   * Bundle-relative paths of `.md` files skipped because their filename carries no
   * `.<type-token>` segment (e.g. `AGENTS.md`, `README.md`). Retained so callers can report
   * what was left out rather than letting a mis-named concept vanish silently.
   */
  readonly ignored: readonly string[];
}
