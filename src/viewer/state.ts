/**
 * Viewer application state and the derived views every panel renders from.
 *
 * One store, one change event. The canvas, sidebar, and inspector all subscribe and re-read
 * derived state rather than talking to each other, so a hot payload swap or a deep-link jump
 * only has to update the store.
 *
 * Two distinct narrowing mechanisms, deliberately not merged:
 *   - **Filters** and **focus** *hide* nodes. They change what the graph is.
 *   - **Search** *dims* non-matches and drives the result list. It never hides, because a
 *     search that empties the graph destroys the context you were searching within.
 */

import type { PayloadEdge, VisualizePayload } from "../visualize/payload.js";
import { type AnyNode, isConcept, titleOf } from "./nodes.js";
import { scoreConcept } from "./search.js";

export { type AnyNode, isConcept, titleOf } from "./nodes.js";

/** Everything the user can toggle. */
export interface Filters {
  layers: Set<string>;
  types: Set<string>;
  relations: Set<string>;
  tags: Set<string>;
  showStructural: boolean;
  showGhosts: boolean;
  showOrphans: boolean;
}

/** A depth-limited neighborhood view, the interactive form of `graph --from --depth`. */
export interface Focus {
  readonly id: string;
  readonly depth: number;
}

/** The reactive store. */
export class ViewerState {
  payload: VisualizePayload;
  filters: Filters;
  query = "";
  selectedId: string | null = null;
  hoveredId: string | null = null;
  focus: Focus | null = null;

  private nodeIndex = new Map<string, AnyNode>();
  private listeners = new Set<() => void>();

  constructor(payload: VisualizePayload) {
    this.payload = payload;
    this.filters = defaultFilters(payload);
    this.reindex();
  }

  /** Subscribe to any state change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Notify subscribers. Called by every mutator below. */
  emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Swap in a payload from `visualize serve` without losing the user's place.
   *
   * Filters are intersected rather than reset: a type that vanished from the bundle drops
   * out, but everything still present keeps its on/off state. Selection survives only if its
   * concept still exists, which is the honest outcome when a file was deleted mid-session.
   */
  replacePayload(next: VisualizePayload): void {
    const fresh = defaultFilters(next);
    this.filters = {
      layers: intersect(this.filters.layers, fresh.layers),
      types: intersect(this.filters.types, fresh.types),
      relations: intersect(this.filters.relations, fresh.relations),
      tags: intersect(this.filters.tags, fresh.tags),
      showStructural: this.filters.showStructural,
      showGhosts: this.filters.showGhosts,
      showOrphans: this.filters.showOrphans,
    };
    this.payload = next;
    this.reindex();
    if (this.selectedId !== null && !this.nodeIndex.has(this.selectedId)) {
      this.selectedId = null;
    }
    if (this.focus !== null && !this.nodeIndex.has(this.focus.id)) {
      this.focus = null;
    }
    this.emit();
  }

  /** Look up any node by ID. */
  node(id: string): AnyNode | undefined {
    return this.nodeIndex.get(id);
  }

  /** All node IDs currently passing filters and focus. */
  visibleNodeIds(): Set<string> {
    const visible = new Set<string>();
    const focusSet = this.focusSet();
    for (const node of this.payload.nodes) {
      if (focusSet !== null && !focusSet.has(node.id)) {
        continue;
      }
      if (this.passesFilters(node)) {
        visible.add(node.id);
      }
    }
    return visible;
  }

  /** Edges whose kind is enabled and whose endpoints are both visible. */
  visibleEdges(visibleNodes: Set<string>): PayloadEdge[] {
    return this.payload.edges.filter(
      (edge) =>
        this.passesEdgeFilters(edge) && visibleNodes.has(edge.from) && visibleNodes.has(edge.to),
    );
  }

  /** Search matches, best first. Empty query yields every concept in title order. */
  results(): { node: AnyNode; score: number }[] {
    if (this.query.trim() === "") {
      return [...this.payload.nodes]
        .sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
        .map((node) => ({ node, score: 0 }));
    }
    const scored: { node: AnyNode; score: number }[] = [];
    for (const node of this.payload.nodes) {
      const score = scoreConcept(node, this.query);
      if (score > 0) {
        scored.push({ node, score });
      }
    }
    return scored.sort(
      (a, b) => b.score - a.score || titleOf(a.node).localeCompare(titleOf(b.node)),
    );
  }

  /** IDs matching the current query, for dimming. Null when no query is active. */
  matchedIds(): Set<string> | null {
    if (this.query.trim() === "") {
      return null;
    }
    return new Set(this.results().map((r) => r.node.id));
  }

  /** Every relation edge touching a node, in either direction. */
  edgesTouching(id: string): { outgoing: PayloadEdge[]; incoming: PayloadEdge[] } {
    const outgoing: PayloadEdge[] = [];
    const incoming: PayloadEdge[] = [];
    for (const edge of this.payload.edges) {
      if (edge.from === id) {
        outgoing.push(edge);
      }
      if (edge.to === id) {
        incoming.push(edge);
      }
    }
    return { outgoing, incoming };
  }

