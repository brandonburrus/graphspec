/**
 * The graph canvas: force layout, painting, and pointer interaction.
 *
 * Canvas 2D rather than SVG or DOM nodes. A spec bundle can reach thousands of concepts, and
 * one retained-mode element per node plus per edge stops being interactive well before that;
 * an immediate-mode repaint stays flat in cost and gives exact control over the label,
 * arrowhead, and dimming behavior the graph needs.
 *
 * d3-force supplies only the layout math (it is DOM-free). Pan, zoom, hit testing, and drag
 * are a camera transform and a distance check here, rather than pulling in d3-zoom and
 * d3-selection to re-implement the same twenty lines against the DOM.
 */

import {
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";
import type { PayloadEdge } from "../visualize/payload.js";
import { type AnyNode, isConcept, titleOf } from "./nodes.js";
import { type CanvasColors, type NodeShape, readCanvasColors, shapeForLayer } from "./palette.js";
import type { ViewerState } from "./state.js";

/** A node in the simulation. d3-force mutates `x`/`y`/`vx`/`vy` in place. */
interface SimNode extends SimulationNodeDatum {
  id: string;
  radius: number;
  node: AnyNode;
  /** True while the user has parked this node; the layout no longer moves it. */
  pinned: boolean;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  edge: PayloadEdge;
}

/** Zoom level past which node labels are drawn, matching how Obsidian reveals them. */
const LABEL_ZOOM = 0.62;
/** Zoom level past which edge arrowheads are drawn; below this they are visual noise. */
const ARROW_ZOOM = 0.5;
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 6;
/** Pointer travel (in screen px) below which a press counts as a click, not a drag. */
const CLICK_SLOP = 4;

/** Interaction callbacks the host wires to the rest of the app. */
export interface CanvasHandlers {
  onSelect(id: string | null): void;
  onFocus(id: string): void;
}

/** The graph canvas view. */
export class GraphCanvas {
  private readonly context: CanvasRenderingContext2D;
  private readonly simulation: Simulation<SimNode, SimLink>;
  private simNodes: SimNode[] = [];
  private simLinks: SimLink[] = [];
  private byId = new Map<string, SimNode>();
  private colors: CanvasColors;

  private camera = { x: 0, y: 0, k: 1 };
  private width = 0;
  private height = 0;
  /** devicePixelRatio at last resize. Re-applied every frame, since draw() resets the matrix. */
  private ratio = 1;

  private dragging: SimNode | null = null;
  private panning = false;
  private pointerMoved = 0;
  private needsFit = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly state: ViewerState,
    private readonly handlers: CanvasHandlers,
  ) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("viewer: canvas 2d context unavailable");
    }
    this.context = context;
    this.colors = readCanvasColors(document.documentElement, state.payload.profile.nodeTypes);

    this.simulation = forceSimulation<SimNode, SimLink>([])
      .force("charge", forceManyBody<SimNode>().strength(-260).distanceMax(900))
      .force(
        "collide",
        forceCollide<SimNode>((d) => d.radius + 8),
      )
      // Weak centering on both axes rather than forceCenter: it pulls disconnected
      // components back toward the origin instead of letting charge fling them off screen.
      .force("x", forceX<SimNode>(0).strength(0.045))
      .force("y", forceY<SimNode>(0).strength(0.045))
      .on("tick", () => this.draw());

    this.observeSize();
    this.bindPointer();
    this.watchTheme();
    this.rebuild();
  }

  /** Rebuild the simulation from current state, preserving positions and pins by ID. */
  rebuild(): void {
    const visible = this.state.visibleNodeIds();
    const edges = this.state.visibleEdges(visible);
    const previous = this.byId;

    this.simNodes = [];
    for (const node of this.state.payload.nodes) {
      if (!visible.has(node.id)) {
        continue;
      }
      const before = previous.get(node.id);
      this.simNodes.push({
        id: node.id,
        node,
        radius: radiusOf(node),
        pinned: before?.pinned ?? false,
        // Reuse the last position so a filter toggle or a hot reload nudges the layout
        // rather than scattering every node to a new random start.
        x: before?.x,
        y: before?.y,
        vx: before?.vx,
        vy: before?.vy,
        fx: before?.pinned ? before.fx : undefined,
        fy: before?.pinned ? before.fy : undefined,
      });
    }
    this.byId = new Map(this.simNodes.map((n) => [n.id, n]));
    this.simLinks = edges
      .filter((edge) => this.byId.has(edge.from) && this.byId.has(edge.to))
      .map((edge) => ({ source: edge.from, target: edge.to, edge }));

    this.simulation.nodes(this.simNodes);
    this.simulation.force(
      "link",
      forceLink<SimNode, SimLink>(this.simLinks)
        .id((d) => d.id)
        // Structural edges are containment rather than dependency, so they pull less: the
        // relation graph should drive the shape of the layout.
        .distance((l) => (l.edge.structural ? 55 : 90))
        .strength((l) => (l.edge.structural ? 0.15 : 0.4)),
    );
    this.simulation.alpha(0.9).restart();
  }

  /** Repaint without touching the layout (selection, hover, dimming changes). */
  draw(): void {
    const { context } = this;
    context.save();
    // Base matrix is the pixel ratio, not identity: resetting to identity here would paint
    // CSS-pixel coordinates onto a device-pixel canvas and shrink the graph into one corner.
    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    context.translate(this.camera.x, this.camera.y);
    context.scale(this.camera.k, this.camera.k);

    const emphasis = this.emphasisSet();
    this.drawEdges(emphasis);
    this.drawNodes(emphasis);

    context.restore();

    if (this.needsFit && this.simulation.alpha() < 0.25 && this.simNodes.length > 0) {
      this.needsFit = false;
      this.fit();
    }
  }

  /**
   * The set of nodes to paint at full strength, or null when everything is equal.
   *
   * Hover and selection win over search, because they are the more immediate intent.
   */
  private emphasisSet(): Set<string> | null {
    const anchor = this.state.hoveredId ?? this.state.selectedId;
    if (anchor !== null) {
      const set = this.state.neighbors(anchor);
      set.add(anchor);
      return set;
    }
    return this.state.matchedIds();
  }

  private drawEdges(emphasis: Set<string> | null): void {
    const { context, colors } = this;
    context.lineWidth = 1 / this.camera.k;

    for (const link of this.simLinks) {
      const source = link.source as SimNode;
      const target = link.target as SimNode;
      if (source.x === undefined || target.x === undefined) {
        continue;
      }
      const lit = emphasis === null ? false : emphasis.has(source.id) && emphasis.has(target.id);
      context.globalAlpha = emphasis === null ? 0.55 : lit ? 0.95 : 0.14;
      context.strokeStyle = lit ? colors.edgeStrong : colors.edge;
      context.setLineDash(link.edge.structural ? [4 / this.camera.k, 4 / this.camera.k] : []);

      const sx = source.x ?? 0;
      const sy = source.y ?? 0;
      const tx = target.x ?? 0;
      const ty = target.y ?? 0;
      context.beginPath();
      context.moveTo(sx, sy);
      context.lineTo(tx, ty);
      context.stroke();

      if (this.camera.k >= ARROW_ZOOM) {
        this.drawArrowhead(sx, sy, tx, ty, target.radius, lit ? colors.edgeStrong : colors.edge);
      }
    }
    context.setLineDash([]);
    context.globalAlpha = 1;
  }

  /** A small filled triangle at the target end, offset clear of the node it points at. */
  private drawArrowhead(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    targetRadius: number,
    color: string,
  ): void {
    const dx = tx - sx;
    const dy = ty - sy;
    const length = Math.hypot(dx, dy);
    if (length < targetRadius + 4) {
      return;
    }
    const ux = dx / length;
    const uy = dy / length;
    const tipX = tx - ux * (targetRadius + 2);
    const tipY = ty - uy * (targetRadius + 2);
    const size = 6 / this.camera.k;

    const { context } = this;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(tipX, tipY);
    context.lineTo(tipX - ux * size + uy * size * 0.5, tipY - uy * size - ux * size * 0.5);
    context.lineTo(tipX - ux * size - uy * size * 0.5, tipY - uy * size + ux * size * 0.5);
    context.closePath();
    context.fill();
  }

  private drawNodes(emphasis: Set<string> | null): void {
    const { context, colors } = this;
    const showLabels = this.camera.k >= LABEL_ZOOM;

    for (const sim of this.simNodes) {
      const x = sim.x ?? 0;
      const y = sim.y ?? 0;
      const lit = emphasis === null || emphasis.has(sim.id);
      // Dimmed, not erased: the surrounding graph is the context that makes a
      // highlighted neighborhood mean something.
      context.globalAlpha = lit ? 1 : 0.22;

      const ghost = !isConcept(sim.node);
      const shape = ghost ? "circle" : shapeForLayer(this.state.layerOf(sim.node));
      context.beginPath();
      tracePath(context, shape, x, y, sim.radius);

      if (ghost) {
        // Hollow with a dashed ring: a reference-first target that has no file yet reads as
        // "planned", not as an ordinary concept.
        context.setLineDash([3 / this.camera.k, 3 / this.camera.k]);
        context.strokeStyle = colors.ghost;
        context.lineWidth = 1.5 / this.camera.k;
        context.stroke();
        context.setLineDash([]);
      } else {
        context.fillStyle = this.colorFor(sim);
        context.fill();
      }

      if (this.state.selectedId === sim.id) {
        context.strokeStyle = colors.accent;
        context.lineWidth = 2.5 / this.camera.k;
        context.stroke();
      } else if (this.state.hasError(sim.id)) {
        context.strokeStyle = colors.error;
        context.lineWidth = 2 / this.camera.k;
        context.stroke();
      } else if (sim.pinned) {
        context.strokeStyle = colors.label;
        context.lineWidth = 1 / this.camera.k;
        context.stroke();
      }

      const labelled = showLabels || (emphasis === null ? false : emphasis.has(sim.id));
      if (labelled && lit) {
        this.drawLabel(titleOf(sim.node), x, y + sim.radius + 4 / this.camera.k);
      }
    }
    context.globalAlpha = 1;
  }

  /** A label with a surface-colored halo, so it stays readable over edges and nodes. */
  private drawLabel(label: string, x: number, y: number): void {
    const { context, colors } = this;
    const size = Math.min(13, 12 / this.camera.k);
    context.font = `${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.lineWidth = 3 / this.camera.k;
    context.strokeStyle = colors.labelHalo;
    context.strokeText(label, x, y);
    context.fillStyle = colors.label;
    context.fillText(label, x, y);
  }

  private colorFor(sim: SimNode): string {
    const node = sim.node;
    if (!isConcept(node) || node.type === null) {
      return this.colors.unknown;
    }
    return this.colors.type[node.type] ?? this.colors.unknown;
  }

  /** Center and scale the camera so every node is on screen. */
  fit(): void {
    if (this.simNodes.length === 0) {
      return;
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const sim of this.simNodes) {
      minX = Math.min(minX, (sim.x ?? 0) - sim.radius);
      minY = Math.min(minY, (sim.y ?? 0) - sim.radius);
      maxX = Math.max(maxX, (sim.x ?? 0) + sim.radius);
      maxY = Math.max(maxY, (sim.y ?? 0) + sim.radius);
    }
    const padding = 64;
    const k = clamp(
      Math.min(
        (this.width - padding * 2) / Math.max(maxX - minX, 1),
        (this.height - padding * 2) / Math.max(maxY - minY, 1),
      ),
      MIN_ZOOM,
      1.4,
    );
    this.camera = {
      k,
      x: this.width / 2 - ((minX + maxX) / 2) * k,
      y: this.height / 2 - ((minY + maxY) / 2) * k,
    };
    this.draw();
  }

  /** Pan and zoom so one node sits centered, used by deep links and result clicks. */
  centerOn(id: string, zoom = 1.1): void {
    const sim = this.byId.get(id);
    if (!sim) {
      return;
    }
    this.camera = {
      k: zoom,
      x: this.width / 2 - (sim.x ?? 0) * zoom,
      y: this.height / 2 - (sim.y ?? 0) * zoom,
    };
    this.draw();
  }

  /** Release every parked node back to the layout. */
  unpinAll(): void {
    for (const sim of this.simNodes) {
      sim.pinned = false;
      sim.fx = undefined;
      sim.fy = undefined;
    }
    this.simulation.alpha(0.5).restart();
  }

  /** Re-read theme colors, e.g. after the OS switches between light and dark. */
  refreshColors(): void {
    this.colors = readCanvasColors(document.documentElement, this.state.payload.profile.nodeTypes);
    this.draw();
  }

  private observeSize(): void {
    const resize = () => {
      this.ratio = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
      this.canvas.width = Math.round(rect.width * this.ratio);
      this.canvas.height = Math.round(rect.height * this.ratio);
      this.draw();
    };
    new ResizeObserver(resize).observe(this.canvas);
    resize();
  }

  private watchTheme(): void {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      this.refreshColors();
    });
  }

  private bindPointer(): void {
    const canvas = this.canvas;

    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture(event.pointerId);
      this.pointerMoved = 0;
      const hit = this.hitTest(event.offsetX, event.offsetY);
      if (hit) {
        this.dragging = hit;
        const world = this.toWorld(event.offsetX, event.offsetY);
        hit.fx = world.x;
        hit.fy = world.y;
        this.simulation.alphaTarget(0.3).restart();
      } else {
        this.panning = true;
      }
    });

    canvas.addEventListener("pointermove", (event) => {
      this.pointerMoved += Math.abs(event.movementX) + Math.abs(event.movementY);

      if (this.dragging) {
        const world = this.toWorld(event.offsetX, event.offsetY);
        this.dragging.fx = world.x;
        this.dragging.fy = world.y;
        return;
      }
      if (this.panning) {
        this.camera.x += event.movementX;
        this.camera.y += event.movementY;
        this.draw();
        return;
      }
      const hit = this.hitTest(event.offsetX, event.offsetY);
      const hoveredId = hit?.id ?? null;
      if (hoveredId !== this.state.hoveredId) {
        this.state.hoveredId = hoveredId;
        canvas.style.cursor = hoveredId === null ? "grab" : "pointer";
        this.state.emit();
      }
    });

    const endPointer = (event: PointerEvent) => {
      const wasClick = this.pointerMoved <= CLICK_SLOP;
      if (this.dragging) {
        // A drag parks the node. Dropping it back into the layout on release would undo the
        // arranging the user just did, which is the whole point of dragging it.
        if (!wasClick) {
          this.dragging.pinned = true;
        } else if (event.shiftKey) {
          this.dragging.pinned = false;
          this.dragging.fx = undefined;
          this.dragging.fy = undefined;
        }
        if (!this.dragging.pinned) {
          this.dragging.fx = undefined;
          this.dragging.fy = undefined;
        }
        if (wasClick) {
          this.handlers.onSelect(this.dragging.id);
        }
        this.simulation.alphaTarget(0);
        this.dragging = null;
      } else if (this.panning && wasClick) {
        this.handlers.onSelect(null);
      }
      this.panning = false;
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", () => {
      this.dragging = null;
      this.panning = false;
    });

    canvas.addEventListener("dblclick", (event) => {
      const hit = this.hitTest(event.offsetX, event.offsetY);
      if (hit) {
        this.handlers.onFocus(hit.id);
      }
    });

    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        // Anchor the zoom at the cursor so the point under the pointer stays put.
        const before = this.toWorld(event.offsetX, event.offsetY);
        const factor = Math.exp(-event.deltaY * 0.0015);
        this.camera.k = clamp(this.camera.k * factor, MIN_ZOOM, MAX_ZOOM);
        const after = this.toWorld(event.offsetX, event.offsetY);
        this.camera.x += (after.x - before.x) * this.camera.k;
        this.camera.y += (after.y - before.y) * this.camera.k;
        this.draw();
      },
      { passive: false },
    );
  }

  private toWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.camera.x) / this.camera.k,
      y: (screenY - this.camera.y) / this.camera.k,
    };
  }

  /** Nearest node under the pointer, searched back to front so the top one wins. */
  private hitTest(screenX: number, screenY: number): SimNode | null {
    const world = this.toWorld(screenX, screenY);
    for (let i = this.simNodes.length - 1; i >= 0; i--) {
      const sim = this.simNodes[i];
      const dx = (sim.x ?? 0) - world.x;
      const dy = (sim.y ?? 0) - world.y;
      // A small slack makes small nodes clickable without zooming in.
      const reach = sim.radius + 4 / this.camera.k;
      if (dx * dx + dy * dy <= reach * reach) {
        return sim;
      }
    }
    return null;
  }
}

/**
 * Trace a node outline. Sizes are tuned so the four shapes read as the same visual weight at
 * the same radius; a square inscribed in a circle looks noticeably smaller than one drawn to
 * the same half-width, and a triangle smaller still.
 */
function tracePath(
  context: CanvasRenderingContext2D,
  shape: NodeShape,
  x: number,
  y: number,
  radius: number,
): void {
  switch (shape) {
    case "square": {
      const half = radius * 0.86;
      context.roundRect(x - half, y - half, half * 2, half * 2, Math.max(1, radius * 0.18));
      break;
    }
    case "diamond": {
      const reach = radius * 1.22;
      context.moveTo(x, y - reach);
      context.lineTo(x + reach, y);
      context.lineTo(x, y + reach);
      context.lineTo(x - reach, y);
      context.closePath();
      break;
    }
    case "triangle": {
      const reach = radius * 1.28;
      context.moveTo(x, y - reach);
      context.lineTo(x + reach * 0.866, y + reach * 0.5);
      context.lineTo(x - reach * 0.866, y + reach * 0.5);
      context.closePath();
      break;
    }
    default:
      context.arc(x, y, radius, 0, Math.PI * 2);
  }
}

/** Node radius from relation degree, flattened so a hub does not swamp the canvas. */
function radiusOf(node: AnyNode): number {
  const degree = isConcept(node) ? node.degree : 1;
  return 5 + Math.sqrt(degree) * 2.6;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
