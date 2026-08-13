import { describe, expect, it } from "vitest";
import { extractSections, sectionHeadings } from "../src/core/sections.js";

describe("extractSections", () => {
  it("splits a body into top-level H1 sections", () => {
    const body = "# Goals\nBe fast.\n\n# Pains\nSlow tools.";
    const sections = extractSections(body);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({ heading: "Goals", content: "Be fast." });
    expect(sections[1]).toEqual({ heading: "Pains", content: "Slow tools." });
  });

  it("keeps deeper headings as section content", () => {
    const body = "# Flow\n## Step 1\nDo it.\n### Detail\nMore.";
    const sections = extractSections(body);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("Flow");
    expect(sections[0].content).toContain("## Step 1");
    expect(sections[0].content).toContain("### Detail");
  });

  it("ignores headings inside fenced code blocks", () => {
    const body = "# Interface\n```\n# not a heading\n```\nreal content";
    const sections = extractSections(body);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("Interface");
  });

  it("returns no sections for a body without H1 headings", () => {
    expect(extractSections("just prose\nand more")).toEqual([]);
  });

  it("exposes heading names as a set", () => {
    const headings = sectionHeadings("# A\nx\n# B\ny");
    expect(headings.has("A")).toBe(true);
    expect(headings.has("B")).toBe(true);
    expect(headings.size).toBe(2);
  });
});
