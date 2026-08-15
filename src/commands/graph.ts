/**
 * `graphspec graph [path]` — build the spec graph and emit it as JSON, Mermaid, or DOT.
 *
 * By default the whole typed-relation graph is emitted; `--from`/`--depth` select a reachable
 * subgraph, `--rel` restricts to specific relation names, `--direction` controls which way
 * edges are followed from `--from` (default `out`), and `--structure` adds the implicit
 * directory parent→child edges (also subject to `--direction`).
 *
 * `--from` accepts either a bare concept ID or the leading-slash `.md` reference form used by
 * `relations:` targets; both normalize to the same concept.
 */

import { loadBundle } from "../core/bundle.js";
import { CHILD_EDGE, type Edge, Graph } from "../core/graph.js";
import { normalizeRef } from "../core/refs.js";
import {
  type Direction,
  type GraphView,
  UnknownConceptError,
  selectSubgraph,
} from "../core/traverse.js";
import type { Concept } from "../core/types.js";
import { RELATION_NAMES } from "../profile/relations.js";
import type { Writer } from "./io.js";

/** Output formats supported by the graph command. */
export type GraphFormat = "json" | "mermaid" | "dot";

/** Options accepted by the graph command. */
export interface GraphCommandOptions {
  format?: string;
  from?: string;
  depth?: string;
  rel?: string;
  structure?: boolean;
  direction?: string;
}

/**
 * Run the graph command against `path`.
 *
 * @returns process exit code: 0 on success, 2 on I/O failure or invalid selection.
 */
export async function runGraph(
  path: string,
  options: GraphCommandOptions,
  writer: Writer,
): Promise<number> {
  const format = (options.format ?? "json") as GraphFormat;
  if (format !== "json" && format !== "mermaid" && format !== "dot") {
    writer.err(`error: unknown format '${options.format}' (expected json, mermaid, or dot)`);
    return 2;
  }

  let relations: string[] | undefined;
  if (options.rel !== undefined) {
    relations = options.rel
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    const unknown = relations.filter((r) => !RELATION_NAMES.includes(r));
    if (unknown.length > 0) {
      writer.err(`error: unknown relation(s): ${unknown.join(", ")}`);
      return 2;
    }
  }

  let depth: number | undefined;
  if (options.depth !== undefined) {
    depth = Number(options.depth);
    if (!Number.isInteger(depth) || depth < 0) {
      writer.err(`error: --depth must be a non-negative integer (got '${options.depth}')`);
      return 2;
    }
  }

  let direction: Direction | undefined;
  if (options.direction !== undefined) {
    if (options.direction !== "out" && options.direction !== "in" && options.direction !== "both") {
      writer.err(`error: --direction must be one of out, in, both (got '${options.direction}')`);
      return 2;
    }
    if (options.from === undefined) {
      writer.err("note: --direction is ignored without --from");
    } else {
      direction = options.direction;
    }
  }

  // Accept the same reference form the profile mandates for relation targets in frontmatter
  // (`/a/b.component.md`, with or without the leading slash and `.md`) as well as a bare
  // concept ID, so a target copied out of a `relations:` block can be pasted straight into
  // `--from`. The raw input is kept for error reporting.
  const from = options.from === undefined ? undefined : normalizeRef(options.from);

  let view: GraphView;
  try {
    const bundle = await loadBundle(path);
    const graph = Graph.fromBundle(bundle);
    view = selectSubgraph(graph, {
      from,
      depth,
      relations,
      structure: options.structure === true,
      direction,
    });
  } catch (err) {
    if (err instanceof UnknownConceptError) {
      writer.err(`error: --from concept not found: ${options.from}`);
      return 2;
    }
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  writer.out(renderGraph(view, format));
  return 0;
}

/** Render a graph view in the requested format. */
export function renderGraph(view: GraphView, format: GraphFormat): string {
  switch (format) {
    case "mermaid":
      return renderMermaid(view);
    case "dot":
      return renderDot(view);
    default:
      return renderJson(view);
  }
}

/** JSON: `{ nodes: [{id,type,title}], edges: [{from,to,relation}] }`. */
function renderJson(view: GraphView): string {
  return JSON.stringify(
    {
      nodes: view.nodes.map((n) => ({
        id: n.id,
        type: n.type ?? null,
        title: n.title ?? null,
      })),
      edges: view.edges.map((e) => ({ from: e.from, to: e.to, relation: e.kind })),
    },
    null,
    2,
  );
}

/** Mermaid `graph LR` with aliased node ids, title/id labels, and relation-labeled edges. */
function renderMermaid(view: GraphView): string {
  const alias = new Map<string, string>();
  view.nodes.forEach((n, i) => alias.set(n.id, `n${i}`));

  const lines = ["graph LR"];
  for (const n of view.nodes) {
    lines.push(`  ${alias.get(n.id)}["${escapeMermaid(labelOf(n))}"]`);
  }
  for (const e of view.edges) {
    const from = alias.get(e.from);
    const to = alias.get(e.to);
    if (from && to) {
      lines.push(`  ${from} -->|${escapeMermaid(edgeLabel(e))}| ${to}`);
    }
  }
  return lines.join("\n");
}

/** Graphviz digraph with quoted concept ids, title/id labels, and relation-labeled edges. */
function renderDot(view: GraphView): string {
  const lines = ["digraph graphspec {", "  rankdir=LR;"];
  for (const n of view.nodes) {
    lines.push(`  "${escapeDot(n.id)}" [label="${escapeDot(labelOf(n))}"];`);
  }
  for (const e of view.edges) {
    lines.push(
      `  "${escapeDot(e.from)}" -> "${escapeDot(e.to)}" [label="${escapeDot(edgeLabel(e))}"];`,
    );
  }
  lines.push("}");
  return lines.join("\n");
}

/** A node's display label: its title, falling back to its ID. */
function labelOf(concept: Concept): string {
  return concept.title ?? concept.id;
}

/** An edge's display label: the relation name (structural edges show as `child`). */
function edgeLabel(edge: Edge): string {
  return edge.kind === CHILD_EDGE ? CHILD_EDGE : edge.kind;
}

/** Escape a label for use inside a Mermaid `["..."]` node/edge string. */
function escapeMermaid(text: string): string {
  return text.replace(/"/g, "&quot;");
}

/** Escape a string for use inside a DOT double-quoted literal. */
function escapeDot(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
