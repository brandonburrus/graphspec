/**
 * The node union shared across viewer modules.
 *
 * Kept in its own module so `state` and `search` can both use it without importing each
 * other: a cycle between the store and its scorer would work under a bundler but is the kind
 * of thing that quietly breaks when a module is split later.
 */

import type { PayloadGhostNode, PayloadNode } from "../visualize/payload.js";

/** Either a real concept or a synthesized reference-first placeholder. */
export type AnyNode = PayloadNode | PayloadGhostNode;

/** Narrowing helper: the two node shapes share almost no fields. */
export function isConcept(node: AnyNode): node is PayloadNode {
  return node.ghost === false;
}

/** A node's display label. */
export function titleOf(node: AnyNode): string {
  return node.title || node.id;
}
