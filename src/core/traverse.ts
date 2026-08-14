/**
 * Graph traversal: subgraph selection and bounded reachability.
 *
 * These helpers layer directed-graph traversal on top of the reusable {@link Graph} model
 * without embedding any command-specific concerns, so the `graph` command (and later
 * sessions) can select and render slices of a spec graph.
 */

import { CHILD_EDGE, type Edge, type Graph } from "./graph.js";
import type { Concept } from "./types.js";

/**
 * Traversal direction relative to each visited node, applied uniformly to typed relation
 * edges and (when `structure` is enabled) structural parent→child edges alike:
 *
 * - `out`: follow edges where the visited node is the `from` side (the historical/default
 *   behavior). Correct for relations a concept originates, e.g. a Component's `satisfies`.
 * - `in`: follow edges where the visited node is the `to` side (reverse). Necessary for
 *   relations that originate elsewhere and merely target the concept, e.g. `constrains`
 *   (Constraint → System/Component/Requirement) or `covers` (TestScenario → …).
 * - `both`: follow edges in either direction from each visited node.
 *
 * For structural edges, `out` means parent→child (a directory's representative concept to
 * its contents) since that is the direction the edge is stored in; `in` walks child→parent.
 */
export type Direction = "out" | "in" | "both";

/** Selection criteria for {@link selectSubgraph}. */
export interface GraphSelection {
  /** Root concept ID to traverse outward from; when omitted the whole graph is selected. */
  readonly from?: string;
  /** Maximum number of hops from `from` (default unlimited). Ignored without `from`. */
  readonly depth?: number;
  /** Restrict to these relation names; when omitted all relation kinds are allowed. */
  readonly relations?: readonly string[];
  /** Include structural directory parent→child edges (default false: typed relations only). */
  readonly structure?: boolean;
  /** Traversal direction relative to `from` (default `"out"`). Ignored without `from`. */
  readonly direction?: Direction;
}

/** A resolved slice of a graph: concept nodes plus the edges among them. */
export interface GraphView {
  readonly nodes: Concept[];
  readonly edges: Edge[];
}

/** Error thrown when a `--from` root does not resolve to an existing concept. */
export class UnknownConceptError extends Error {
  constructor(readonly conceptId: string) {
    super(`concept not found: ${conceptId}`);
    this.name = "UnknownConceptError";
  }
}

/**
 * Select a subgraph of `graph` per `selection`.
 *
 * With no `from`, returns every concept and every allowed edge between two existing
 * concepts. With `from`, performs a breadth-first traversal following allowed edges outward
 * (bounded by `depth`, and by `direction` — default `"out"`, see {@link Direction}) and
 * returns the reachable concepts plus the allowed edges among them.
 *
 * Only edges whose both endpoints are present in the selected node set are emitted, so the
 * result is always a self-contained graph (declared-but-unresolved targets are a coverage
 * concern, surfaced by the coverage analysis instead). This applies regardless of
 * `direction`: an edge appears whenever both its `from` and `to` ended up in the reachable
 * set, so a `constrains` edge found by walking `in` still renders with its original
 * `{from: <Constraint>, to: <target>}` shape.
 *
 * @throws {UnknownConceptError} when `from` is given but does not resolve.
 */
export function selectSubgraph(graph: Graph, selection: GraphSelection = {}): GraphView {
  const relationSet = selection.relations ? new Set(selection.relations) : undefined;
  const allowKind = (kind: string): boolean => {
    if (kind === CHILD_EDGE) {
      return selection.structure === true;
    }
    return relationSet ? relationSet.has(kind) : true;
  };

  const nodeIds = selection.from
    ? reachableIds(graph, selection.from, allowKind, selection.depth, selection.direction)
    : new Set(graph.ids());

  const nodes = [...nodeIds]
    .map((id) => graph.get(id))
    .filter((c): c is Concept => c !== undefined)
    .sort(byId);

  const edges = graph
    .edges()
    .filter((e) => allowKind(e.kind) && nodeIds.has(e.from) && nodeIds.has(e.to))
    .sort(byEdge);

  return { nodes, edges };
}

/**
 * Concept IDs reachable from `startId` following allowed edges, bounded by `depth`.
 *
 * `direction` defaults to `"out"` (the historical, outward-only behavior) so existing callers
 * that omit it are unaffected. Pass `"in"` to walk edges backward (e.g. to find what
 * `constrains` or `covers` a concept) or `"both"` to follow edges either way.
 *
 * @throws {UnknownConceptError} when `startId` does not resolve.
 */
export function reachableIds(
  graph: Graph,
  startId: string,
  allowKind: (kind: string) => boolean,
  depth?: number,
  direction: Direction = "out",
): Set<string> {
  if (!graph.has(startId)) {
    throw new UnknownConceptError(startId);
  }
  const limit = depth ?? Number.POSITIVE_INFINITY;
  const visited = new Set<string>([startId]);
  let frontier: string[] = [startId];
  let hops = 0;

  while (frontier.length > 0 && hops < limit) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const { neighborId, edge } of adjacent(graph, id, direction)) {
        if (!edge.resolved || !allowKind(edge.kind) || visited.has(neighborId)) {
          continue;
        }
        visited.add(neighborId);
        next.push(neighborId);
      }
    }
    frontier = next;
    hops += 1;
  }

  return visited;
}

/** One step of adjacency: the neighbor reached and the edge used to reach it. */
interface Step {
  readonly neighborId: string;
  readonly edge: Edge;
}

/**
 * Neighbors of `id` per `direction`: outgoing edges (`id` is `from`), incoming edges (`id` is
 * `to`, walked back to `from`), or both. `edgesTo` only indexes edges whose `to` resolves to an
 * existing concept, and every edge's `from` is always an existing concept by construction, so
 * both directions yield only edges safe to follow further.
 */
function adjacent(graph: Graph, id: string, direction: Direction): Step[] {
  const steps: Step[] = [];
  if (direction === "out" || direction === "both") {
    for (const edge of graph.edgesFrom(id)) {
      steps.push({ neighborId: edge.to, edge });
    }
  }
  if (direction === "in" || direction === "both") {
    for (const edge of graph.edgesTo(id)) {
      steps.push({ neighborId: edge.from, edge });
    }
  }
  return steps;
}

/** Stable concept ordering by ID. */
function byId(a: Concept, b: Concept): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Stable edge ordering by (from, kind, to). */
function byEdge(a: Edge, b: Edge): number {
  if (a.from !== b.from) {
    return a.from < b.from ? -1 : 1;
  }
  if (a.kind !== b.kind) {
    return a.kind < b.kind ? -1 : 1;
  }
  return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
}
