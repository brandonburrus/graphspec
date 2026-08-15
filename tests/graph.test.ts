import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBundle } from "../src/core/bundle.js";
import { CHILD_EDGE, Graph } from "../src/core/graph.js";
import { parseConcept } from "../src/core/parser.js";
import type { Bundle, Concept } from "../src/core/types.js";

/** Build a Concept from a bundle-relative path and raw markdown. */
function concept(relPath: string, raw: string): Concept {
  return parseConcept(raw, `/abs/${relPath}`, relPath);
}

/** Assemble an in-memory bundle from concepts. */
function bundleOf(concepts: Concept[]): Bundle {
  return { root: "/abs", concepts, reserved: [] };
}

describe("Graph", () => {
  it("indexes concepts as nodes keyed by id", () => {
    const g = Graph.fromBundle(
      bundleOf([
        concept("a.feature.md", "---\ntype: Feature\n---"),
        concept("b.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
      ]),
    );
    expect(g.size).toBe(2);
    expect(g.has("a.feature")).toBe(true);
    expect(g.get("b.requirement")?.type).toBe("Requirement");
  });

  it("materializes typed edges from relations and marks resolution", () => {
    const g = Graph.fromBundle(
      bundleOf([
        concept(
          "f.feature.md",
          "---\ntype: Feature\nrelations:\n  includes:\n    - /r.requirement.md\n    - /missing.requirement.md\n---",
        ),
        concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
      ]),
    );
    const includes = g.edgesFrom("f.feature", "includes");
    expect(includes).toHaveLength(2);
    const resolved = includes.find((e) => e.to === "r.requirement");
    const broken = includes.find((e) => e.to === "missing.requirement");
    expect(resolved?.resolved).toBe(true);
    expect(broken?.resolved).toBe(false);
    // Neighbors only include resolved targets.
    expect(g.neighbors("f.feature", "includes").map((c) => c.id)).toEqual(["r.requirement"]);
  });

  it("adds implicit parent/child edges from the directory hierarchy", () => {
    const g = Graph.fromBundle(
      bundleOf([
        concept("auth.system.md", "---\ntype: System\n---"),
        concept("auth/login.component.md", "---\ntype: Component\n---"),
      ]),
    );
    const children = g.edgesFrom("auth.system", CHILD_EDGE);
    expect(children).toHaveLength(1);
    expect(children[0].to).toBe("auth/login.component");
    expect(g.edgesTo("auth/login.component", CHILD_EDGE)).toHaveLength(1);
  });

  it("records incoming edges for reverse traversal", () => {
    const g = Graph.fromBundle(
      bundleOf([
        concept(
          "c.component.md",
          "---\ntype: Component\nrelations:\n  satisfies:\n    - /r.requirement.md\n---",
        ),
        concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
      ]),
    );
    const incoming = g.edgesTo("r.requirement", "satisfies");
    expect(incoming).toHaveLength(1);
    expect(incoming[0].from).toBe("c.component");
  });
});

describe("loadBundle", () => {
  it("loads the dogfood spec bundle and separates reserved files", async () => {
    const bundle = await loadBundle("spec");
    expect(bundle.concepts.length).toBeGreaterThanOrEqual(20);
    expect(bundle.reserved.some((r) => r.kind === "index" && r.dir === "")).toBe(true);
    // No reserved file is ever treated as a concept.
    expect(bundle.concepts.some((c) => c.relPath.endsWith("index.md"))).toBe(false);
  });

  it("ignores markdown files with no type token, at any depth", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-ignore-"));
    try {
      await writeFile(
        join(dir, "login.requirement.md"),
        "---\ntype: Requirement\nstatus: accepted\n---\n",
        "utf8",
      );
      // Plain docs that repos keep beside a bundle must be able to coexist with it.
      await writeFile(join(dir, "AGENTS.md"), "# Agent notes\n", "utf8");
      await writeFile(join(dir, "README.md"), "# Readme\n", "utf8");
      await mkdir(join(dir, "nested"), { recursive: true });
      await writeFile(join(dir, "nested", "AGENTS.md"), "# Nested notes\n", "utf8");

      const bundle = await loadBundle(dir);
      expect(bundle.concepts.map((c) => c.relPath)).toEqual(["login.requirement.md"]);
      expect(bundle.ignored).toEqual(["AGENTS.md", "README.md", "nested/AGENTS.md"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("still treats reserved files as reserved even though they carry no type token", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-ignore-"));
    try {
      await writeFile(join(dir, "index.md"), "# Index\n", "utf8");
      await writeFile(join(dir, "log.md"), "# Update Log\n", "utf8");
      const bundle = await loadBundle(dir);
      expect(bundle.reserved.map((r) => r.kind).sort()).toEqual(["index", "log"]);
      expect(bundle.ignored).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps a file whose token is outside the profile vocabulary", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphspec-ignore-"));
    try {
      // An unrecognized token is a profile warning, not grounds for silently dropping the
      // file — otherwise a typo'd type token would make a concept vanish without a word.
      await writeFile(join(dir, "x.widget.md"), "---\ntype: Widget\n---\n", "utf8");
      const bundle = await loadBundle(dir);
      expect(bundle.concepts.map((c) => c.relPath)).toEqual(["x.widget.md"]);
      expect(bundle.ignored).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
