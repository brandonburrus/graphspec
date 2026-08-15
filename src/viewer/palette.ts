/**
 * Color and shape assignment for the graph.
 *
 * Every node type gets its own color, and every profile layer its own shape. That pairing is
 * deliberate: thirteen free hues is more than any reader can tell apart, so the encoding is
 * composite. Color only has to discriminate *within* a shape group (at most five types), and
 * shape separates the groups.
 *
 * Each layer is therefore one hue family and each type an ordinal step within it, so a type's
 * color says which layer it belongs to as well as which type it is. Every ramp was validated
 * as an ordinal scale in both modes: monotone lightness, visible gaps between adjacent steps,
 * and a light end that still reads against the surface. The three hue families were also
 * validated all-pairs; the dark specification/product pair lands in the 6-8 CVD band, which is
 * permitted precisely because of the secondary encoding (shape, plus labels and the legend).
 *
 * Step order runs from most to least contrast against the current surface, so the same type is
 * the most prominent member of its family in both light and dark mode.
 *
 * Values live in CSS so the stylesheet stays the single source of truth for both themes.
 * Canvas cannot read CSS, so they are read back through getComputedStyle once per theme.
 */

/** Node outlines the canvas can draw. One per profile layer. */
export type NodeShape = "circle" | "square" | "diamond" | "triangle";

/**
 * Layer to shape. Unknown layers fall back to a circle rather than failing, so a profile that
 * grows a fifth layer still renders; give it a shape here when that happens.
 */
const LAYER_SHAPES: Record<string, NodeShape> = {
  product: "circle",
  architecture: "square",
  specification: "diamond",
  glossary: "triangle",
};

/** Steps defined per layer ramp in the stylesheet. */
const RAMP_STEPS = 6;

/** The shape used for a layer. */
export function shapeForLayer(layer: string): NodeShape {
  return LAYER_SHAPES[layer] ?? "circle";
}

/** The CSS variable holding a layer's base (mid) color, used for layer-level chrome. */
export function layerVar(layer: string): string {
  return `--gs-layer-${layer}`;
}

/** The CSS variable holding step `index` of a layer's ramp. */
export function rampVar(layer: string, index: number): string {
  return `--gs-ramp-${layer}-${Math.min(index, RAMP_STEPS - 1)}`;
}

/** Minimal shape of a payload node type, so this module needs no payload import. */
export interface TypeInfo {
  readonly name: string;
  readonly layer: string;
}

/**
 * A type's ramp index: its position among the types of its own layer, in profile declaration
 * order. Keeping the ordering in the profile rather than here is what lets a new node type
 * pick up a color without the viewer knowing anything about it.
 */
export function rampIndexes(types: readonly TypeInfo[]): Map<string, number> {
  const seen = new Map<string, number>();
  const indexes = new Map<string, number>();
  for (const type of types) {
    const next = seen.get(type.layer) ?? 0;
    indexes.set(type.name, next);
    seen.set(type.layer, next + 1);
  }
  return indexes;
}

/** Semantic color roles the canvas needs as literal values. */
export interface CanvasColors {
  /** Type name to its resolved color. */
  readonly type: Record<string, string>;
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

/** Read the current theme's colors out of the stylesheet. */
export function readCanvasColors(root: HTMLElement, types: readonly TypeInfo[]): CanvasColors {
  const style = getComputedStyle(root);
  const read = (name: string): string => style.getPropertyValue(name).trim();
  const unknown = read("--gs-node-unknown");

  const indexes = rampIndexes(types);
  const type: Record<string, string> = {};
  for (const info of types) {
    // An unrecognized layer resolves to an empty string, which canvas would silently paint
    // black, so fall back to the unknown swatch instead.
    type[info.name] = read(rampVar(info.layer, indexes.get(info.name) ?? 0)) || unknown;
  }

  return {
    type,
    unknown,
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
