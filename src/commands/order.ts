/**
 * `graphspec order [path]` — topological build order of System/Component concepts.
 */

import { loadBundle } from "../core/bundle.js";
import { Graph } from "../core/graph.js";
import { type OrderResult, buildOrder } from "../core/order.js";
import type { Writer } from "./io.js";

/** Options accepted by the order command. */
export interface OrderCommandOptions {
  json?: boolean;
}

/**
 * Run the order command against `path`.
 *
 * @returns process exit code: 0 on success, 1 when a dependency cycle is found, 2 on I/O
 * failure.
 */
export async function runOrder(
  path: string,
  options: OrderCommandOptions,
  writer: Writer,
): Promise<number> {
  let result: OrderResult;
  try {
    const bundle = await loadBundle(path);
    result = buildOrder(Graph.fromBundle(bundle));
  } catch (err) {
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  const hasCycles = result.cycles.length > 0;

  if (options.json) {
    writer.out(JSON.stringify({ order: result.order, cycles: result.cycles }, null, 2));
    return hasCycles ? 1 : 0;
  }

  if (hasCycles) {
    writer.err("error: dependency cycle(s) detected:");
    for (const cycle of result.cycles) {
      writer.err(`  ${[...cycle, cycle[0]].join(" -> ")}`);
    }
    return 1;
  }

  if (result.order.length === 0) {
    writer.out("No System or Component concepts to order.");
    return 0;
  }

  result.order.forEach((id, i) => {
    writer.out(`${i + 1}. ${id}`);
  });
  writer.out(`\n${result.order.length} node(s).`);
  return 0;
}
