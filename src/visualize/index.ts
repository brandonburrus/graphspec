/**
 * The visualization layer: bundle plus analyses in, one self-contained HTML document out.
 *
 * Sits above `validate` and below `commands` in the dependency order, so both the one-shot
 * `visualize` command and the `visualize serve` server build a page the same way rather than
 * each assembling their own.
 */

import { loadBundle } from "../core/bundle.js";
import { analyzeCoverage } from "../core/coverage.js";
import { Graph } from "../core/graph.js";
import { validateBundle } from "../validate/index.js";
import { type VisualizePayload, buildPayload } from "./payload.js";

export { loadViewerAssets, MissingViewerAssetsError } from "./assets.js";
export * from "./payload.js";
export * from "./render.js";

/**
 * Load a bundle and fold it, its diagnostics, and its coverage report into a viewer payload.
 *
 * Validation runs non-strict on purpose. A visualization of a bundle with problems is the
 * most useful case there is, so problems travel into the page as data rather than stopping
 * it from being produced.
 */
export async function buildVisualization(path: string, title?: string): Promise<VisualizePayload> {
  const bundle = await loadBundle(path);
  const graph = Graph.fromBundle(bundle);
  return buildPayload({
    bundle,
    graph,
    diagnostics: validateBundle(bundle).diagnostics,
    coverage: analyzeCoverage(graph),
    title,
  });
}
