import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/viewer/markdown.js";

/**
 * The inspector's markdown renderer. It runs in the browser, but it is pure string work, so
 * it is unit-tested here rather than through Playwright.
 */

/** Treat everything as an external link unless the test says otherwise. */
const noLinks = () => null;

describe("renderMarkdown", () => {
  it("renders the block constructs concept bodies actually use", () => {
    const html = renderMarkdown(
      [
        "# Responsibility",
        "",
        "Parses **one** file into a `Concept`.",
        "",
        "- first",
        "- second",
        "",
        "> a note",
        "",
        "```ts",
        "const x = 1;",
        "```",
      ].join("\n"),
      noLinks,
    );

    // H1 is demoted: the inspector already owns the H2 for the concept title.
    expect(html).toContain("<h3>Responsibility</h3>");
    expect(html).toContain("<strong>one</strong>");
    expect(html).toContain("<code>Concept</code>");
    expect(html).toContain("<li>first</li>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<pre><code>const x = 1;</code></pre>");
  });

  it("renders pipe tables", () => {
    const html = renderMarkdown(
      ["| Field | Type |", "|-------|------|", "| id | string |"].join("\n"),
      noLinks,
    );

    expect(html).toContain("<th>Field</th>");
    expect(html).toContain("<td>string</td>");
  });

  it("escapes HTML in the source rather than passing it through", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"> & <b>bold</b>', noLinks);

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&amp;");
  });

  it("cannot be escaped through a code span", () => {
    const html = renderMarkdown("`</code><script>bad()</script>`", noLinks);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("refuses to build an anchor for an executable URL scheme", () => {
    const html = renderMarkdown(
      "[a](javascript:alert(1)) [b](JaVaScRiPt:alert(1)) [c](data:text/html,x) [d](/ok.md)",
      noLinks,
    );

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
    // The label survives as plain text; only the link is withheld.
    expect(html).toContain("a");
    // A relative target is still a normal link.
    expect(html).toContain('href="/ok.md"');
  });

  it("turns an in-bundle reference into in-app navigation and leaves other links alone", () => {
    const resolve = (href: string) =>
      href === "/architecture/parser.component.md" ? "architecture/parser.component" : null;
    const html = renderMarkdown(
      "See [the parser](/architecture/parser.component.md) and [OKF](https://okf.md/spec).",
      resolve,
    );

    expect(html).toContain('data-concept="architecture/parser.component"');
    expect(html).toContain('href="#/architecture/parser.component"');
    expect(html).toContain('href="https://okf.md/spec"');
    expect(html).toContain('target="_blank"');
  });

  it("leaves emphasis syntax inside a code span untouched", () => {
    const html = renderMarkdown("`a * b * c` and *real emphasis*", noLinks);

    expect(html).toContain("<code>a * b * c</code>");
    expect(html).toContain("<em>real emphasis</em>");
  });

  it("returns nothing for an empty body", () => {
    expect(renderMarkdown("", noLinks)).toBe("");
    expect(renderMarkdown("\n\n  \n", noLinks)).toBe("");
  });
});
