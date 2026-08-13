/**
 * `graphspec index [path]` — (re)generate OKF `index.md` files and append `log.md` entries.
 *
 * Index generation: for every directory that directly contains concept documents, an
 * `index.md` is generated listing those concepts as section-grouped links (grouped by node
 * type) using each concept's title + description, plus a Subdirectories section linking to
 * nested indexes. The bundle-root `index.md` preserves any existing frontmatter (notably
 * `okf_version`).
 *
 * Log entries: `--log "<msg>"` prepends a dated bullet to the bundle-root `log.md`.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../core/bundle.js";
import type { Bundle, Concept } from "../core/types.js";
import { NODE_TYPES, nodeTypeByName } from "../profile/node-types.js";
import type { Writer } from "./io.js";

/** Options accepted by the index command. */
export interface IndexCommandOptions {
  /** When set, append this message as a dated entry to the root `log.md`. */
  log?: string;
  /** When true, don't regenerate index files (only useful with `--log`). */
  noIndex?: boolean;
  /** When true, compute output but do not write files. */
  dryRun?: boolean;
}

/** A generated file: bundle-relative path plus content to write. */
export interface GeneratedFile {
  readonly relPath: string;
  readonly content: string;
}

/** Insert spaces before internal capitals: "UserPersona" -> "User Persona". */
function humanizeType(typeName: string): string {
  const spaced = typeName.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The directory portion of a bundle-relative path ("" for the root). */
function dirOf(relPath: string): string {
  const slash = relPath.lastIndexOf("/");
  return slash === -1 ? "" : relPath.slice(0, slash);
}

/** The base filename of a bundle-relative path. */
function baseOf(relPath: string): string {
  return relPath.slice(relPath.lastIndexOf("/") + 1);
}

/** Ordering index for a type name: profile order first, unknown types last (alpha). */
function typeOrder(typeName: string | undefined): number {
  if (!typeName) {
    return NODE_TYPES.length + 1;
  }
  const idx = NODE_TYPES.findIndex((t) => t.name === typeName);
  return idx === -1 ? NODE_TYPES.length : idx;
}

/** Collect immediate child directory names for a given directory. */
function childDirs(bundle: Bundle, dir: string): string[] {
  const prefix = dir === "" ? "" : `${dir}/`;
  const names = new Set<string>();
  const consider = (relPath: string) => {
    if (!relPath.startsWith(prefix)) {
      return;
    }
    const rest = relPath.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash !== -1) {
      names.add(rest.slice(0, slash));
    }
  };
  for (const c of bundle.concepts) {
    consider(c.relPath);
  }
  for (const r of bundle.reserved) {
    consider(r.relPath);
  }
  return [...names].sort();
}