  /** Direct neighbors of a node over currently enabled edges, for hover highlighting. */
  neighbors(id: string): Set<string> {
    const found = new Set<string>();
    for (const edge of this.payload.edges) {
      if (!this.passesEdgeFilters(edge)) {
        continue;
      }
      if (edge.from === id) {
        found.add(edge.to);
      }
      if (edge.to === id) {
        found.add(edge.from);
      }
    }
    return found;
  }

  /** Diagnostics attached to a concept, matched on its bundle-relative path. */
  diagnosticsFor(node: AnyNode) {
    if (!isConcept(node)) {
      return [];
    }
    return this.payload.diagnostics.filter(
      (d) => d.file === node.relPath || d.conceptId === node.id,
    );
  }

  /** Coverage gap categories naming a concept, as human-readable labels. */
  coverageGapsFor(id: string): string[] {
    const c = this.payload.coverage;
    const gaps: string[] = [];
    const check = (list: readonly string[], label: string) => {
      if (list.includes(id)) {
        gaps.push(label);
      }
    };
    check(c.unsatisfiedRequirements, "No component or system satisfies this requirement");
    check(c.untestedRequirements, "No test scenario covers this requirement");
    check(c.untestedJourneys, "No test scenario covers this journey");
    check(c.emptyFeatures, "This feature includes no requirements");
    check(c.unrealizedFeatures, "Nothing realizes this feature");
    check(c.danglingConstraints, "This constraint constrains nothing");
    check(c.orphanConcepts, "Orphan: no relations in or out");
    for (const target of c.unresolvedTargets) {
      if (target.from === id) {
        gaps.push(`Unresolved ${target.relation} target: ${target.target}`);
      }
    }
    return gaps;
  }

  /** True when a concept has at least one error-severity diagnostic. */
  hasError(id: string): boolean {
    const node = this.nodeIndex.get(id);
    return node !== undefined && this.diagnosticsFor(node).some((d) => d.severity === "error");
  }

  private passesFilters(node: AnyNode): boolean {
    if (!isConcept(node)) {
      return this.filters.showGhosts;
    }
    const type = node.type ?? "";
    if (node.type !== null && this.filters.types.size > 0 && !this.filters.types.has(type)) {
      return false;
    }
    const layer = this.layerOf(node);
    if (this.filters.layers.size > 0 && !this.filters.layers.has(layer)) {
      return false;
    }
    if (this.filters.tags.size > 0 && !node.tags.some((tag) => this.filters.tags.has(tag))) {
      return false;
    }
    if (!this.filters.showOrphans && this.payload.coverage.orphanConcepts.includes(node.id)) {
      return false;
    }
    return true;
  }

  private passesEdgeFilters(edge: PayloadEdge): boolean {
    if (edge.structural) {
      return this.filters.showStructural;
    }
    return this.filters.relations.size === 0 || this.filters.relations.has(edge.relation);
  }

  /** The profile layer a concept belongs to, or `unknown` for a type outside the profile. */
  layerOf(node: AnyNode): string {
    if (!isConcept(node) || node.type === null) {
      return "unknown";
    }
    return this.payload.profile.nodeTypes.find((t) => t.name === node.type)?.layer ?? "unknown";
  }

  /** Breadth-first neighborhood of the focused node, or null when focus is off. */
  private focusSet(): Set<string> | null {
    if (this.focus === null) {
      return null;
    }
    const reached = new Set<string>([this.focus.id]);
    let frontier = [this.focus.id];
    for (let hop = 0; hop < this.focus.depth; hop++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const neighbor of this.neighbors(id)) {
          if (!reached.has(neighbor)) {
            reached.add(neighbor);
            next.push(neighbor);
          }
        }
      }
      frontier = next;
      if (frontier.length === 0) {
        break;
      }
    }
    return reached;
  }

  private reindex(): void {
    this.nodeIndex = new Map(this.payload.nodes.map((node) => [node.id, node]));
  }
}

/** Every filter starts fully enabled: the default view is the whole graph. */
function defaultFilters(payload: VisualizePayload): Filters {
  const types = new Set<string>();
  const tags = new Set<string>();
  for (const node of payload.nodes) {
    if (!isConcept(node)) {
      continue;
    }
    if (node.type !== null) {
      types.add(node.type);
    }
    for (const tag of node.tags) {
      tags.add(tag);
    }
  }
  return {
    layers: new Set([...payload.profile.layers, "unknown"]),
    types,
    relations: new Set(payload.edges.filter((e) => !e.structural).map((e) => e.relation)),
    tags,
    // Off by default: directory containment is a different graph from the relation graph,
    // and mixing them by default makes the relation structure harder to read.
    showStructural: false,
    showGhosts: true,
    showOrphans: true,
  };
}

/** Keep only members that still exist in the fresh set. */
function intersect(previous: Set<string>, fresh: Set<string>): Set<string> {
  return new Set([...fresh].filter((value) => previous.has(value)));
}
