/**
 * graphspec profile — public aggregate.
 *
 * The single source of truth for the graphspec vocabulary: node types (with filename
 * tokens, required fields, conventional sections) and typed relations (with allowed source
 * and target types). Sessions 2 and 3 import from here.
 */

export * from "./node-types.js";
export * from "./relations.js";

import { NODE_TYPES, type NodeType } from "./node-types.js";
import { RELATIONS, type Relation } from "./relations.js";

/** The graphspec profile bundled as a single object. */
export interface Profile {
  readonly name: string;
  readonly okfVersion: string;
  readonly nodeTypes: readonly NodeType[];
  readonly relations: readonly Relation[];
}

/** The graphspec profile instance. */
export const PROFILE: Profile = {
  name: "graphspec",
  okfVersion: "0.1",
  nodeTypes: NODE_TYPES,
  relations: RELATIONS,
};
