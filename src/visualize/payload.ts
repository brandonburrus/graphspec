/**
 * The serializable data model the HTML viewer runs on.
 *
 * `buildPayload` is the whole boundary between the Node side and the browser side: it folds
 * a bundle, its graph, its diagnostics, and its coverage report into one JSON-safe object.
 * Keeping it pure (no disk, no rendering) is what makes the viewer's inputs testable without
 * a browser.
 *
 * The payload also carries the profile vocabulary itself, so the viewer needs zero built-in
 * knowledge of the 13 node types and 16 relations: it colors, groups, and describes purely
 * from data handed to it. Adding a node type stays a one-file change in `src/profile/`.
 */

import type { CoverageReport } from "../core/coverage.js";
import { CHILD_EDGE, type Graph } from "../core/graph.js";
import type { Bundle, Concept } from "../core/types.js";
import { NODE_TYPES, nodeTypeByName } from "../profile/node-types.js";
import { RELATIONS } from "../profile/relations.js";
import type { Diagnostic } from "../validate/diagnostics.js";

/**
 * Payload schema version, bumped on any breaking shape change.
 *
 * The viewer bundle and the generating CLI ship together, but a stale HTML file opened
 * against a new expectation should fail loudly rather than render half a graph.
 */
export const PAYLOAD_VERSION = 1;

/** A node type as the viewer sees it. */
export interface PayloadNodeType {
  readonly name: string;
  readonly token: string;
  readonly layer: string;
  readonly description: string;
  readonly requiredFields: readonly { readonly key: string; readonly values?: readonly string[] }[];
  readonly sections: readonly string[];
}

/** A relation as the viewer sees it. */
export interface PayloadRelation {
  readonly name: string;
  readonly sourceTypes: readonly string[];
  readonly targetTypes: readonly string[];
  readonly description: string;
}

/** One concept, with everything the inspector renders. */
export interface PayloadNode {
  readonly id: string;
  readonly relPath: string;
  readonly type: string | null;
  readonly token: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly tags: readonly string[];
  /**
   * Every frontmatter key, including ones the profile does not know about. OKF preserves
   * unknown keys, so an inspector that dropped them would quietly contradict the format.
   */
  readonly frontmatter: Record<string, unknown>;
  readonly sections: readonly { readonly heading: string; readonly content: string }[];
  readonly body: string;
  /** True when `type` names no node type in the profile (rendered as an unknown-type node). */
  readonly unknownType: boolean;
  readonly frontmatterError: string | null;
  /** Relation-edge count in either direction, used for node radius. */
  readonly degree: number;
  /** True when this node only exists because something links to it (reference-first authoring). */
  readonly ghost: false;
}

/**
 * A link target that resolves to no concept.
 *
 * OKF supports reference-first authoring, so these are legal and deliberately rendered
 * rather than dropped: the graph shows the concept you linked before you wrote it.
 */
export interface PayloadGhostNode {
  readonly id: string;
  readonly title: string;
  readonly ghost: true;
  /** Concept IDs that reference this missing target. */
  readonly referencedBy: readonly string[];
}

/** A directed edge. */
export interface PayloadEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly resolved: boolean;
  readonly rawTarget: string | null;
  /** True for the implicit directory parent -> child edge rather than a profile relation. */
  readonly structural: boolean;
}

/** The complete viewer input. */
export interface VisualizePayload {
  readonly version: number;
  readonly generatedAt: string;
  readonly bundle: {
    readonly name: string;
    readonly root: string;
    readonly conceptCount: number;
    /** `.md` files skipped for carrying no type token (`AGENTS.md`, `README.md`, ...). */
    readonly ignored: readonly string[];
  };
  readonly profile: {
    readonly nodeTypes: readonly PayloadNodeType[];
    readonly relations: readonly PayloadRelation[];
    readonly layers: readonly string[];
  };
  readonly nodes: readonly (PayloadNode | PayloadGhostNode)[];
  readonly edges: readonly PayloadEdge[];
  readonly diagnostics: readonly Diagnostic[];
  readonly coverage: CoverageReport;
}

