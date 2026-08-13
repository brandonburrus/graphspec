import { describe, expect, it } from "vitest";
import { appendLogEntry } from "../src/commands/index-cmd.js";

describe("appendLogEntry", () => {
  it("creates a fresh log when none exists", () => {
    const out = appendLogEntry("", "Created bundle.", "2026-08-13");
    expect(out).toBe("# Update Log\n\n## 2026-08-13\n* Created bundle.\n");
  });

  it("adds a new date group directly under the title, most recent first", () => {
    const existing = "# Update Log\n\n## 2026-08-01\n* Old entry.\n";
    const out = appendLogEntry(existing, "New entry.", "2026-08-13");
    const newIdx = out.indexOf("## 2026-08-13");
    const oldIdx = out.indexOf("## 2026-08-01");
    expect(newIdx).toBeGreaterThan(-1);
    expect(newIdx).toBeLessThan(oldIdx);
    expect(out).toContain("* New entry.");
    expect(out).toContain("* Old entry.");
  });

  it("appends to an existing date group at the top of that group", () => {
    const existing = "# Update Log\n\n## 2026-08-13\n* First.\n";
    const out = appendLogEntry(existing, "Second.", "2026-08-13");
    const lines = out.split("\n");
    const headingLine = lines.findIndex((l) => l === "## 2026-08-13");
    expect(lines[headingLine + 1]).toBe("* Second.");
    expect(lines[headingLine + 2]).toBe("* First.");
    // Only one date heading should exist.
    expect(out.match(/## 2026-08-13/g)).toHaveLength(1);
  });
});
