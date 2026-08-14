/**
 * Build-order computation: a topological sort of `System` and `Component` concepts derived
 * from their `depends-on` edges, plus dependency-cycle detection.
 *
 * A node must come after everything it depends on. Cycles make a total order impossible, so
 * they are detected and reported instead. Kept in the core layer so the ordering algorithm
 * stays independently testable and reusable.
 */

import type { Graph } from "./graph.js";

/** The relation whose edges define build dependencies. */
export const DEPENDS_ON = "depends-on";

/** Node types that participate in build ordering. */
const ORDERABLE_TYPES = new Set(["System", "Component"]);

/** The outcome of an ordering attempt. */
export interface OrderResult {
  /**
   * Topologically ordered concept IDs (each node after all it depends on). Complete when
   * `cycles` is empty; a partial prefix of the acyclic portion otherwise.
   */
  readonly order: string[];
  /** Detected dependency cycles, each a path of IDs that loops back to its first entry. */
  readonly cycles: string[][];
}

/**
 * Compute the build order of `System`/`Component` concepts from `depends-on` edges.
 *
 * Uses Kahn's algorithm with alphabetical tie-breaking for deterministic output. When the
 * graph is acyclic, `order` lists every orderable node with dependencies first. When cycles
 * exist, `cycles` lists them and `order` holds only the portion that could be ordered.
 */
export function buildOrder(graph: Graph): OrderResult {
  const nodes = graph
    .concepts()
    .filter((c) => c.type !== undefined && ORDERABLE_TYPES.has(c.type))
    .map((c) => c.id)
    .sort();
  const nodeSet = new Set(nodes);

  // dependents.get(T) = nodes that depend on T (so T must be emitted before them).
  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const id of nodes) {
    dependents.set(id, []);
    indegree.set(id, 0);
  }

  for (const id of nodes) {
    // De-duplicate parallel depends-on edges to the same target.
    const targets = new Set<string>();
    for (const edge of graph.edgesFrom(id, DEPENDS_ON)) {
      if (edge.resolved && nodeSet.has(edge.to) && edge.to !== id) {
        targets.add(edge.to);
      }
    }
    for (const target of targets) {
      dependents.get(target)?.push(id);
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
    }
  }

  const order: string[] = [];
  const ready = nodes.filter((id) => indegree.get(id) === 0).sort();
  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const remaining = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, remaining);
      if (remaining === 0) {
        insertSorted(ready, dependent);
      }
    }
  }

  if (order.length === nodes.length) {
    return { order, cycles: [] };
  }

  const remaining = nodes.filter((id) => (indegree.get(id) ?? 0) > 0);
  const cycles = findCycles(graph, new Set(remaining));
  return { order, cycles };
}

/** Insert `value` into an already-sorted array, preserving order. */
function insertSorted(arr: string[], value: string): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  arr.splice(lo, 0, value);
}

/**
 * Find dependency cycles among `pool` (the nodes left unordered after Kahn's algorithm).
 *
 * Runs a depth-first search over `depends-on` edges restricted to `pool`, reconstructing a
 * cycle path each time a back edge into the active recursion stack is found. Returns one
 * representative cycle per distinct member set, sorted for stable output.
 */
function findCycles(graph: Graph, pool: Set<string>): string[][] {
  const cycles: string[][] = [];
  const seenKeys = new Set<string>();
  const state = new Map<string, "active" | "done">();
  const stack: string[] = [];

  const visit = (id: string): void => {
    state.set(id, "active");
    stack.push(id);
    const targets = new Set<string>();
    for (const edge of graph.edgesFrom(id, DEPENDS_ON)) {
      if (edge.resolved && pool.has(edge.to) && edge.to !== id) {
        targets.add(edge.to);
      }
    }
    for (const target of [...targets].sort()) {
      const targetState = state.get(target);
      if (targetState === undefined) {
        visit(target);
      } else if (targetState === "active") {
        const start = stack.indexOf(target);
        if (start !== -1) {
          recordCycle(stack.slice(start), cycles, seenKeys);
        }
      }
    }
    stack.pop();
    state.set(id, "done");
  };

  for (const id of [...pool].sort()) {
    if (!state.has(id)) {
      visit(id);
    }
  }
  return cycles;
}

/** Record a cycle path once per distinct member set (keyed by sorted members). */
function recordCycle(path: string[], cycles: string[][], seenKeys: Set<string>): void {
  const key = [...path].sort().join("\u0000");
  if (seenKeys.has(key)) {
    return;
  }
  seenKeys.add(key);
  cycles.push(path);
}
