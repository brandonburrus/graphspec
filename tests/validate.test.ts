import { describe, expect, it } from "vitest";
import { loadBundle } from "../src/core/bundle.js";
import { parseConcept } from "../src/core/parser.js";
import type { Bundle, Concept } from "../src/core/types.js";
import { validateBundle } from "../src/validate/index.js";

function concept(relPath: string, raw: string): Concept {
  return parseConcept(raw, `/abs/${relPath}`, relPath);
}

function bundleOf(concepts: Concept[]): Bundle {
  return { root: "/abs", concepts, reserved: [] };
}

/** Collect the rule codes present in a validation result. */
function rules(bundle: Bundle, strict = false): string[] {
  return validateBundle(bundle, { strict }).diagnostics.map((d) => d.rule);
}

describe("OKF conformance (hard errors)", () => {
  it("passes the golden dogfood bundle with zero errors and warnings", async () => {
    const bundle = await loadBundle("spec");
    const result = validateBundle(bundle);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it("errors when a concept has no frontmatter block", () => {
    const r = validateBundle(bundleOf([concept("x.term.md", "no frontmatter")]));
    expect(r.errorCount).toBe(1);
    expect(r.diagnostics[0].rule).toBe("okf/missing-frontmatter");
  });

  it("errors when frontmatter has no non-empty type", () => {
    const r = validateBundle(bundleOf([concept("x.term.md", "---\ntitle: No Type\n---")]));
    expect(r.diagnostics.some((d) => d.rule === "okf/missing-type")).toBe(true);
    expect(r.errorCount).toBe(1);
  });

  it("errors when frontmatter is not parseable YAML", () => {
    const r = validateBundle(bundleOf([concept("x.term.md", "---\na: b: c: d\n---\nbody")]));
    expect(r.diagnostics[0].rule).toBe("okf/unparseable-frontmatter");
    expect(r.errorCount).toBe(1);
  });

  it("does not hard-fail on unknown types or broken links", () => {
    const r = validateBundle(
      bundleOf([
        concept(
          "x.term.md",
          "---\ntype: SomethingExotic\nrelations:\n  refers-to:\n    - /nope.term.md\n---",
        ),
      ]),
    );
    expect(r.errorCount).toBe(0);
  });
});

describe("graphspec profile checks (soft warnings)", () => {
  it("warns on a filename token that disagrees with the type", () => {
    // File token says feature, frontmatter says Requirement.
    const r = validateBundle(
      bundleOf([concept("x.feature.md", "---\ntype: Requirement\nstatus: accepted\n---")]),
    );
    expect(r.diagnostics.some((d) => d.rule === "profile/filename-token-mismatch")).toBe(true);
    expect(r.errorCount).toBe(0);
    expect(r.warningCount).toBeGreaterThanOrEqual(1);
  });

  it("warns when a filename has no type token", () => {
    const r = validateBundle(bundleOf([concept("plain.md", "---\ntype: Feature\n---")]));
    expect(r.diagnostics.some((d) => d.rule === "profile/missing-filename-token")).toBe(true);
  });

  it("warns on a type outside the profile vocabulary", () => {
    const r = validateBundle(bundleOf([concept("x.md", "---\ntype: Widget\n---")]));
    expect(r.diagnostics.some((d) => d.rule === "profile/unknown-type")).toBe(true);
  });

  it("warns on a missing required field", () => {
    const r = validateBundle(
      bundleOf([concept("x.requirement.md", "---\ntype: Requirement\n---")]),
    );
    expect(r.diagnostics.some((d) => d.rule === "profile/missing-required-field")).toBe(true);
  });

  it("warns on an out-of-enum required field value", () => {
    const r = validateBundle(
      bundleOf([concept("x.requirement.md", "---\ntype: Requirement\nstatus: bogus\n---")]),
    );
    expect(r.diagnostics.some((d) => d.rule === "profile/invalid-field-value")).toBe(true);
  });

  it("accepts a free-form required field (Constraint.category)", () => {
    const r = validateBundle(
      bundleOf([
        concept(
          "x.constraint.md",
          "---\ntype: Constraint\ncategory: performance\nrelations:\n  constrains:\n    - /r.requirement.md\n---",
        ),
        concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
      ]),
    );
    expect(r.warningCount).toBe(0);
    expect(r.errorCount).toBe(0);
  });

  it("warns on an unknown relation name", () => {
    const r = validateBundle(
      bundleOf([
        concept(
          "f.feature.md",
          "---\ntype: Feature\nrelations:\n  frobnicates:\n    - /r.requirement.md\n---",
        ),
        concept("r.requirement.md", "---\ntype: Requirement\nstatus: accepted\n---"),
      ]),
    );
    expect(r.diagnostics.some((d) => d.rule === "profile/unknown-relation")).toBe(true);
  });

  it("warns when the source type may not originate the relation", () => {
    // `contains` requires a System source; a Component is not allowed.
    const r = validateBundle(
      bundleOf([
        concept(
          "c.component.md",
          "---\ntype: Component\nrelations:\n  contains:\n    - /d.component.md\n---",
        ),
        concept("d.component.md", "---\ntype: Component\n---"),
      ]),
    );
    expect(r.diagnostics.some((d) => d.rule === "profile/invalid-relation-source")).toBe(true);
  });

  it("warns when a resolved target has a disallowed type", () => {
    // `includes` must target a Requirement; a Term is not allowed.
    const r = validateBundle(
      bundleOf([
        concept(
          "f.feature.md",
          "---\ntype: Feature\nrelations:\n  includes:\n    - /t.term.md\n---",
        ),
        concept("t.term.md", "---\ntype: Term\n---"),
      ]),
    );
    expect(r.diagnostics.some((d) => d.rule === "profile/invalid-relation-target")).toBe(true);
  });

  it("warns (not errors) on an unresolved relation target, even under --strict", () => {
    const b = bundleOf([
      concept(
        "f.feature.md",
        "---\ntype: Feature\nrelations:\n  includes:\n    - /missing.requirement.md\n---",
      ),
    ]);
    const loose = validateBundle(b);
    expect(loose.diagnostics.some((d) => d.rule === "profile/unresolved-target")).toBe(true);

    const strict = validateBundle(b, { strict: true });
    const unresolved = strict.diagnostics.find((d) => d.rule === "profile/unresolved-target");
    expect(unresolved?.severity).toBe("warning");
  });
});

describe("--strict promotion", () => {
  it("promotes profile warnings to errors (except unresolved targets)", () => {
    const b = bundleOf([concept("x.feature.md", "---\ntype: Requirement\nstatus: accepted\n---")]);
    expect(validateBundle(b, { strict: false }).errorCount).toBe(0);
    const strict = validateBundle(b, { strict: true });
    expect(strict.errorCount).toBeGreaterThanOrEqual(1);
    expect(strict.diagnostics.every((d) => d.severity === "error")).toBe(true);
  });
});

describe("diagnostic ordering", () => {
  it("orders diagnostics by file, then errors before warnings", () => {
    const codes = rules(
      bundleOf([
        concept("b.requirement.md", "---\ntype: Requirement\n---"),
        concept("a.md", "no frontmatter"),
      ]),
    );
    // a.md sorts before b.requirement.md.
    expect(codes[0]).toBe("okf/missing-frontmatter");
  });
});
