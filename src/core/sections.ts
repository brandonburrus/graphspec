/**
 * Markdown body section extraction.
 *
 * The graphspec profile associates conventional H1 (`# Heading`) sections with each node
 * type. This module extracts those top-level sections from a concept's markdown body so
 * the validator can check for their presence and consumers can retrieve section content.
 */

/** A top-level (H1) section of a markdown body. */
export interface Section {
  /** The heading text (without the leading `# `). */
  readonly heading: string;
  /** The body content beneath the heading, up to the next H1 (trimmed). */
  readonly content: string;
}

const H1_RE = /^#\s+(.+?)\s*$/;
const FENCE_RE = /^(```|~~~)/;

/**
 * Extract top-level H1 sections from a markdown body.
 *
 * Only `# ` (single-hash) headings delimit sections; deeper headings (`##`, `###`) are
 * captured as part of the enclosing section's content. Headings inside fenced code blocks
 * are ignored.
 */
export function extractSections(body: string): Section[] {
  const lines = body.split(/\r?\n/);
  const sections: Section[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  let inFence = false;

  for (const line of lines) {
    if (FENCE_RE.test(line.trim())) {
      inFence = !inFence;
    }
    const match = inFence ? null : H1_RE.exec(line);
    if (match) {
      if (current) {
        sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
      }
      current = { heading: match[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
  }
  return sections;
}

/** The set of H1 heading texts present in a body. */
export function sectionHeadings(body: string): Set<string> {
  return new Set(extractSections(body).map((s) => s.heading));
}
