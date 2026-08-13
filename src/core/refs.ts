/**
 * Reference normalization and resolution.
 *
 * A relation target (or OKF cross-link) is a bundle-relative path with a leading `/`, with
 * or without a trailing `.md`. It resolves to a concept ID, which is the file path within
 * the bundle minus the `.md` suffix. This module normalizes raw references into concept
 * IDs so they can be looked up in the graph.
 */

/**
 * Normalize a raw reference into a concept-ID candidate.
 *
 * Strips a leading `/`, a trailing `.md`, collapses redundant separators, and resolves
 * `.`/`..` segments relative to the bundle root. Returns the candidate concept ID (which
 * may or may not resolve to an existing concept — resolution is the caller's job).
 *
 * @param ref Raw reference string, e.g. `/systems/cli.system.md` or `systems/cli.system`.
 */
export function normalizeRef(ref: string): string {
  let r = ref.trim();
  // Drop an anchor/fragment if present (e.g. `/a/b.md#section`).
  const hashIndex = r.indexOf("#");
  if (hashIndex !== -1) {
    r = r.slice(0, hashIndex);
  }
  // Strip a leading slash (bundle-relative absolute form).
  if (r.startsWith("/")) {
    r = r.slice(1);
  }
  // Strip a trailing .md suffix.
  if (r.toLowerCase().endsWith(".md")) {
    r = r.slice(0, -3);
  }
  // Resolve path segments (. and ..) and collapse empties.
  const out: string[] = [];
  for (const seg of r.split("/")) {
    if (seg === "" || seg === ".") {
      continue;
    }
    if (seg === "..") {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return out.join("/");
}
