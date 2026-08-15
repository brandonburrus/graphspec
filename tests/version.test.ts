import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { buildProgram } from "../src/program.js";
import { packageVersion } from "../src/version.js";

/** The manifest version, read independently of the code under test. */
function manifestVersion(): string {
  return JSON.parse(readFileSync("package.json", "utf8")).version;
}

describe("package version", () => {
  it("reports the version from package.json", () => {
    expect(packageVersion()).toBe(manifestVersion());
  });

  // The regression that matters: the version used to be a literal in cli.ts, so bumping for a
  // release left `--version` reporting the previous number.
  it("wires that version into the CLI rather than a hardcoded literal", () => {
    expect(buildProgram().version()).toBe(manifestVersion());
  });

  // `npx <package>` runs the bin whose name matches the package name. The package is
  // `graph-spec-cli` while the command is `graphspec`, so without a second bin entry every
  // documented `npx graph-spec-cli ...` invocation dies with "command not found".
  it("exposes a bin named after the package so npx resolves it", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    expect(Object.keys(manifest.bin)).toContain(manifest.name);
    expect(Object.keys(manifest.bin)).toContain("graphspec");
  });

  it("throws a located error when the manifest has no version", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-version-"));
    try {
      const manifest = join(dir, "package.json");
      await writeFile(manifest, JSON.stringify({ name: "no-version" }), "utf8");
      expect(() => packageVersion(pathToFileURL(manifest))).toThrow(/has no version field/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when the manifest is missing entirely", () => {
    const missing = pathToFileURL(join(tmpdir(), "graphspec-does-not-exist", "package.json"));
    expect(() => packageVersion(missing)).toThrow();
  });
});
