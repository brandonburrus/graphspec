/**
 * Minimal fixed-width table renderer for CLI output (no external dependency).
 */

/** Render rows as a simple aligned text table with a header row. */
export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const pad = (cells: string[]) =>
    cells
      .map((c, i) => (c ?? "").padEnd(widths[i]))
      .join("  ")
      .trimEnd();

  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const lines = [pad(headers), sep, ...rows.map(pad)];
  return lines.join("\n");
}
