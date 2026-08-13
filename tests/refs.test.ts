import { describe, expect, it } from "vitest";
import { normalizeRef } from "../src/core/refs.js";

describe("normalizeRef", () => {
  it("strips a leading slash and the .md suffix", () => {
    expect(normalizeRef("/product/agent.user-persona.md")).toBe("product/agent.user-persona");
  });

  it("accepts references without a leading slash or extension", () => {
    expect(normalizeRef("product/agent.user-persona")).toBe("product/agent.user-persona");
  });

  it("drops a trailing anchor/fragment", () => {
    expect(normalizeRef("/a/b.requirement.md#acceptance-criteria")).toBe("a/b.requirement");
  });

  it("resolves . and .. segments", () => {
    expect(normalizeRef("/a/b/../c.feature.md")).toBe("a/c.feature");
    expect(normalizeRef("/a/./b.feature")).toBe("a/b.feature");
  });

  it("collapses redundant slashes and trims whitespace", () => {
    expect(normalizeRef("  /a//b.feature.md  ")).toBe("a/b.feature");
  });

  it("is case-insensitive about the .md suffix", () => {
    expect(normalizeRef("/a/b.feature.MD")).toBe("a/b.feature");
  });
});
