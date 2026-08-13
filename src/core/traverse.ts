/**
 * Graph traversal: subgraph selection and bounded reachability.
 *
 * These helpers layer directed-graph traversal on top of the reusable {@link Graph} model
 * without embedding any command-specific concerns, so the `graph` command (and later
 * sessions) can select and render slices of a spec graph.
 */

import { CHILD_EDGE, type Edge, type Graph } from "./graph.js";
import type { Concept } from "./types.js";

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
 * (bounded by `depth`) and returns the reachable concepts plus the allowed edges among them.
 *
 * Only edges whose both endpoints are present in the selected node set are emitted, so the
 * result is always a self-contained graph (declared-but-unresolved targets are a coverage
 * concern, surfaced by the coverage analysis instead).
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
    ? reachableIds(graph, selection.from, allowKind, selection.depth)
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
 * Concept IDs reachable from `startId` following allowed edges outward, bounded by `depth`.
 *
 * @throws {UnknownConceptError} when `startId` does not resolve.
 */
export function reachableIds(
  graph: Graph,
  startId: string,
  allowKind: (kind: string) => boolean,
  depth?: number,
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
      for (const edge of graph.edgesFrom(id)) {
        if (!edge.resolved || !allowKind(edge.kind) || visited.has(edge.to)) {
          continue;
        }
        visited.add(edge.to);
        next.push(edge.to);
      }
    }
    frontier = next;
    hops += 1;
  }

  return visited;
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
