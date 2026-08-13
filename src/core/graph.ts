/**
 * In-memory graph model.
 *
 * Builds a directed graph over a {@link Bundle}: concepts are nodes (keyed by concept ID),
 * typed edges come from `relations:` frontmatter, and implicit parent/child edges come
 * from the directory hierarchy. The model is intentionally free of command-specific logic
 * so later sessions can layer traversal (ordering) and coverage analysis on top without
 * refactoring it.
 */

import type { Bundle, Concept } from "./types.js";

/** A directed, typed edge between two concepts. */
export interface Edge {
  /** Source concept ID. */
  readonly from: string;
  /** Target concept ID (normalized). May not resolve to an existing node. */
  readonly to: string;
  /**
   * Edge kind: a profile relation name (e.g. `satisfies`) for relation edges, or the
   * special `"child"` kind for implicit directory parent→child containment.
   */
  readonly kind: string;
  /** Raw target reference for relation edges (undefined for structural edges). */
  readonly rawTarget?: string;
  /** True when `to` resolves to a concept present in the bundle. */
  readonly resolved: boolean;
}

/** The kind used for implicit directory parent→child edges. */
export const CHILD_EDGE = "child";

/**
 * A directed graph of concepts and their relations.
 *
 * Lookups are O(1) via internal maps. Adjacency is stored both forward (outgoing) and
 * reverse (incoming) so traversal in either direction is cheap.
 */
export class Graph {
  private readonly nodes = new Map<string, Concept>();
  private readonly outgoing = new Map<string, Edge[]>();
  private readonly incoming = new Map<string, Edge[]>();
  private readonly allEdges: Edge[] = [];

  private constructor(concepts: readonly Concept[]) {
    for (const concept of concepts) {
      this.nodes.set(concept.id, concept);
      this.outgoing.set(concept.id, []);
      this.incoming.set(concept.id, []);
    }
  }

  /** Build a graph from a parsed bundle. */
  static fromBundle(bundle: Bundle): Graph {
    const graph = new Graph(bundle.concepts);
    graph.addRelationEdges();
    graph.addHierarchyEdges();
    return graph;
  }

  private addEdge(edge: Edge): void {
    this.allEdges.push(edge);
    this.outgoing.get(edge.from)?.push(edge);
    // Only index incoming adjacency when the target node exists.
    this.incoming.get(edge.to)?.push(edge);
  }

  private addRelationEdges(): void {
    for (const concept of this.nodes.values()) {
      for (const rel of concept.relations) {
        this.addEdge({
          from: concept.id,
          to: rel.targetId,
          kind: rel.name,
          rawTarget: rel.rawTarget,
          resolved: this.nodes.has(rel.targetId),
        });
      }
    }
  }

  private addHierarchyEdges(): void {
    // Index concepts by "<directory>\u0000<name-part>" so a concept named `<dir>.<token>`
    // can be found as the owner of the `<dir>/` subdirectory.
    const byDirAndName = new Map<string, string>();
    for (const concept of this.nodes.values()) {
      byDirAndName.set(`${dirOfId(concept.id)}\u0000${namePartOf(concept)}`, concept.id);
    }
    for (const concept of this.nodes.values()) {
      const parentId = structuralParentId(concept, byDirAndName);
      if (parentId !== undefined && parentId !== concept.id) {
        this.addEdge({ from: parentId, to: concept.id, kind: CHILD_EDGE, resolved: true });
      }
    }
  }

  /** Total number of concept nodes. */
  get size(): number {
    return this.nodes.size;
  }

  /** All concepts, in insertion order. */
  concepts(): Concept[] {
    return [...this.nodes.values()];
  }

  /** All concept IDs. */
  ids(): string[] {
    return [...this.nodes.keys()];
  }

  /** Whether a concept with the given ID exists. */
  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /** Look up a concept by ID. */
  get(id: string): Concept | undefined {
    return this.nodes.get(id);
  }

  /** Every edge in the graph (relation + hierarchy). */
  edges(): readonly Edge[] {
    return this.allEdges;
  }

  /** Outgoing edges from a concept, optionally filtered by kind. */
  edgesFrom(id: string, kind?: string): Edge[] {
    const edges = this.outgoing.get(id) ?? [];
    return kind ? edges.filter((e) => e.kind === kind) : edges;
  }

  /** Incoming edges to a concept, optionally filtered by kind. */
  edgesTo(id: string, kind?: string): Edge[] {
    const edges = this.incoming.get(id) ?? [];
    return kind ? edges.filter((e) => e.kind === kind) : edges;
  }

  /** Resolved neighbor concepts reachable via outgoing edges of the given kind. */
  neighbors(id: string, kind?: string): Concept[] {
    const out: Concept[] = [];
    for (const edge of this.edgesFrom(id, kind)) {
      const node = this.nodes.get(edge.to);
      if (node) {
        out.push(node);
      }
    }
    return out;
  }
}

/**
 * Compute a concept's structural parent under the graphspec directory convention.
 *
 * A concept placed in directory `d` is owned by a "representative" concept that lives in
 * `d`'s parent directory and whose name part (filename minus the type token) equals `d`'s
 * final path segment. For example, `auth.system` at the root owns everything directly under
 * the `auth/` directory, so `auth/login.component`'s structural parent is `auth.system`.
 * Concepts at the bundle root, or in directories without a representative concept, have no
 * structural parent.
 */
function structuralParentId(
  concept: Concept,
  byDirAndName: Map<string, string>,
): string | undefined {
  const dir = dirOfId(concept.id);
  if (dir === "") {
    return undefined;
  }
  const slash = dir.lastIndexOf("/");
  const parentDir = slash === -1 ? "" : dir.slice(0, slash);
  const dirLastSeg = slash === -1 ? dir : dir.slice(slash + 1);
  return byDirAndName.get(`${parentDir}\u0000${dirLastSeg}`);
}

/** The directory portion of a concept ID ("" for a root-level concept). */
function dirOfId(id: string): string {
  const slash = id.lastIndexOf("/");
  return slash === -1 ? "" : id.slice(0, slash);
}

/** The name part of a concept: its filename with the type token removed. */
function namePartOf(concept: Concept): string {
  const { fileName, fileToken } = concept;
  if (fileToken && fileName.endsWith(`.${fileToken}`)) {
    return fileName.slice(0, fileName.length - fileToken.length - 1);
  }
  return fileName;
}
