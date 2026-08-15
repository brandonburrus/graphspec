/**
 * The package version, read from `package.json` at runtime.
 *
 * Hardcoding it here would silently drift: `npm version` bumps `package.json` and tags the
 * release, but a literal in the source keeps reporting the old number, so `--version` lies
 * about which build is installed. Reading the manifest keeps the two in lockstep by
 * construction.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Location of the manifest, relative to this module rather than the working directory. */
const MANIFEST_URL = new URL("../package.json", import.meta.url);

/**
 * Read the version from the package manifest.
 *
 * Resolving against this module's own URL keeps it correct both from `dist/` in an installed
 * package and from `src/` under the test runner.
 *
 * @param manifestUrl Override for the manifest location; only the tests pass this.
 */
export function packageVersion(manifestUrl: URL = MANIFEST_URL): string {
  const manifestPath = fileURLToPath(manifestUrl);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string };
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error(`package.json at ${manifestPath} has no version field`);
  }
  return manifest.version;
}
