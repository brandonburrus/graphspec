/**
 * Concept scoring for the search box.
 *
 * A plain weighted substring match rather than a fuzzy-search dependency. Concept IDs and
 * titles are short, deliberate, kebab-cased strings, so substring matching finds what people
 * type; fuzzy matching mostly adds false positives and 8 KB to every generated file.
 *
 * Every term must appear somewhere (AND, not OR), which is what makes a two-word query
 * narrow rather than widen.
 */

import { type AnyNode, isConcept } from "./nodes.js";

/** Field weights, highest-signal field first. */
const WEIGHTS = {
  title: 10,
  id: 8,
  type: 5,
  tag: 4,
  description: 3,
  body: 1,
} as const;

/** Bonus for matching the start of a title or ID, where a prefix match is usually intended. */
const PREFIX_BONUS = 6;

/**
 * Score one concept against a query. Zero means no match.
 *
 * Scores are only ever compared against each other, so the absolute scale is arbitrary.
 */
export function scoreConcept(node: AnyNode, query: string): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
  if (terms.length === 0) {
    return 0;
  }

  const fields = searchFields(node);
  let total = 0;

  for (const term of terms) {
    let best = 0;
    for (const [field, weight] of Object.entries(WEIGHTS) as [keyof typeof WEIGHTS, number][]) {
      const value = fields[field];
      if (value === undefined || !value.includes(term)) {
        continue;
      }
      const prefix = (field === "title" || field === "id") && value.startsWith(term);
      best = Math.max(best, weight + (prefix ? PREFIX_BONUS : 0));
    }
    if (best === 0) {
      return 0; // every term must match something
    }
    total += best;
  }
  return total;
}

/** Lowercased searchable text per field. */
function searchFields(node: AnyNode): Partial<Record<keyof typeof WEIGHTS, string>> {
  if (!isConcept(node)) {
    return { title: node.title.toLowerCase(), id: node.id.toLowerCase() };
  }
  return {
    title: node.title.toLowerCase(),
    id: node.id.toLowerCase(),
    type: (node.type ?? "").toLowerCase(),
    tag: node.tags.join(" ").toLowerCase(),
    description: (node.description ?? "").toLowerCase(),
    body: node.body.toLowerCase(),
  };
}