/** Build the markdown body for one directory's index. */
function buildIndexBody(concepts: Concept[], subdirs: string[]): string {
  const sections: string[] = [];

  // Group concepts by type, ordered by the profile.
  const byType = new Map<string, Concept[]>();
  for (const c of concepts) {
    const key = c.type ?? "Untyped";
    const list = byType.get(key) ?? [];
    list.push(c);
    byType.set(key, list);
  }
  const typeKeys = [...byType.keys()].sort((a, b) => {
    const oa = typeOrder(nodeTypeByName(a)?.name ?? (nodeTypeByName(a) ? a : undefined));
    const ob = typeOrder(nodeTypeByName(b)?.name ?? (nodeTypeByName(b) ? b : undefined));
    if (oa !== ob) {
      return oa - ob;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });

  for (const key of typeKeys) {
    const items = (byType.get(key) as Concept[])
      .slice()
      .sort((a, b) => (a.relPath < b.relPath ? -1 : 1));
    const heading = nodeTypeByName(key) ? `${humanizeType(key)}s` : key;
    const lines = [`# ${heading}`];
    for (const c of items) {
      const link = baseOf(c.relPath);
      const title = c.title ?? c.fileName;
      const desc = c.description ? ` - ${c.description}` : "";
      lines.push(`* [${title}](${link})${desc}`);
    }
    sections.push(lines.join("\n"));
  }

  if (subdirs.length > 0) {
    const lines = ["# Subdirectories"];
    for (const sub of subdirs) {
      lines.push(`* [${sub}](${sub}/index.md)`);
    }
    sections.push(lines.join("\n"));
  }

  return `${sections.join("\n\n")}\n`;
}

/** Extract an existing root index.md frontmatter block to preserve (e.g. okf_version). */
function existingRootFrontmatter(bundle: Bundle): string | undefined {
  const rootIndex = bundle.reserved.find((r) => r.kind === "index" && r.dir === "");
  if (!rootIndex) {
    return undefined;
  }
  const keys = Object.keys(rootIndex.frontmatter);
  if (keys.length === 0) {
    return undefined;
  }
  const lines = keys.map((k) => `${k}: ${formatYamlScalar(rootIndex.frontmatter[k])}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

/** Format a scalar for simple YAML frontmatter emission. */
function formatYamlScalar(value: unknown): string {
  if (typeof value === "string") {
    // Quote strings that YAML would otherwise coerce to a number, boolean, or null, or
    // that contain structural characters.
    const needsQuote =
      value === "" ||
      /[:#]/.test(value) ||
      /^(true|false|null|~)$/i.test(value) ||
      /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(value);
    return needsQuote ? JSON.stringify(value) : value;
  }
  return String(value);
}

/** All directories in the bundle, including intermediate ancestors and the root (""). */
function allDirs(bundle: Bundle): string[] {
  const dirs = new Set<string>([""]);
  const addAncestors = (relPath: string) => {
    const dir = dirOf(relPath);
    const parts = dir === "" ? [] : dir.split("/");
    let acc = "";
    for (const part of parts) {
      acc = acc === "" ? part : `${acc}/${part}`;
      dirs.add(acc);
    }
  };
  for (const c of bundle.concepts) {
    addAncestors(c.relPath);
  }
  for (const r of bundle.reserved) {
    addAncestors(r.relPath);
  }
  return [...dirs].sort();
}

/**
 * Build the set of `index.md` files for a bundle without writing them.
 *
 * Generates one {@link GeneratedFile} per directory that directly contains concepts or has
 * subdirectories (so container directories like the bundle root get an index too). The
 * bundle-root index preserves any existing frontmatter (notably `okf_version`).
 */
export function buildIndexes(bundle: Bundle): GeneratedFile[] {
  const byDir = new Map<string, Concept[]>();
  for (const c of bundle.concepts) {
    const dir = dirOf(c.relPath);
    const list = byDir.get(dir) ?? [];
    list.push(c);
    byDir.set(dir, list);
  }

  const rootFrontmatter = existingRootFrontmatter(bundle);
  const files: GeneratedFile[] = [];
  for (const dir of allDirs(bundle)) {
    const concepts = byDir.get(dir) ?? [];
    const subdirs = childDirs(bundle, dir);
    // Skip empty directories that neither hold concepts nor group subdirectories.
    if (concepts.length === 0 && subdirs.length === 0) {
      continue;
    }
    const body = buildIndexBody(concepts, subdirs);
    const prefix = dir === "" ? (rootFrontmatter ?? "") : "";
    const relPath = dir === "" ? "index.md" : `${dir}/index.md`;
    files.push({ relPath, content: prefix + body });
  }
  return files;
}

/** Today's date as ISO `YYYY-MM-DD` in UTC. */
export function isoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Produce updated `log.md` content by prepending a dated bullet for `message`.
 *
 * If a `## <date>` group for today exists, the bullet is added at the top of that group;
 * otherwise a new date group is inserted directly under the `# Update Log` title (most
 * recent first). When `existing` is empty, a fresh log is created.
 */
export function appendLogEntry(existing: string, message: string, date = isoDate()): string {
  const bullet = `* ${message}`;
  const dateHeading = `## ${date}`;

  if (existing.trim() === "") {
    return `# Update Log\n\n${dateHeading}\n${bullet}\n`;
  }

  const lines = existing.replace(/\r\n/g, "\n").split("\n");
  const dateIdx = lines.findIndex((l) => l.trim() === dateHeading);
  if (dateIdx !== -1) {
    lines.splice(dateIdx + 1, 0, bullet);
    return `${lines.join("\n").replace(/\n+$/, "")}\n`;
  }

  const titleIdx = lines.findIndex((l) => /^#\s+/.test(l.trim()));
  const insertAt = titleIdx === -1 ? 0 : titleIdx + 1;
  const block = ["", dateHeading, bullet];
  lines.splice(insertAt, 0, ...block);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

/**
 * Run the index command against `path`.
 *
 * @returns process exit code: 0 on success, 2 on I/O failure.
 */
export async function runIndex(
  path: string,
  options: IndexCommandOptions,
  writer: Writer,
): Promise<number> {
  let bundle: Bundle;
  try {
    bundle = await loadBundle(path);
  } catch (err) {
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  if (!options.noIndex) {
    const files = buildIndexes(bundle);
    for (const file of files) {
      const absPath = join(path, file.relPath);
      if (!options.dryRun) {
        await writeFile(absPath, file.content, "utf8");
      }
      writer.out(`${options.dryRun ? "would write" : "wrote"} ${file.relPath}`);
    }
  }

  if (options.log !== undefined) {
    const logPath = join(path, "log.md");
    let existing = "";
    try {
      existing = await readFile(logPath, "utf8");
    } catch {
      existing = "";
    }
    const updated = appendLogEntry(existing, options.log);
    if (!options.dryRun) {
      await writeFile(logPath, updated, "utf8");
    }
    writer.out(`${options.dryRun ? "would append" : "appended"} log.md entry`);
  }

  return 0;
}
