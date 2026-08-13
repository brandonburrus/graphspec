import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildIndexes, isoDate, runIndex } from "../src/commands/index-cmd.js";
import { BufferWriter } from "../src/commands/io.js";
import { runQuery } from "../src/commands/query.js";
import { runValidate } from "../src/commands/validate.js";
import { loadBundle } from "../src/core/bundle.js";

describe("validate command", () => {
  it("reports a clean bundle and exits 0", async () => {
    const w = new BufferWriter();
    const code = await runValidate("spec", {}, w);
    expect(code).toBe(0);
    expect(w.outText).toContain("0 error(s)");
  });

  it("emits JSON with counts and diagnostics", async () => {
    const w = new BufferWriter();
    const code = await runValidate("spec", { json: true }, w);
    expect(code).toBe(0);
    const parsed = JSON.parse(w.outText);
    expect(parsed.errorCount).toBe(0);
    expect(parsed.conceptCount).toBeGreaterThan(0);
    expect(Array.isArray(parsed.diagnostics)).toBe(true);
  });

  it("returns exit 2 for a missing path", async () => {
    const w = new BufferWriter();
    const code = await runValidate("does/not/exist", {}, w);
    expect(code).toBe(2);
    expect(w.errText).toContain("error:");
  });
});

describe("query command", () => {
  it("filters by type and prints a table", async () => {
    const w = new BufferWriter();
    const code = await runQuery("spec", { type: "Requirement" }, w);
    expect(code).toBe(0);
    expect(w.outText).toContain("Requirement");
    expect(w.outText).toContain("concept(s).");
    // Should not include a Feature row.
    expect(w.outText).not.toContain("Feature");
  });

  it("supports JSON output", async () => {
    const w = new BufferWriter();
    await runQuery("spec", { type: "Term", json: true }, w);
    const parsed = JSON.parse(w.outText);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.every((c: { type: string }) => c.type === "Term")).toBe(true);
  });

  it("reports no matches gracefully", async () => {
    const w = new BufferWriter();
    const code = await runQuery("spec", { tag: "no-such-tag" }, w);
    expect(code).toBe(0);
    expect(w.outText).toContain("No matching concepts.");
  });
});

describe("index command", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "graphspec-index-"));
    await writeFile(
      join(dir, "login.requirement.md"),
      "---\ntype: Requirement\ntitle: Login\ndescription: Users can log in.\nstatus: accepted\n---\n# Acceptance Criteria\n",
      "utf8",
    );
    await writeFile(
      join(dir, "signup.requirement.md"),
      "---\ntype: Requirement\ntitle: Signup\nstatus: proposed\n---\n",
      "utf8",
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("generates a grouped index.md with title + description links", async () => {
    const w = new BufferWriter();
    const code = await runIndex(dir, {}, w);
    expect(code).toBe(0);
    const index = await readFile(join(dir, "index.md"), "utf8");
    expect(index).toContain("# Requirements");
    expect(index).toContain("[Login](login.requirement.md) - Users can log in.");
    // A concept without a description omits the trailing " - ".
    expect(index).toContain("[Signup](signup.requirement.md)");
    expect(index).not.toContain("[Signup](signup.requirement.md) -");
  });

  it("builds indexes deterministically (pure function)", async () => {
    const bundle = await loadBundle(dir);
    const files = buildIndexes(bundle);
    expect(files).toHaveLength(1);
    expect(files[0].relPath).toBe("index.md");
    expect(files[0].content).toContain("# Requirements");
  });

  it("appends a dated log entry, creating log.md if absent", async () => {
    const w = new BufferWriter();
    await runIndex(dir, { noIndex: true, log: "First entry." }, w);
    const log = await readFile(join(dir, "log.md"), "utf8");
    expect(log).toContain("# Update Log");
    expect(log).toContain(`## ${isoDate()}`);
    expect(log).toContain("* First entry.");
  });

  it("does not write files in dry-run mode", async () => {
    const w = new BufferWriter();
    await runIndex(dir, { dryRun: true }, w);
    await expect(readFile(join(dir, "index.md"), "utf8")).rejects.toThrow();
    expect(w.outText).toContain("would write");
  });
});
