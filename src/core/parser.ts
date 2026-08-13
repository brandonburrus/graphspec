/**
 * OKF concept parser.
 *
 * Parses a single markdown file into a {@link Concept}, or recognizes it as a reserved
 * OKF file. Frontmatter is parsed with gray-matter (js-yaml). Unknown frontmatter keys are
 * preserved verbatim, per OKF's extension rule.
 */

import matter from "gray-matter";
import { normalizeRef } from "./refs.js";
import { extractSections } from "./sections.js";
import type { Concept, RelationRef, ReservedFile } from "./types.js";

/** Reserved OKF filenames that are not concepts. */
export const RESERVED_FILENAMES = new Set(["index.md", "log.md"]);

/** Whether a filename (basename) is a reserved OKF file. */
export function isReservedFilename(basename: string): boolean {
  return RESERVED_FILENAMES.has(basename.toLowerCase());
}

/**
 * Detect whether a file's raw content contains a parseable frontmatter block.
 *
 * gray-matter returns empty data for files with no `---` delimited block, so we look for a
 * leading fence explicitly to distinguish "no frontmatter" from "empty frontmatter".
 */
function hasFrontmatterBlock(raw: string): boolean {
  // A frontmatter block starts at the very top of the file with `---` on its own line.
  return /^\uFEFF?---\r?\n/.test(raw);
}

/** Result of a defensive frontmatter parse. */
interface ParseResult {
  data: Record<string, unknown>;
  content: string;
  /** Present when a frontmatter block existed but failed to parse as YAML. */
  error?: string;
}

/**
 * Parse frontmatter defensively: a malformed YAML block yields a structured error rather
 * than throwing, so one bad file cannot crash a whole-bundle operation.
 */
function safeMatter(raw: string): ParseResult {
  if (!hasFrontmatterBlock(raw)) {
    return { data: {}, content: raw };
  }
  try {
    const parsed = matter(raw);
    return { data: (parsed.data ?? {}) as Record<string, unknown>, content: parsed.content ?? "" };
  } catch (err) {
    return { data: {}, content: raw, error: (err as Error).message };
  }
}

/** Normalize a frontmatter `tags` value into a string array. */
function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  if (typeof value === "string" && value.trim() !== "") {
    return [value.trim()];
  }
  return [];
}

/** Coerce a frontmatter value to a trimmed string, or undefined when absent/empty. */
function optionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" ? undefined : t;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

/**
 * Parse the `relations:` frontmatter into a flat list of relation references.
 *
 * Expected shape: a map of relationName -> (string | string[]) of target references.
 * Malformed shapes are tolerated: non-map values yield no relations; string values are
 * treated as a single target.
 */
export function parseRelations(value: unknown): RelationRef[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  const out: RelationRef[] = [];
  for (const [name, rawTargets] of Object.entries(value as Record<string, unknown>)) {
    const targets = Array.isArray(rawTargets) ? rawTargets : [rawTargets];
    for (const raw of targets) {
      if (raw === null || raw === undefined) {
        continue;
      }
      const rawTarget = String(raw);
      out.push({ name, rawTarget, targetId: normalizeRef(rawTarget) });
    }
  }
  return out;
}

/**
 * Derive the kebab-case type token from a filename base (`<name>.<token>`), or undefined
 * when there is no `.token` segment.
 */
export function fileTokenFromName(fileName: string): string | undefined {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) {
    return undefined;
  }
  return fileName.slice(dot + 1);
}

/** Strip a trailing `.md` (case-insensitive) from a path. */
function stripMd(p: string): string {
  return p.toLowerCase().endsWith(".md") ? p.slice(0, -3) : p;
}

/** The base filename (no directory, no `.md`). */
function baseName(relPath: string): string {
  const slash = relPath.lastIndexOf("/");
  const withExt = slash === -1 ? relPath : relPath.slice(slash + 1);
  return stripMd(withExt);
}

/** The directory portion of a bundle-relative path ("" for the root). */
function dirOf(relPath: string): string {
  const slash = relPath.lastIndexOf("/");
  return slash === -1 ? "" : relPath.slice(0, slash);
}

/**
 * Parse a reserved file (`index.md` or `log.md`).
 *
 * Frontmatter is parsed but only meaningful for the root `index.md` (which may carry
 * `okf_version`); it is preserved either way.
 */
export function parseReserved(raw: string, filePath: string, relPath: string): ReservedFile {
  const basename = relPath.slice(relPath.lastIndexOf("/") + 1).toLowerCase();
  const kind: ReservedFile["kind"] = basename === "log.md" ? "log" : "index";
  const parsed = safeMatter(raw);
  return {
    kind,
    filePath,
    relPath,
    dir: dirOf(relPath),
    frontmatter: parsed.data,
    body: parsed.content,
  };
}

/**
 * Parse a non-reserved markdown file into a {@link Concept}.
 *
 * @param raw Raw UTF-8 file content.
 * @param filePath Absolute path on disk.
 * @param relPath Bundle-relative path including `.md`.
 */
export function parseConcept(raw: string, filePath: string, relPath: string): Concept {
  const hasFm = hasFrontmatterBlock(raw);
  const parsed = safeMatter(raw);
  const data = parsed.data;
  const body = parsed.content;
  const fileName = baseName(relPath);

  return {
    id: stripMd(relPath),
    filePath,
    relPath,
    fileName,
    fileToken: fileTokenFromName(fileName),
    frontmatter: data,
    type: optionalString(data.type),
    title: optionalString(data.title),
    description: optionalString(data.description),
    tags: normalizeTags(data.tags),
    body,
    sections: extractSections(body),
    relations: parseRelations(data.relations),
    // A block that existed but failed to parse is NOT valid OKF frontmatter.
    hasFrontmatter: hasFm && parsed.error === undefined,
    frontmatterError: parsed.error,
  };
}
