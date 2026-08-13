import { describe, expect, it } from "vitest";
import {
  NODE_TYPES,
  RELATIONS,
  nodeTypeByName,
  nodeTypeByToken,
  relationByName,
  tokenForType,
  typeAllowed,
} from "../src/profile/index.js";

describe("profile vocabulary", () => {
  it("defines all 13 node types with unique names and tokens", () => {
    expect(NODE_TYPES).toHaveLength(13);
    const names = new Set(NODE_TYPES.map((t) => t.name));
    const tokens = new Set(NODE_TYPES.map((t) => t.token));
    expect(names.size).toBe(13);
    expect(tokens.size).toBe(13);
  });

  it("defines all 16 relations with unique names", () => {
    expect(RELATIONS).toHaveLength(16);
    expect(new Set(RELATIONS.map((r) => r.name)).size).toBe(16);
  });

  it("maps type names to tokens and back", () => {
    expect(tokenForType("UserJourney")).toBe("user-journey");
    expect(nodeTypeByToken("user-journey")?.name).toBe("UserJourney");
    expect(nodeTypeByName("Requirement")?.token).toBe("requirement");
  });

  it("declares required enum fields for the fielded types", () => {
    expect(nodeTypeByName("Requirement")?.requiredFields[0]).toMatchObject({
      key: "status",
      values: ["proposed", "accepted", "implemented", "verified"],
    });
    expect(nodeTypeByName("Integration")?.requiredFields[0].values).toContain("bidirectional");
    // Constraint.category is required but free-form (no enum values).
    const category = nodeTypeByName("Constraint")?.requiredFields[0];
    expect(category?.key).toBe("category");
    expect(category?.values).toBeUndefined();
  });

  it("resolves relation source/target eligibility, honoring the any-type sentinel", () => {
    const satisfies = relationByName("satisfies");
    expect(satisfies?.sourceTypes).toEqual(["Component", "System"]);
    expect(typeAllowed(satisfies?.sourceTypes ?? [], "Component")).toBe(true);
    expect(typeAllowed(satisfies?.sourceTypes ?? [], "Feature")).toBe(false);

    // `affects` allows any target; `refers-to` allows any source.
    expect(typeAllowed(relationByName("affects")?.targetTypes ?? [], "Term")).toBe(true);
    expect(typeAllowed(relationByName("refers-to")?.sourceTypes ?? [], "Decision")).toBe(true);
  });
});
