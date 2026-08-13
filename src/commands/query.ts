/**
 * `graphspec query [path]` — filter concepts and print a table (or JSON).
 */

import { loadBundle } from "../core/bundle.js";
import type { Concept } from "../core/types.js";
import type { Writer } from "./io.js";
import { renderTable } from "./table.js";

/** Options accepted by the query command. */
export interface QueryCommandOptions {
  type?: string;
  tag?: string;
  status?: string;
  json?: boolean;
}

/** Apply the query filters to a concept list. */
export function filterConcepts(
  concepts: readonly Concept[],
  options: QueryCommandOptions,
): Concept[] {
  return concepts.filter((c) => {
    if (options.type && c.type !== options.type) {
      return false;
    }
    if (options.tag && !c.tags.includes(options.tag)) {
      return false;
    }
    if (options.status) {
      const status = c.frontmatter.status;
      if (typeof status !== "string" || status !== options.status) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Run the query command against `path`.
 *
 * @returns process exit code: 0 on success, 2 on I/O failure.
 */
export async function runQuery(
  path: string,
  options: QueryCommandOptions,
  writer: Writer,
): Promise<number> {
  let concepts: readonly Concept[];
  try {
    const bundle = await loadBundle(path);
    concepts = bundle.concepts;
  } catch (err) {
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  const matched = filterConcepts(concepts, options).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  if (options.json) {
    writer.out(
      JSON.stringify(
        matched.map((c) => ({
          id: c.id,
          type: c.type ?? null,
          title: c.title ?? null,
          description: c.description ?? null,
          tags: c.tags,
          status: typeof c.frontmatter.status === "string" ? c.frontmatter.status : null,
        })),
        null,
        2,
      ),
    );
    return 0;
  }

  if (matched.length === 0) {
    writer.out("No matching concepts.");
    return 0;
  }

  const rows = matched.map((c) => [c.id, c.type ?? "", c.title ?? ""]);
  writer.out(renderTable(["ID", "TYPE", "TITLE"], rows));
  writer.out(`\n${matched.length} concept(s).`);
  return 0;
}