/** Inputs to {@link buildPayload}, all already computed by the caller. */
export interface BuildPayloadInput {
  readonly bundle: Bundle;
  readonly graph: Graph;
  readonly diagnostics: readonly Diagnostic[];
  readonly coverage: CoverageReport;
  /** Display name for the bundle; defaults to the root directory's basename. */
  readonly title?: string;
  /** Injected so output is deterministic in tests. */
  readonly now?: Date;
}

/** Fold a loaded bundle and its analyses into the viewer payload. */
export function buildPayload(input: BuildPayloadInput): VisualizePayload {
  const { bundle, graph, diagnostics, coverage } = input;

  const edges: PayloadEdge[] = graph.edges().map((e) => ({
    from: e.from,
    to: e.to,
    relation: e.kind,
    resolved: e.resolved,
    rawTarget: e.rawTarget ?? null,
    structural: e.kind === CHILD_EDGE,
  }));

  const nodes: (PayloadNode | PayloadGhostNode)[] = graph
    .concepts()
    .map((c) => toNode(c, degreeOf(graph, c.id)));
  nodes.push(...ghostNodes(edges));

  return {
    version: PAYLOAD_VERSION,
    generatedAt: (input.now ?? new Date()).toISOString(),
    bundle: {
      name: input.title ?? basename(bundle.root),
      root: bundle.root,
      conceptCount: bundle.concepts.length,
      ignored: [...bundle.ignored],
    },
    profile: {
      nodeTypes: NODE_TYPES.map((t) => ({
        name: t.name,
        token: t.token,
        layer: t.layer,
        description: t.description,
        requiredFields: t.requiredFields.map((f) => ({ key: f.key, values: f.values })),
        sections: t.sections,
      })),
      relations: RELATIONS.map((r) => ({
        name: r.name,
        sourceTypes: r.sourceTypes,
        targetTypes: r.targetTypes,
        description: r.description,
      })),
      layers: uniqueLayers(),
    },
    nodes,
    edges,
    diagnostics: [...diagnostics],
    coverage,
  };
}

/** Project one concept into its payload node. */
function toNode(concept: Concept, degree: number): PayloadNode {
  return {
    id: concept.id,
    relPath: concept.relPath,
    type: concept.type ?? null,
    token: concept.fileToken ?? null,
    title: concept.title ?? concept.id,
    description: concept.description ?? null,
    tags: [...concept.tags],
    frontmatter: concept.frontmatter,
    sections: concept.sections.map((s) => ({ heading: s.heading, content: s.content })),
    body: concept.body,
    unknownType: concept.type === undefined || nodeTypeByName(concept.type) === undefined,
    frontmatterError: concept.frontmatterError ?? null,
    degree,
    ghost: false,
  };
}

/**
 * Synthesize a node for every unresolved relation target.
 *
 * Structural edges are always resolved by construction, so only relation edges can produce
 * one. Ghosts are deduped because several concepts may all link the same missing file.
 */
function ghostNodes(edges: readonly PayloadEdge[]): PayloadGhostNode[] {
  const referencedBy = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.resolved) {
      continue;
    }
    const sources = referencedBy.get(edge.to);
    if (sources) {
      if (!sources.includes(edge.from)) {
        sources.push(edge.from);
      }
    } else {
      referencedBy.set(edge.to, [edge.from]);
    }
  }
  return [...referencedBy].map(([id, sources]) => ({
    id,
    title: id,
    ghost: true as const,
    referencedBy: sources,
  }));
}

/** Relation-edge degree (structural edges excluded, so radius tracks meaning not layout). */
function degreeOf(graph: Graph, id: string): number {
  const out = graph.edgesFrom(id).filter((e) => e.kind !== CHILD_EDGE).length;
  const incoming = graph.edgesTo(id).filter((e) => e.kind !== CHILD_EDGE).length;
  return out + incoming;
}

/** Profile layers in declaration order, deduped. */
function uniqueLayers(): string[] {
  const seen: string[] = [];
  for (const type of NODE_TYPES) {
    if (!seen.includes(type.layer)) {
      seen.push(type.layer);
    }
  }
  return seen;
}

/** Final path segment of a directory path, tolerating a trailing separator. */
function basename(path: string): string {
  const parts = path.replace(/[/\\]+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
