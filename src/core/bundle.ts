/**
 * Bundle loader: walk a directory tree and parse it into an OKF {@link Bundle}.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { isReservedFilename, parseConcept, parseReserved } from "./parser.js";
import type { Bundle, Concept, ReservedFile } from "./types.js";

/** Directory names skipped while walking a bundle. */
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", ".vscode"]);

/** Convert an OS path to bundle-relative POSIX form (forward slashes). */
function toPosixRel(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join("/");
}

/** Recursively collect all `.md` file paths under a directory. */
async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      files.push(...(await collectMarkdownFiles(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Load and parse an OKF bundle rooted at `root`.
 *
 * `root` may point at a directory or a single `.md` file; a file is treated as a
 * single-concept bundle rooted at its parent directory... but the common case is a
 * directory. Reserved files (`index.md`/`log.md`) are separated from concept documents.
 *
 * @throws if `root` does not exist.
 */
export async function loadBundle(root: string): Promise<Bundle> {
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Bundle path is not a directory: ${root}`);
  }

  const filePaths = (await collectMarkdownFiles(root)).sort();
  const concepts: Concept[] = [];
  const reserved: ReservedFile[] = [];

  for (const filePath of filePaths) {
    const relPath = toPosixRel(root, filePath);
    const basename = relPath.slice(relPath.lastIndexOf("/") + 1);
    const raw = await readFile(filePath, "utf8");
    if (isReservedFilename(basename)) {
      reserved.push(parseReserved(raw, filePath, relPath));
    } else {
      concepts.push(parseConcept(raw, filePath, relPath));
    }
  }

  return { root, concepts, reserved };
}
