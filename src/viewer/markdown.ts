/**
 * A deliberately small markdown renderer for concept bodies.
 *
 * Escape-first: every input character is HTML-escaped before any rule runs, so the only
 * markup in the output is markup this module emitted. Injection is structurally impossible
 * rather than filtered, which is why this can be ~150 lines instead of a dependency.
 *
 * Scope is what OKF concept bodies actually contain: headings, fenced code, lists, tables,
 * blockquotes, rules, and inline emphasis/code/links. Anything else falls through as text.
 * Widen the rules here rather than reaching for a markdown library, which would multiply the
 * size of every generated visualization.
 */

/** Resolve a markdown link target to an in-app concept ID, or null for an external link. */
export type LinkResolver = (href: string) => string | null;

/** Render a markdown body to HTML. */
export function renderMarkdown(source: string, resolveLink: LinkResolver): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index++;
      continue;
    }

    const fence = /^\s*(```|~~~)(.*)$/.exec(line);
    if (fence) {
      const closer = fence[1];
      const body: string[] = [];
      index++;
      while (index < lines.length && !lines[index].trim().startsWith(closer)) {
        body.push(lines[index]);
        index++;
      }
      index++; // consume the closing fence
      out.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      // Concept bodies use H1 for their top-level sections, which would compete with the
      // inspector's own heading, so every level is demoted two steps.
      const level = Math.min(heading[1].length + 2, 6);
      out.push(`<h${level}>${inline(heading[2], resolveLink)}</h${level}>`);
      index++;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push("<hr>");
      index++;
      continue;
    }

    if (isTableRow(line) && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const rows: string[] = [];
      const header = splitRow(line);
      index += 2;
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(lines[index]);
        index++;
      }
      out.push(renderTable(header, rows, resolveLink));
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ""));
        index++;
      }
      out.push(`<blockquote>${renderMarkdown(quoted.join("\n"), resolveLink)}</blockquote>`);
      continue;
    }

    const bullet = /^(\s*)([-*+]|\d+\.)\s+/.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[2]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[index]);
        if (!item) {
          break;
        }
        items.push(`<li>${inline(item[3], resolveLink)}</li>`);
        index++;
        // Fold plain continuation lines into the item they belong to.
        while (
          index < lines.length &&
          /^\s{2,}\S/.test(lines[index]) &&
          !/^\s*[-*+]\s/.test(lines[index])
        ) {
          items[items.length - 1] = items[items.length - 1].replace(
            /<\/li>$/,
            ` ${inline(lines[index].trim(), resolveLink)}</li>`,
          );
          index++;
        }
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() !== "" && !isBlockStart(lines[index])) {
      paragraph.push(lines[index]);
      index++;
    }
    out.push(`<p>${inline(paragraph.join(" "), resolveLink)}</p>`);
  }

  return out.join("\n");
}

/** Whether a line begins a block that a paragraph must not swallow. */
function isBlockStart(line: string): boolean {
  return (
    /^\s*(```|~~~)/.test(line) ||
    /^#{1,6}\s/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*([-*+]|\d+\.)\s/.test(line) ||
    /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    isTableRow(line)
  );
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableDivider(line: string): boolean {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes("-");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(header: string[], rows: string[], resolveLink: LinkResolver): string {
  const head = header.map((cell) => `<th>${inline(cell, resolveLink)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${splitRow(row)
          .map((cell) => `<td>${inline(cell, resolveLink)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Inline rules, applied to already-escaped text.
 *
 * Code spans are extracted first and reinserted last, so emphasis and link syntax inside
 * backticks is left alone the way a reader expects.
 */
function inline(source: string, resolveLink: LinkResolver): string {
  // `<` cannot survive escapeHtml, so a `<n>` sentinel is provably absent from the escaped
  // text and needs no collision handling.
  const codeSpans: string[] = [];
  let text = escapeHtml(source).replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `<${codeSpans.length - 1}>`;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
    const conceptId = resolveLink(href);
    if (conceptId !== null) {
      return `<a href="#/${escapeAttr(conceptId)}" data-concept="${escapeAttr(conceptId)}">${label}</a>`;
    }
    // A concept body is content, and content must not be able to produce an executable
    // link. Anything outside the safe schemes renders as plain text rather than an anchor.
    if (!isSafeHref(href)) {
      return label;
    }
    return `<a href="${escapeAttr(href)}" rel="noreferrer noopener" target="_blank">${label}</a>`;
  });

  text = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, "$1<em>$2</em>");

  return text.replace(/<(\d+)>/g, (_match, i: string) => `<code>${codeSpans[Number(i)]}</code>`);
}

/**
 * Whether a link target is safe to turn into an anchor.
 *
 * Allowlist, not a blocklist: `javascript:`, `data:`, and `vbscript:` are the known-bad
 * schemes, but a blocklist loses to the next one plus whitespace and entity tricks.
 */
function isSafeHref(href: string): boolean {
  // The href has already been HTML-escaped, so compare against the escaped forms too.
  const value = href.trim().toLowerCase();
  if (/^(?:https?:|mailto:)/.test(value)) {
    return true;
  }
  // Relative and fragment links carry no scheme at all.
  return !/^[a-z0-9+.-]*(?::|&#58;|&colon;)/.test(value);
}

/** Escape the five characters that can change HTML structure. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a value for a double-quoted attribute (input is already HTML-escaped text). */
function escapeAttr(text: string): string {
  return text.replace(/"/g, "&quot;");
}
