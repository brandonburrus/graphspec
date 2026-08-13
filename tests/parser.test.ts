import { describe, expect, it } from "vitest";
import {
  fileTokenFromName,
  isReservedFilename,
  parseConcept,
  parseRelations,
} from "../src/core/parser.js";

describe("parseConcept", () => {
  it("parses frontmatter, body, id, and file token", () => {
    const raw = [
      "---",
      "type: Requirement",
      "title: Login",
      "description: Users can log in.",
      "status: accepted",
      "tags: [auth, security]",
      "---",
      "# Acceptance Criteria",
      "- It works.",
    ].join("\n");
    const c = parseConcept(raw, "/abs/auth/login.requirement.md", "auth/login.requirement.md");
    expect(c.id).toBe("auth/login.requirement");
    expect(c.type).toBe("Requirement");
    expect(c.title).toBe("Login");
    expect(c.description).toBe("Users can log in.");
    expect(c.fileToken).toBe("requirement");
    expect(c.tags).toEqual(["auth", "security"]);
    expect(c.hasFrontmatter).toBe(true);
    expect(c.sections[0]?.heading).toBe("Acceptance Criteria");
  });

  it("preserves unknown frontmatter keys", () => {
    const raw = ["---", "type: Feature", "owner: platform-team", "priority: 3", "---", "body"].join(
      "\n",
    );
    const c = parseConcept(raw, "/abs/x.feature.md", "x.feature.md");
    expect(c.frontmatter.owner).toBe("platform-team");
    expect(c.frontmatter.priority).toBe(3);
  });

  it("flags a missing frontmatter block", () => {
    const c = parseConcept("no frontmatter here", "/abs/x.term.md", "x.term.md");
    expect(c.hasFrontmatter).toBe(false);
    expect(c.type).toBeUndefined();
  });

  it("captures a YAML parse error instead of throwing", () => {
    const raw = ["---", "type: Contract", "description: bad: value: here", "---", "body"].join(
      "\n",
    );
    const c = parseConcept(raw, "/abs/x.contract.md", "x.contract.md");
    expect(c.frontmatterError).toBeTypeOf("string");
    expect(c.hasFrontmatter).toBe(false);
  });

  it("parses relations into normalized targets", () => {
    const raw = [
      "---",
      "type: Feature",
      "relations:",
      "  includes:",
      "    - /spec/a.requirement.md",
      "    - /spec/b.requirement",
      "---",
    ].join("\n");
    const c = parseConcept(raw, "/abs/f.feature.md", "f.feature.md");
    expect(c.relations).toHaveLength(2);
    expect(c.relations[0]).toMatchObject({ name: "includes", targetId: "spec/a.requirement" });
    expect(c.relations[1].targetId).toBe("spec/b.requirement");
  });
});

describe("parseRelations", () => {
  it("treats a single string target as a one-element list", () => {
    const rels = parseRelations({ contains: "/a/b.component.md" });
    expect(rels).toHaveLength(1);
    expect(rels[0].targetId).toBe("a/b.component");
  });

  it("returns nothing for non-map inputs", () => {
    expect(parseRelations(null)).toEqual([]);
    expect(parseRelations("nope")).toEqual([]);
    expect(parseRelations(["a", "b"])).toEqual([]);
  });
});

describe("fileTokenFromName", () => {
  it("returns the token after the last dot", () => {
    expect(fileTokenFromName("login.requirement")).toBe("requirement");
    expect(fileTokenFromName("checkout.user-journey")).toBe("user-journey");
  });

  it("returns undefined when there is no token segment", () => {
    expect(fileTokenFromName("readme")).toBeUndefined();
  });
});

describe("isReservedFilename", () => {
  it("recognizes index.md and log.md case-insensitively", () => {
    expect(isReservedFilename("index.md")).toBe(true);
    expect(isReservedFilename("LOG.md")).toBe(true);
    expect(isReservedFilename("thing.feature.md")).toBe(false);
  });
});
