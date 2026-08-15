/**
 * Assemble the single self-contained HTML document.
 *
 * Pure by design: viewer assets arrive as strings rather than being read from disk here, so
 * the whole document can be rendered and asserted in a unit test without a build having run.
 * `assets.ts` owns the disk read.
 *
 * The output must stay self-contained. No `<script src>`, no `<link rel=stylesheet>`, no
 * font or image URL: the file has to work from a USB stick, an email attachment, or an
 * air-gapped machine. A test asserts this rather than trusting review to catch a regression.
 */

import type { VisualizePayload } from "./payload.js";

/** The bundled browser assets, as strings. */
export interface ViewerAssets {
  /** The esbuild-bundled viewer IIFE. */
  readonly js: string;
  /** The viewer stylesheet. */
  readonly css: string;
}

/** Render-time options that are not part of the graph data. */
export interface RenderOptions {
  /**
   * True when the document is served by `visualize serve`. The viewer then subscribes to
   * `/events` and hot-swaps the payload, instead of treating its embedded copy as final.
   */
  readonly serve?: boolean;
}

/** Element ID of the embedded payload block, shared with the viewer. */
export const PAYLOAD_ELEMENT_ID = "graphspec-payload";

/** Element ID of the embedded render-config block, shared with the viewer. */
export const CONFIG_ELEMENT_ID = "graphspec-config";

/** Build the complete HTML document for a payload. */
export function renderHtml(
  payload: VisualizePayload,
  assets: ViewerAssets,
  options: RenderOptions = {},
): string {
  const title = `${payload.bundle.name} (graphspec)`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="graphspec visualize">
<title>${escapeHtml(title)}</title>
<style>${assets.css}</style>
</head>
<body>
<div id="app"></div>
<script type="application/json" id="${CONFIG_ELEMENT_ID}">${embedJson({
    serve: options.serve === true,
  })}</script>
<script type="application/json" id="${PAYLOAD_ELEMENT_ID}">${embedJson(payload)}</script>
<script>${assets.js}</script>
</body>
</html>
`;
}

/**
 * Serialize a value for embedding inside a `<script type="application/json">` block.
 *
 * Escaping every `<` to its unicode form is what makes a closing script tag inside a
 * concept's body structurally impossible to emit, rather than something filtered after the
 * fact. The escape is invisible to `JSON.parse`, which is how the viewer reads the block.
 *
 * The line and paragraph separators are escaped for the same class of reason: they are
 * legal inside a JSON string but terminate a line in older JavaScript parsers.
 */
function embedJson(value: unknown): string {
  // Source stays pure ASCII: the separators are referenced by code point rather than typed
  // literally, so no editor or pipeline can silently mangle an invisible character.
  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replaceAll(lineSeparator, "\\u2028")
    .replaceAll(paragraphSeparator, "\\u2029");
}

/** Escape text for interpolation into HTML element content or a quoted attribute. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
