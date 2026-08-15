/**
 * Color assignment for the graph.
 *
 * Nodes are colored by profile *layer*, not by node type. Thirteen categorical hues is a
 * quantity no reader can hold or distinguish; four is legible, and the layer is the grouping
 * that actually carries meaning (product / architecture / specification / glossary).
 *
 * The three hues were validated for all-pairs colorblind separation against both the light
 * and dark canvas surfaces (worst CVD deltaE 9.2 light / 9.4 dark, worst normal-vision 24.0
 * light / 20.9 dark). A fourth categorical hue could not clear the all-pairs floors in both
 * modes with any option available, so the glossary layer deliberately takes a neutral instead
 * of a fourth hue: it is the supporting vocabulary layer rather than a spec layer, and
 * folding it to neutral is the documented move when a categorical set runs out of safe slots.
 *
 * Aqua sits at 2.74:1 against the light surface, below the 3:1 mark contrast bar. The relief
 * for that is visible labels, which the canvas and the sidebar list both provide.
 *
 * Values live in CSS custom properties so the stylesheet stays the single source of truth for
 * both themes; canvas needs literal colors, so they are read back from the computed style
 * once per theme rather than duplicated here.
 */

/** Semantic color roles the canvas needs as literal values. */
export interface CanvasColors {
  readonly layer: Record<string, string>;
  readonly unknown: string;
  readonly ghost: string;
  readonly edge: string;
  readonly edgeStrong: string;
  readonly label: string;
  readonly labelHalo: string;
  readonly error: string;
  readonly warning: string;
  readonly accent: string;
}

/** The CSS variable holding a layer's color. */
export function layerVar(layer: string): string {
  return `--gs-layer-${layer}`;
}

/** Read the current theme's colors out of the stylesheet. */
export function readCanvasColors(root: HTMLElement, layers: readonly string[]): CanvasColors {
  const style = getComputedStyle(root);
  const read = (name: string): string => style.getPropertyValue(name).trim();

  const layer: Record<string, string> = {};
  for (const name of layers) {
    // An unrecognized layer (a future profile addition) falls back to the unknown swatch
    // rather than rendering as an empty string, which canvas would silently paint black.
    layer[name] = read(layerVar(name)) || read("--gs-node-unknown");
  }

  return {
    layer,
    unknown: read("--gs-node-unknown"),
    ghost: read("--gs-node-ghost"),
    edge: read("--gs-edge"),
    edgeStrong: read("--gs-edge-strong"),
    label: read("--gs-ink"),
    labelHalo: read("--gs-bg"),
    error: read("--gs-status-error"),
    warning: read("--gs-status-warning"),
    accent: read("--gs-accent"),
  };
}
